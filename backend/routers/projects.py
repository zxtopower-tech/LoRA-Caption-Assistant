"""
Project-specific API routes for ID-based file management (Manifest V2).

Routes:
    GET    /api/projects/{id}/items             List all items
    POST   /api/projects/{id}/items             Upload new item (implied safe rename)
    POST   /api/projects/{id}/items/{item_id}/caption  Upload/Update caption
    POST   /api/projects/{id}/items/{item_id}/preview  Upload/Update preview
    PUT    /api/projects/{id}/items/{item_id}/rename   Rename item
    DELETE /api/projects/{id}/items/{item_id}   Delete item
    GET    /api/projects/{id}/items/{item_id}/history  Get item history (all files)
    
    GET    /api/projects/{id}/thumbnails/{item_id}  Get thumbnail
"""

import os
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, HTTPException, UploadFile, Form, Query, BackgroundTasks
from fastapi.responses import FileResponse
from pydantic import BaseModel

from config import get_config
from storage.concurrency import get_queue_manager
from storage.file_operations import safe_filename
from storage.history_manager import HistoryManager
from storage.project_manager import ProjectManager

# Initialize managers
_config = get_config()
history_manager = HistoryManager(_config.projects_dir)
project_manager = ProjectManager(_config.projects_dir, history_manager)

queue_manager = get_queue_manager()

router = APIRouter(prefix="/api/projects", tags=["projects"])

# =============================================================================
# Helper Models
# =============================================================================

# =============================================================================
# Helper Models
# =============================================================================

class RenameRequest(BaseModel):
    new_base_name: str

class BulkCaptionRequest(BaseModel):
    captions: dict[str, str] # item_id -> caption content

class ManifestEntry(BaseModel):
    id: str
    filename: str

class ManifestSyncRequest(BaseModel):
    files: List[ManifestEntry]

class ItemResponse(BaseModel):
    id: str
    base_name: str
    extensions: dict[str, str]
    created_at: str
    last_modified: str
    thumbnail_url: str
    files: dict[str, str] # type -> url
    caption_content: Optional[str] = None
    size: int = 0

# =============================================================================
# Endpoints
# =============================================================================

@router.get("/{project_id}/download")
async def download_project(project_id: str, background_tasks: BackgroundTasks):
    """Download project as ZIP."""
    if not await project_manager.project_exists(project_id):
        raise HTTPException(status_code=404, detail="Project not found")

    try:
        # Generate ZIP
        zip_path = await project_manager.archive_project(project_id)
        
        # Helper to delete file after response
        def _cleanup():
            try:
                if zip_path.exists():
                    os.unlink(zip_path)
            except OSError:
                pass
                
        background_tasks.add_task(_cleanup)
        
        return FileResponse(
            zip_path, 
            media_type="application/zip", 
            filename=f"project_{project_id}.zip"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{project_id}/items")
async def list_items(project_id: str):
    """List all items in the project with full metadata for frontend."""
    if not await project_manager.project_exists(project_id):
        raise HTTPException(status_code=404, detail="Project not found")

    items = await project_manager.get_all_items(project_id)
    project_root = project_manager.get_project_root(project_id)
    response = []
    
    for item in items:
        item_id = item["id"]
        base_name = item["base_name"]
        
        # Construct URLs and Metadata
        files = {}
        caption_content = ""
        size = 0
        
        # 1. URLs
        for role, ext in item["extensions"].items():
            filename = f"{base_name}{ext}"
            if role == "preview":
                 files[role] = f"/static/projects/{project_id}/previews/{filename}"
            else:
                 files[role] = f"/static/projects/{project_id}/{filename}"
                 
            # 2. Size (from original)
            if role == "original":
                try:
                    # Sync call stat() is fast, but ideally run_in_threadpool if strictly async
                    size = (project_root / filename).stat().st_size
                except OSError:
                    pass
            
            # 3. Caption Content
            # Reading small caption files: blocking but fast. 
            # If we want pure async, we should use run_in_threadpool or pm helper.
            # But here we are iterating. 
            # For strictness, let's leave it as sync IO in loop for now as captions are small.
            # Or better, ProjectManager should provide "get_item_metadata" that includes this?
            # V2 design implies lightweight listing. Content fetching should be separate?
            # But frontend expects content.
            # Let's keep it sync here for simplicity unless it blocks visibly.
            if role == "caption":
                try:
                    with open(project_root / filename, "r", encoding="utf-8") as f:
                        caption_content = f.read()
                except OSError:
                    pass

        response.append({
            **item,
            "thumbnail_url": f"/api/projects/{project_id}/thumbnails/{item_id}",
            "files": files,
            "caption_content": caption_content,
            "size": size
        })
        
    return {"items": response}

@router.post("/{project_id}/items")
async def upload_new_item(
    project_id: str,
    file: UploadFile,
    background_tasks: BackgroundTasks,
    preview: Optional[UploadFile] = None,
    caption: Optional[str] = Form(None),
):
    # Note: `background_tasks` in param default value is dangerous if mutable, but here it's dependency injection syntax?
    # Actually FastAPI dependency injection handles `background_tasks: BackgroundTasks`.
    
    """
    Upload a new media file. Can also include preview and caption.
    """
    if not await project_manager.project_exists(project_id):
        raise HTTPException(status_code=404, detail="Project not found")
        
    safe_name = safe_filename(file.filename)
    
    async def _upload():
        # 1. Save Original
        content = await file.read()
        item_id = await project_manager.save_media_file(project_id, safe_name, content, subtype="original")

        # 2. Extract metadata immediately
        await project_manager.update_item_metadata(project_id, item_id)

        # 3. Save Preview if provided
        if preview:
             p_content = await preview.read()
             p_ext = Path(preview.filename).suffix
             if not p_ext: p_ext = ".png"
             
             item = await project_manager.get_item(project_id, item_id)
             if item:
                 proxy_name = item["base_name"] 
                 await project_manager.save_preview_for_media(project_id, proxy_name, p_content, p_ext)

        # 4. Save Caption if provided
        if caption:
             item = await project_manager.get_item(project_id, item_id)
             if item:
                 proxy_name = item["base_name"]
                 await project_manager.save_caption_for_media(project_id, proxy_name, caption)

        # 5. Fetch updated item with metadata and return it
        item = await project_manager.get_item(project_id, item_id)
        return {
            "id": item_id,
            "status": "saved",
            "metadata": item.get("metadata") if item else None
        }

    # Use filename as lock key
    result = await queue_manager.execute_file_operation(project_id, safe_name, _upload)

    if result and "id" in result:
        background_tasks.add_task(project_manager.ensure_thumbnail, project_id, result["id"])

    return result

@router.post("/{project_id}/items/{item_id}/caption")
async def upload_caption(
    project_id: str,
    item_id: str,
    caption: str = Form(...) 
):
    """Update caption for an item."""
    if not await project_manager.project_exists(project_id):
        raise HTTPException(status_code=404, detail="Project not found")
        
    async def _save_caption():
        item = await project_manager.get_item(project_id, item_id)
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")
            
        proxy_filename = item["base_name"] 
        await project_manager.save_caption_for_media(project_id, proxy_filename, caption)
        return {"status": "saved"}
        
    return await queue_manager.execute_file_operation(project_id, item_id, _save_caption)

@router.put("/{project_id}/captions")
async def bulk_update_captions(project_id: str, request: BulkCaptionRequest):
    """Bulk update captions."""
    if not await project_manager.project_exists(project_id):
        raise HTTPException(status_code=404, detail="Project not found")

    async def _bulk_save():
        # Iterate and save.
        count = 0
        for item_id, caption_text in request.captions.items():
            item = await project_manager.get_item(project_id, item_id)
            if item:
                await project_manager.save_caption_for_media(project_id, item["base_name"], caption_text)
                count += 1
        return {"status": "success", "updated": count}

    # Lock on project level? Or just run it. 
    return await queue_manager.execute_file_operation(project_id, "bulk_caption_update", _bulk_save)

@router.post("/{project_id}/manifest")
async def sync_project_manifest(project_id: str, request: ManifestSyncRequest):
    """
    Sync manifest with new file names/order.
    Handles reordering and renaming (Safe Shuffle).
    """
    if not await project_manager.project_exists(project_id):
        raise HTTPException(status_code=404, detail="Project not found")

    # Convert Pydantic model to list of dicts
    file_list = [entry.model_dump() for entry in request.files]

    # Use queue to ensure atomic access to manifest
    async def _sync():
        try:
            await project_manager.sync_items(project_id, file_list)
            return {"status": "synced"}
        except ValueError as e:
            # ID missing or conflict
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    return await queue_manager.execute_file_operation(
        project_id, "manifest", _sync
    )

@router.post("/{project_id}/items/{item_id}/preview")
async def upload_preview(
    project_id: str,
    item_id: str,
    file: UploadFile,
    background_tasks: BackgroundTasks
):
    """Update preview for an item."""
    if not await project_manager.project_exists(project_id):
        raise HTTPException(status_code=404, detail="Project not found")
        
    async def _save_preview():
        item = await project_manager.get_item(project_id, item_id)
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")
            
        content = await file.read()
        ext = Path(file.filename).suffix
        if not ext: ext = ".png" # default
        
        proxy_filename = item["base_name"]
        
        await project_manager.save_preview_for_media(project_id, proxy_filename, content, ext)
        return {"status": "saved"}

    result = await queue_manager.execute_file_operation(project_id, item_id, _save_preview)
    
    if result and result.get("status") == "saved":
         background_tasks.add_task(project_manager.ensure_thumbnail, project_id, item_id)
         
    return result

@router.post("/{project_id}/comfy-preview")
async def upload_comfy_preview(
    project_id: str,
    file: UploadFile,
    background_tasks: BackgroundTasks,
    original_filename: str = Form(...),
):
    """
    Upload a preview generated by ComfyUI.
    """
    if not await project_manager.project_exists(project_id):
        raise HTTPException(status_code=404, detail="Project not found")
        
    async def _save_preview():
        content = await file.read()
        ext = Path(file.filename).suffix
        if not ext: ext = ".png" # default
        
        try:
            await project_manager.save_preview_for_media(project_id, original_filename, content, ext)
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))
            
        return {"status": "saved", "original_filename": original_filename}

    # Execute with file lock
    result = await queue_manager.execute_file_operation(project_id, original_filename, _save_preview)
    
    if result and result.get("status") == "saved":
         # Look up item ID to trigger thumbnail generation
         manifest = await project_manager.load_manifest(project_id)
         base_name = os.path.splitext(original_filename)[0]
         item = project_manager._find_item_by_base_name(manifest["items"], base_name)
         if item:
             background_tasks.add_task(project_manager.ensure_thumbnail, project_id, item["id"])

    return result



@router.put("/{project_id}/items/{item_id}/rename")
async def rename_item(project_id: str, item_id: str, request: RenameRequest):
    """Rename an item."""
    if not await project_manager.project_exists(project_id):
        raise HTTPException(status_code=404, detail="Project not found")
        
    async def _rename():
        try:
            await project_manager.rename_item(project_id, item_id, request.new_base_name)
            return {"status": "renamed", "new_base_name": request.new_base_name}
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
            
    return await queue_manager.execute_file_operation(project_id, item_id, _rename)

@router.delete("/{project_id}/items/{item_id}")
async def delete_item(project_id: str, item_id: str):
    """Delete an item."""
    if not await project_manager.project_exists(project_id):
        raise HTTPException(status_code=404, detail="Project not found")

    async def _delete():
        await project_manager.delete_item(project_id, item_id)
        return {"status": "deleted"}
        
    return await queue_manager.execute_file_operation(project_id, item_id, _delete)

@router.get("/{project_id}/items/{item_id}/history")
async def get_item_history(project_id: str, item_id: str):
    """Get history for an item (all subtypes)."""
    if not await project_manager.project_exists(project_id):
        raise HTTPException(status_code=404, detail="Project not found")
        
    # Check item exists
    item = await project_manager.get_item(project_id, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    aggregated_history = []
    
    # Iterate over all possible subtypes
    for subtype in ["original", "caption", "preview"]:
        versions = await history_manager.list_versions(project_id, item_id, subtype=subtype)
        for v in versions:
            v["subtype"] = subtype
            
            # Inject thumbnail_url for media types
            if subtype in ["original", "preview"] and v.get("is_available"):
                v["thumbnail_url"] = f"/api/projects/{project_id}/thumbnails/{item_id}?history_timestamp={v['timestamp']}&subtype={subtype}"
                
            aggregated_history.append(v)
            
    # Sort by timestamp descending
    aggregated_history.sort(key=lambda x: x["timestamp"], reverse=True)
    
    return {
        "item_id": item_id,
        "history": aggregated_history
    }

@router.get("/{project_id}/thumbnails/{item_id}")
async def get_thumbnail(
    project_id: str, 
    item_id: str,
    history_timestamp: Optional[str] = Query(None),
    subtype: str = Query("original")
):
    """Get thumbnail for item."""
    if not await project_manager.project_exists(project_id):
        raise HTTPException(status_code=404, detail="Project not found")
        
    path = await project_manager.ensure_thumbnail(
        project_id, 
        item_id, 
        timestamp=history_timestamp, 
        subtype=subtype
    )
    if not path or not path.exists():
        raise HTTPException(status_code=404, detail="Thumbnail not available")
        
    return FileResponse(path, media_type="image/webp")

