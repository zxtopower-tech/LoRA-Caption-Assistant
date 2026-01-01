from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional
from uuid import uuid4

import static_ffmpeg

static_ffmpeg.add_paths()

from fastapi import FastAPI, Form, Header, HTTPException, Request, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from config import get_config

# Initialize config
config = get_config()

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan events: Startup and Shutdown
    """
    # --- Startup ---
    from storage.migration import MigrationManager
    import logging

    logger = logging.getLogger(__name__)
    # Run migration
    try:
        migrator = MigrationManager(config.projects_dir)
        # migrate_all_projects is synchronous
        results = migrator.migrate_all_projects()
        if results["migrated"] or results["failed"]:
             logging.info(f"Startup Migration: {len(results['migrated'])} migrated, {len(results['failed'])} failed, {len(results['skipped'])} skipped")
    except Exception as e:
        logging.error(f"Startup Migration Failed: {e}")
    
    yield
    
    # --- Shutdown ---
    from storage.concurrency import get_queue_manager
    get_queue_manager().shutdown()

app = FastAPI(
    title="LoRA Caption Assistant Profile Service",
    lifespan=lifespan
)




# Path helper functions using config
def project_metadata_path(project_id: str) -> Path:
    return config.projects_dir / f"{project_id}.json"


def project_zip_path(project_id: str) -> Path:
    return config.projects_dir / f"{project_id}.zip"


def project_dir_path(project_id: str) -> Path:
    """Get the project directory path for a project ID (unpacked format)."""
    return config.projects_dir / project_id


def list_all_projects() -> list[Dict[str, Any]]:
    if not config.projects_dir.exists():
        return []
    projects = []
    for json_path in config.projects_dir.glob("*.json"):
        try:
            with json_path.open("r", encoding="utf-8") as f:
                project = json.load(f)
                if isinstance(project, dict) and "id" in project and "name" in project:
                    projects.append(project)
        except (json.JSONDecodeError, OSError):
            continue
    projects.sort(key=lambda p: p.get("name", ""))
    return projects


def sanitize_profile_id(profile_id: str) -> str:
    safe = re.sub(r"[^a-zA-Z0-9_-]+", "-", profile_id).strip("-")
    if not safe:
        raise HTTPException(status_code=400, detail="Invalid profile id.")
    return safe[:120]


def sanitize_workflow_filename(filename: str) -> str:
    """
    Sanitize workflow filename by replacing special characters with underscores.
    Ensures .json extension and limits length to 200 characters.

    Args:
        filename: Original filename

    Returns:
        Sanitized filename with .json extension
    """
    # Replace special characters with underscore
    special_chars = r'[/\\:*?"\'<>|()]'
    safe = re.sub(special_chars, "_", filename)

    # Remove extension for length checking (handles .JSON, .Json, etc.)
    if safe.lower().endswith(".json"):
        safe = safe[:-5]

    # Limit basename length to 195 (leaving room for .json)
    MAX_BASENAME_LENGTH = 195
    safe = safe[:MAX_BASENAME_LENGTH]

    # Ensure .json extension
    safe = safe + ".json"

    # Ensure filename is not empty after sanitization
    if not safe or safe == ".json":
        raise HTTPException(status_code=400, detail="Invalid workflow filename.")

    return safe


def profile_path(profile_id: str) -> Path:
    safe_id = sanitize_profile_id(profile_id)
    return config.profiles_dir / f"{safe_id}.json"


def validate_payload(payload: Any) -> Dict[str, Any]:
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Invalid project file.")
    schema_version = payload.get("schemaVersion")
    if not isinstance(schema_version, int):
        raise HTTPException(status_code=400, detail="Invalid project file.")
    global_settings = payload.get("globalSettings")
    if not isinstance(global_settings, dict):
        raise HTTPException(status_code=400, detail="Invalid project file.")
    return payload


def require_token(authorization: Optional[str]) -> None:
    if not config.api_token:
        return
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = authorization.split(" ", 1)[1]
    if token != config.api_token:
        raise HTTPException(status_code=403, detail="Forbidden")


def write_json(path: Path, payload: Dict[str, Any]) -> None:
    temp_path = path.with_suffix(".json.tmp")
    with temp_path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=True, indent=2)
        handle.write("\n")
    temp_path.replace(path)


def resolve_ffprobe() -> Optional[str]:
    # static-ffmpeg adds the binaries to the PATH, so we can just look for them.
    return shutil.which("ffprobe")


def parse_frame_rate(value: Optional[str]) -> Optional[float]:
    if not value or value == "0/0":
        return None
    if "/" in value:
        numerator, denominator = value.split("/", 1)
        try:
            num = float(numerator)
            den = float(denominator)
            if den == 0:
                return None
            return num / den
        except ValueError:
            return None
    try:
        return float(value)
    except ValueError:
        return None


def probe_media(path: str, ffprobe_path: str) -> Dict[str, Any]:
    import logging
    logger = logging.getLogger(__name__)
    cmd = [
        ffprobe_path,
        "-v",
        "error",
        "-print_format",
        "json",
        "-show_entries",
        "stream=codec_type,width,height,avg_frame_rate,nb_frames:format=duration",
        path,
    ]
    logger.info(f"[ffprobe] Running: {' '.join(cmd)}")
    try:
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
    except subprocess.CalledProcessError as exc:
        logger.error(f"[ffprobe] Failed with stderr: {exc.stderr}")
        raise HTTPException(status_code=500, detail=f"ffprobe failed: {exc.stderr or 'unknown error'}") from exc

    try:
        payload = json.loads(result.stdout or "{}")
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail="ffprobe returned invalid metadata.") from exc
    streams = payload.get("streams") or []
    video_stream = next((stream for stream in streams if stream.get("codec_type") == "video"), None)
    if not video_stream:
        raise HTTPException(status_code=400, detail="No video stream found.")

    width = video_stream.get("width")
    height = video_stream.get("height")
    if not isinstance(width, int) or not isinstance(height, int):
        raise HTTPException(status_code=400, detail="Missing width/height metadata.")

    duration_raw = None
    format_payload = payload.get("format") or {}
    if isinstance(format_payload, dict):
        duration_raw = format_payload.get("duration")
    if duration_raw is None:
        duration_raw = video_stream.get("duration")

    duration = None
    if duration_raw is not None:
        try:
            duration = float(duration_raw)
        except (TypeError, ValueError):
            duration = None

    fps = parse_frame_rate(video_stream.get("avg_frame_rate"))

    frame_count = None
    nb_frames = video_stream.get("nb_frames")
    if nb_frames is not None:
        try:
            frame_count = int(nb_frames)
        except (TypeError, ValueError):
            frame_count = None
    if frame_count is None and fps is not None and duration is not None:
        frame_count = int(round(duration * fps))

    response: Dict[str, Any] = {
        "width": width,
        "height": height,
    }
    if duration is not None:
        response["durationSec"] = duration
    if fps is not None:
        response["fps"] = fps
    if frame_count is not None:
        response["frameCount"] = frame_count
    return response


allow_origins = config.cors_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=False,
    allow_methods=["GET", "PUT", "POST", "DELETE"],
    allow_headers=["*"],
)

# Import and register new granular file management router
from routers.projects import router as projects_router
app.include_router(projects_router)

# Mount static files for direct project file access
# This allows serving images/videos without authentication
# Project IDs are UUIDs, making them hard to guess
app.mount("/static/projects", StaticFiles(directory=str(config.projects_dir)), name="projects")


@app.get("/healthz")
def health_check() -> Dict[str, str]:
    return {"status": "ok"}


@app.get("/api/profiles/{profile_id}")
def get_profile(profile_id: str, authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    require_token(authorization)
    path = profile_path(profile_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Profile not found.")
    try:
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail="Profile data corrupted.") from exc


@app.put("/api/profiles/{profile_id}")
async def put_profile(
    profile_id: str,
    request: Request,
    authorization: Optional[str] = Header(None),
) -> Dict[str, str]:
    require_token(authorization)
    try:
        payload = await request.json()
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid project file.") from exc

    validated = validate_payload(payload)
    validated.setdefault("projectName", profile_id)
    validated["savedAt"] = datetime.now(timezone.utc).isoformat()

    path = profile_path(profile_id)
    write_json(path, validated)
    return {"status": "saved"}


@app.post("/api/media/metadata")
async def post_media_metadata(file: UploadFile = File(...)) -> Dict[str, Any]:
    if not file.content_type or not (
        file.content_type.startswith("image/") or file.content_type.startswith("video/")
    ):
        raise HTTPException(status_code=400, detail="Unsupported media type.")

    ffprobe_path = resolve_ffprobe()
    if not ffprobe_path:
        raise HTTPException(status_code=500, detail="ffprobe is not available.")

    suffix = Path(file.filename or "").suffix
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_handle:
            file.file.seek(0)
            shutil.copyfileobj(file.file, tmp_handle)
            temp_path = tmp_handle.name

        return probe_media(temp_path, ffprobe_path)
    finally:
        if temp_path:
            try:
                os.remove(temp_path)
            except OSError:
                pass
        await file.close()


@app.post("/api/workflows")
async def post_workflow(file: UploadFile = File(...)) -> Dict[str, str]:
    """
    Upload a ComfyUI workflow file.

    Args:
        file: Uploaded workflow file (JSON)

    Returns:
        Status message with filename
    """
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"Received workflow upload: filename={file.filename}, content_type={file.content_type}, size={file.size if hasattr(file, 'size') else 'unknown'}")

    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required.")

    # Sanitize filename
    safe_filename = sanitize_workflow_filename(file.filename)
    target_path = config.workflows_dir / safe_filename

    # Validate JSON content
    temp_path = None
    try:
        # Save to temporary file first
        with tempfile.NamedTemporaryFile(mode="wb", delete=False, suffix=".json") as tmp_handle:
            file.file.seek(0)
            shutil.copyfileobj(file.file, tmp_handle)
            temp_path = tmp_handle.name

        # Validate JSON
        try:
            with open(temp_path, "r", encoding="utf-8") as f:
                json.load(f)
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=400, detail="Invalid JSON file.") from exc

        # Move to final location (atomic operation)
        shutil.move(temp_path, target_path)
        temp_path = None

        return {"status": "saved", "filename": safe_filename}
    finally:
        if temp_path:
            try:
                os.remove(temp_path)
            except OSError:
                pass
        await file.close()


@app.get("/api/workflows")
def get_workflows() -> Dict[str, Any]:
    """
    Get list of all workflow files.

    Returns:
        Dictionary with workflows list and count
    """
    if not config.workflows_dir.exists():
        return {"workflows": [], "count": 0}

    workflows = []
    for file_path in sorted(config.workflows_dir.glob("*.json")):
        if file_path.is_file():
            stat = file_path.stat()
            workflows.append({
                "filename": file_path.name,
                "size": stat.st_size,
                "modified": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat()
            })

    return {
        "workflows": workflows,
        "count": len(workflows)
    }


@app.get("/api/workflows/{filename}")
def get_workflow(filename: str) -> Dict[str, Any]:
    """
    Get a specific workflow file content.

    Args:
        filename: Name of the workflow file

    Returns:
        Workflow JSON content
    """
    safe_filename = sanitize_workflow_filename(filename)
    file_path = config.workflows_dir / safe_filename

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Workflow not found.")

    try:
        with file_path.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail="Workflow data corrupted.") from exc


@app.delete("/api/workflows/{filename}")
def delete_workflow(filename: str) -> Dict[str, str]:
    """
    Delete a workflow file.

    Args:
        filename: Name of the workflow file

    Returns:
        Status message
    """
    safe_filename = sanitize_workflow_filename(filename)
    file_path = config.workflows_dir / safe_filename

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Workflow not found.")

    try:
        file_path.unlink()
        return {"status": "deleted", "filename": safe_filename}
    except OSError as exc:
        raise HTTPException(status_code=500, detail="Failed to delete workflow.") from exc


# POST /api/projects - Create new project
@app.post("/api/projects")
async def create_project(
    background_tasks: BackgroundTasks,
    file: Optional[UploadFile] = File(None),
    name: str = Form(...)
) -> Dict[str, Any]:
    if not name or not name.strip():
        raise HTTPException(status_code=400, detail="Project name is required.")
    project_name = name.strip()[:200]
    project_id = str(uuid4())
    metadata_path = project_metadata_path(project_id)

    # If ZIP file provided, use existing ZIP method
    has_zip = False
    if file and file.filename:
        if not file.filename.lower().endswith('.zip'):
            raise HTTPException(status_code=400, detail="File must be a ZIP archive.")
        zip_path = project_zip_path(project_id)
        # Save ZIP with atomic write
        temp_zip_path = zip_path.with_suffix(".zip.tmp")
        try:
            with temp_zip_path.open("wb") as f:
                file.file.seek(0)
                shutil.copyfileobj(file.file, f)
            temp_zip_path.replace(zip_path)
            has_zip = True
        finally:
            await file.close()

    # Create project directory for granular file management
    project_dir = project_dir_path(project_id)
    project_dir.mkdir(parents=True, exist_ok=True)

    # Create metadata
    now = datetime.now(timezone.utc).isoformat()
    metadata = {"id": project_id, "name": project_name, "createdAt": now, "updatedAt": now}
    write_json(metadata_path, metadata)

    # If ZIP was uploaded, migrate and generate thumbnails (Background)
    if has_zip:
        from routers.projects import project_manager
        background_tasks.add_task(project_manager.initialize_project_from_zip, project_id)

    return metadata

# GET /api/projects - List all projects
@app.get("/api/projects")
def get_projects() -> Dict[str, Any]:
    projects = list_all_projects()
    return {"projects": projects, "count": len(projects)}

# GET /api/projects/{id} - Get project details
@app.get("/api/projects/{project_id}")
def get_project(project_id: str) -> Dict[str, Any]:
    metadata_path = project_metadata_path(project_id)
    if not metadata_path.exists():
        raise HTTPException(status_code=404, detail="Project not found.")
    try:
        with metadata_path.open("r", encoding="utf-8") as f:
            return json.load(f)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail="Project metadata corrupted.") from exc

# PUT /api/projects/{id} - Update project
@app.put("/api/projects/{project_id}")
async def update_project(
    project_id: str,
    file: UploadFile = File(...),
    name: str = Form(None)
) -> Dict[str, Any]:
    metadata_path = project_metadata_path(project_id)
    zip_path = project_zip_path(project_id)
    if not metadata_path.exists():
        raise HTTPException(status_code=404, detail="Project not found.")
    try:
        with metadata_path.open("r", encoding="utf-8") as f:
            metadata = json.load(f)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail="Project metadata corrupted.") from exc
    if name and name.strip():
        metadata["name"] = name.strip()[:200]
    # Save new ZIP atomically
    temp_zip_path = zip_path.with_suffix(".zip.tmp")
    try:
        with temp_zip_path.open("wb") as f:
            file.file.seek(0)
            shutil.copyfileobj(file.file, f)
        temp_zip_path.replace(zip_path)
    finally:
        await file.close()
    metadata["updatedAt"] = datetime.now(timezone.utc).isoformat()
    write_json(metadata_path, metadata)
    return metadata

# DELETE /api/projects/{id} - Delete project
@app.delete("/api/projects/{project_id}")
def delete_project(project_id: str) -> Dict[str, str]:
    metadata_path = project_metadata_path(project_id)
    zip_path = project_zip_path(project_id)
    project_dir = project_dir_path(project_id)

    if not metadata_path.exists() and not project_dir.exists():
        raise HTTPException(status_code=404, detail="Project not found.")
    try:
        if metadata_path.exists():
            metadata_path.unlink()
        if zip_path.exists():
            zip_path.unlink()
        # Delete project directory (including all files and .history)
        if project_dir.exists():
            shutil.rmtree(project_dir)
            
        # Delete thumbnails directory
        thumbnails_dir = config.thumbnails_dir / project_id
        if thumbnails_dir.exists():
            shutil.rmtree(thumbnails_dir)
    except OSError as exc:
        raise HTTPException(status_code=500, detail="Failed to delete project files.") from exc
    return {"status": "deleted", "id": project_id}


