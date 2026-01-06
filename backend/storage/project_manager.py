"""
Project Manager (V2) - ID-Based Architecture

This module manages project files using a manifest-based approach where
files are grouped into "Items" by UUID. It handles file operations,
manifest updates, and strict extension replacement logic.
"""

import json
import logging
import shutil
import uuid
import os
import zipfile
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

# Add imports for metadata extraction
try:
    import static_ffmpeg
    static_ffmpeg.add_paths()
    import subprocess
except ImportError:
    pass

from PIL import Image

from .history_manager import HistoryManager
from .thumbnail_manager import ThumbnailManager

logger = logging.getLogger(__name__)

from .concurrency import run_in_threadpool

class ProjectManager:
    """
    Manages project files and metadata using Manifest V2 (Item-based).
    """

    def __init__(self, projects_dir: Path, history_manager: HistoryManager):
        self.projects_dir = projects_dir
        self.history_manager = history_manager
        self.thumbnail_manager = ThumbnailManager()

    def _get_project_path(self, project_id: str) -> Path:
        return self.projects_dir / project_id

    def _get_item_path(self, project_id: str, item_id: str, extension: str) -> Path:
        """Get absolute path for an item's original file (UUID-based)."""
        return self._get_project_path(project_id) / f"{item_id}{extension}"

    def _get_preview_path(self, project_id: str, item_id: str, extension: str) -> Path:
        """Get absolute path for an item's preview file (UUID-based)."""
        return self._get_project_path(project_id) / "previews" / f"{item_id}{extension}"


    def _get_manifest_path(self, project_id: str) -> Path:
        return self._get_project_path(project_id) / "manifest.json"

    async def ensure_project_dir(self, project_id: str) -> Path:
        """Ensure project directory exists."""
        project_path = self._get_project_path(project_id)
        
        def _mkdir():
            project_path.mkdir(parents=True, exist_ok=True)
            (project_path / "previews").mkdir(exist_ok=True)
            (project_path / ".thumbnails").mkdir(exist_ok=True)
            return project_path
            
        return await run_in_threadpool(_mkdir)

    def project_exists(self, project_id: str) -> bool:
        """Check if project exists."""
        # This checks existence on disk. Sync for now? 
        # But ensure_manifest is async now. 
        # So this must be async ONLY if we check manifest validity.
        # But commonly existence check is fast.
        # Let's keep it sync for directory check BUT careful about I/O block.
        # Ideally: async def project_exists...
        # But router uses it before everything. 
        # Let's make it async to be safe.
        pass
    
    # Wait, replace_file_content replaces a block. I need to replace methods one by one or in group.
    
    async def project_exists(self, project_id: str) -> bool:
        """Check if project exists."""
        # Lightweight check
        path = self._get_project_path(project_id)
        if not await run_in_threadpool(path.exists):
            return False
        # Deep check?
        return (await self.ensure_manifest(project_id)) is not None

    def get_project_root(self, project_id: str) -> Path:
        """Get the absolute path to the project root."""
        return self._get_project_path(project_id)

    async def ensure_manifest(self, project_id: str) -> Dict[str, Any]:
        """
        Ensure manifest.json exists with V2 structure.
        """
        await self.ensure_project_dir(project_id)
        manifest_path = self._get_manifest_path(project_id)

    def _load_raw_manifest(self, project_id: str) -> Optional[Dict[str, Any]]:
        """Helpers to load manifest without side effects."""
        manifest_path = self._get_manifest_path(project_id)
        if manifest_path.exists():
            try:
                with open(manifest_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    if data.get("version") == 2 and "items" in data:
                        return data
            except json.JSONDecodeError:
                logger.warning(f"Corrupt manifest for project {project_id}")
        return None

    async def ensure_manifest(self, project_id: str) -> Dict[str, Any]:
        """
        Ensure manifest.json exists with V2 structure.
        """
        await self.ensure_project_dir(project_id)
        
        def _load():
            return self._load_raw_manifest(project_id)

        data = await run_in_threadpool(_load)
        data = await run_in_threadpool(_load)
        if data:
            # Check for migration need
            # If storage_format is not "id_v1", we trigger migration.
            if data.get("storage_format") != "id_v1":
                await self.migrate_project_structure(project_id)
                # Reload after migration (to get updated manifest on disk)
                # But migrate_project_structure modifies disk manifest.
                # Let's just reload it.
                data = await run_in_threadpool(_load)
            return data

        # Initialize V2 Manifest
        manifest = {
            "version": 2,
            "storage_format": "id_v1",
            "items": []
        }
        await self._save_manifest(project_id, manifest)
        return manifest

    async def migrate_project_structure(self, project_id: str):
        """
        Migrate a project from Filename-based (Legacy V2) to ID-based (V2.1).
        This is idempotent and safe to re-run.
        """
        project_path = await self.ensure_project_dir(project_id)
        # Avoid load_manifest loop: load raw directly
        def _load():
             return self._load_raw_manifest(project_id)
        manifest = await run_in_threadpool(_load)
        if not manifest:
             # Should not happen if ensure_manifest called it, but safe guard
             return
        
        previews_dir = project_path / "previews"
        previews_dir.mkdir(exist_ok=True)
        history_root = project_path / ".history"
        
        changed = False
        
        def _migrate_task():
            nonlocal changed
            for item in manifest["items"]:
                item_id = item["id"]
                base_name = item["base_name"]
                extensions = item.get("extensions", {})
                
                # 1. Migrate Original File
                if "original" in extensions:
                    ext = extensions["original"]
                    legacy_path = project_path / f"{base_name}{ext}"
                    new_path = project_path / f"{item_id}{ext}"
                    
                    if legacy_path.exists() and not new_path.exists():
                        legacy_path.replace(new_path)
                        changed = True
                        logger.info(f"Migrated original: {base_name} -> {item_id}")
                    elif legacy_path.exists() and new_path.exists():
                        # Conflict? Or maybe already copied?
                        # If content same, delete legacy.
                        # For safety, we assume new_path is the truth if it exists.
                        # Check size?
                        if legacy_path.stat().st_size == new_path.stat().st_size:
                            legacy_path.unlink()
                            changed = True
                        else:
                            logger.warning(f"Migration conflict for {base_name}: both files exist with different sizes.")

                # 2. Migrate Caption
                if "caption" in extensions:
                    ext = extensions["caption"]
                    legacy_path = project_path / f"{base_name}{ext}"
                    new_path = project_path / f"{item_id}{ext}"
                    
                    if legacy_path.exists() and not new_path.exists():
                        legacy_path.replace(new_path)
                        changed = True
                    elif legacy_path.exists() and new_path.exists():
                         legacy_path.unlink() # Assume id-based is newer/correct

                # 3. Migrate Preview
                if "preview" in extensions:
                    ext = extensions["preview"]
                    legacy_path = previews_dir / f"{base_name}{ext}"
                    new_path = previews_dir / f"{item_id}{ext}"
                    
                    if legacy_path.exists() and not new_path.exists():
                        legacy_path.replace(new_path)
                        changed = True
                    elif legacy_path.exists() and new_path.exists():
                        legacy_path.unlink()

                # 4. Migrate History Directory
                # Old: .history/{base_name}/...
                # New: .history/{item_id}/...
                if history_root.exists():
                    legacy_hist_dir = history_root / base_name
                    new_hist_dir = history_root / item_id
                    
                    if legacy_hist_dir.exists() and legacy_hist_dir.is_dir():
                        if not new_hist_dir.exists():
                            legacy_hist_dir.replace(new_hist_dir)
                            changed = True
                            logger.info(f"Migrated history: {base_name} -> {item_id}")
                        else:
                            # Merge? Or just ignore legacy if new exists?
                            # Simplest: if new exists, maybe we already migrated.
                            # But if legacy still there, maybe partial?
                            # Let's try to move content? Too complex.
                            # Just warn.
                            pass

        await run_in_threadpool(_migrate_task)
        
        # If we want to mark migration done, maybe update version in manifest?
        # But for now, we just rely on file existence check.
        # Mark migration as done by setting storage_format
        # Even if no files changed (e.g. empty project), we mark it to avoid re-scan.
        manifest["storage_format"] = "id_v1"
        await self._save_manifest(project_id, manifest)
        
        if changed:
            logger.info(f"Migration completed for project {project_id}")


    async def load_manifest(self, project_id: str) -> Dict[str, Any]:
        """Load manifest, ensuring it exists."""
        return await self.ensure_manifest(project_id)

    async def _save_manifest(self, project_id: str, manifest: Dict[str, Any]):
        """Save manifest to disk."""
        manifest_path = self._get_manifest_path(project_id)
        
        def _write():
            temp_path = manifest_path.with_suffix(".tmp")
            with open(temp_path, 'w', encoding='utf-8') as f:
                json.dump(manifest, f, indent=2)
            temp_path.replace(manifest_path)
            
        await run_in_threadpool(_write)

    def _find_item_by_base_name(self, items: List[Dict], base_name: str) -> Optional[Dict]:
        """Find an item in the list by its base_name."""
        for item in items:
            if item["base_name"] == base_name:
                return item
        return None
    
    def _find_item_by_id(self, items: List[Dict], item_id: str) -> Optional[Dict]:
        """Find an item in the list by its ID."""
        for item in items:
            if item["id"] == item_id:
                return item
        return None

    def _create_new_item(self, base_name: str) -> Dict[str, Any]:
        """Create a new Item structure."""
        now = datetime.now(timezone.utc).isoformat()
        return {
            "id": str(uuid.uuid4()),
            "base_name": base_name,
            "created_at": now,
            "last_modified": now,
            "extensions": {}
        }

    async def get_all_items(self, project_id: str) -> List[Dict[str, Any]]:
        """Get all items in the project."""
        manifest = await self.load_manifest(project_id)
        return manifest["items"]

    async def get_item(self, project_id: str, item_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific item by ID."""
        manifest = await self.load_manifest(project_id)
        return self._find_item_by_id(manifest["items"], item_id)

    async def ensure_thumbnail(
        self, 
        project_id: str, 
        item_id: str, 
        timestamp: Optional[str] = None, 
        subtype: str = "original"
    ) -> Optional[Path]:
        """
        Ensure thumbnail exists for the item.
        """
        project_path = await self.ensure_project_dir(project_id)
        
        # 1. History Mode
        if timestamp:
            # Source: Get version path from history manager
            source_path = await self.history_manager.get_version_path(project_id, item_id, timestamp, subtype)
            if not source_path or not source_path.exists():
                return None
                
            # Dest: .thumbnails/{item_id}_{subtype}_{timestamp}.webp
            thumb_filename = f"{item_id}_{subtype}_{timestamp}.webp"
            thumb_path = project_path / ".thumbnails" / thumb_filename
            
            # Check cache
            if thumb_path.exists():
                return thumb_path
                
            # Generate
            # generate_thumbnail is CPU/IO heavy
            if await run_in_threadpool(self.thumbnail_manager.generate_thumbnail, source_path, thumb_path):
                return thumb_path
            return None

        # 2. Current Mode (Backward Compatibility & V2)
        manifest = await self.load_manifest(project_id)
        item = self._find_item_by_id(manifest["items"], item_id)
        
        if not item:
            return None
            
        extensions = item["extensions"]
        # base_name = item["base_name"] # Not used for paths anymore
        
        # Try to generate from Original
        if "original" in extensions:
            # V2: Use ID-based path
            source_path = project_path / f"{item_id}{extensions['original']}"
            thumb_path = project_path / ".thumbnails" / f"{item_id}_original.webp"
            
            # Fallback for migration (if standard migration hasn't run yet? No, we mandate migration)
            if not source_path.exists():
                 # Try legacy name
                 legacy_path = project_path / f"{item['base_name']}{extensions['original']}"
                 if legacy_path.exists():
                     source_path = legacy_path

            if await run_in_threadpool(self.thumbnail_manager.generate_thumbnail, source_path, thumb_path):
                return thumb_path
                
        # Fallback to Preview
        if "preview" in extensions:
            previews_dir = project_path / "previews"
            source_path = previews_dir / f"{item_id}{extensions['preview']}"
            
            if not source_path.exists():
                legacy_path = previews_dir / f"{item['base_name']}{extensions['preview']}"
                if legacy_path.exists():
                    source_path = legacy_path

            thumb_path = project_path / ".thumbnails" / f"{item_id}_preview.webp"
            if await run_in_threadpool(self.thumbnail_manager.generate_thumbnail, source_path, thumb_path):
                return thumb_path
                
        return None

    # ----------------------------------------------------------------------
    # Metadata Operations (Async Support)
    # ----------------------------------------------------------------------

    def _probe_video_metadata(self, file_path: Path) -> Dict[str, Any]:
        """Probe video file using ffprobe (via static_ffmpeg)."""
        try:
            cmd = [
                "ffprobe",
                "-v", "error",
                "-print_format", "json",
                "-show_format",
                "-show_streams",
                str(file_path)
            ]
            # Timeout set to 30s to prevent hanging
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            if result.returncode != 0:
                logger.error(f"ffprobe failed for {file_path}: {result.stderr}")
                return {}

            data = json.loads(result.stdout)

            # Extract useful info
            meta = {}
            duration = None

            if "streams" in data:
                # Find video stream
                video_stream = next((s for s in data["streams"] if s["codec_type"] == "video"), None)
                if video_stream:
                    meta["width"] = int(video_stream.get("width", 0))
                    meta["height"] = int(video_stream.get("height", 0))

                    # Extract FPS (prefer r_frame_rate, fallback to avg_frame_rate)
                    fps_str = video_stream.get("r_frame_rate") or video_stream.get("avg_frame_rate")
                    if fps_str:
                        try:
                            num, den = fps_str.split("/")
                            fps = float(num) / float(den) if float(den) != 0 else 0
                            meta["fps"] = fps
                        except (ValueError, ZeroDivisionError):
                            pass

                    # Extract frame count
                    nb_frames = video_stream.get("nb_frames")
                    if nb_frames:
                        try:
                            meta["frameCount"] = int(float(nb_frames))
                        except ValueError:
                            pass

                    # Duration might be in stream or format
                    if "duration" in video_stream:
                        duration = float(video_stream["duration"])

            if "format" in data and "duration" in data["format"]:
                # Prefer format duration as it is container level
                duration = float(data["format"]["duration"])

            if duration is not None:
                # Use durationSec to match frontend MediaMetadata type
                meta["durationSec"] = duration

                # Calculate frame count if not present but we have fps and duration
                if "frameCount" not in meta and "fps" in meta:
                    meta["frameCount"] = int(round(duration * meta["fps"]))

            return meta
        except Exception as e:
            logger.error(f"Failed to probe video {file_path}: {e}")
            return {}

    def _extract_metadata(self, file_path: Path) -> Dict[str, Any]:
        """Extract metadata based on file extension."""
        ext = file_path.suffix.lower()
        
        # Image
        if ext in {'.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tiff'}:
            try:
                with Image.open(file_path) as img:
                    return {
                        "width": img.width,
                        "height": img.height,
                        "format": img.format
                    }
            except Exception as e:
                logger.warning(f"Failed to extract image metadata {file_path}: {e}")
                return {}

        # Video
        elif ext in {'.mp4', '.mov', '.avi', '.mkv', '.webm'}:
            return self._probe_video_metadata(file_path)
            
        return {}

    async def archive_project(self, project_id: str) -> Path:
        """
        Create a ZIP archive of the project.
        """
        project_path = await self.ensure_project_dir(project_id)
        manifest_path = self._get_manifest_path(project_id)
        
        # Load manifest to read file list (async)
        # But we need manifest dict inside the thread if needed?
        # Actually archive logic just reads files. 
        # We can pass manifest data into the thread function if we want to avoid async call inside thread.
        manifest = await self.load_manifest(project_id)
        
        def _create_zip():
            # Create a temporary file for the ZIP
            fd, zip_path_str = tempfile.mkstemp(suffix=".zip")
            os.close(fd)
            zip_path = Path(zip_path_str)
            
            try:
                with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
                    # 1. Add Manifest
                    if manifest_path.exists():
                        zf.write(manifest_path, arcname="manifest.json")
                    
                    # 2. Add Project Files (Restore Filenames)
                    for item in manifest["items"]:
                        item_id = item["id"]
                        base_name = item["base_name"]
                        extensions = item.get("extensions", {})
                        
                        # Original
                        if "original" in extensions:
                            ext = extensions["original"]
                            # ID-based path
                            file_path = project_path / f"{item_id}{ext}"
                            # Restore name for archive
                            archive_name = f"{base_name}{ext}"
                            
                            if file_path.exists():
                                zf.write(file_path, arcname=archive_name)
                            else:
                                logger.warning(f"Archive: File missing {file_path}")
                                
                        # Caption
                        if "caption" in extensions:
                            ext = extensions["caption"]
                            file_path = project_path / f"{item_id}{ext}"
                            archive_name = f"{base_name}{ext}"
                            
                            if file_path.exists():
                                zf.write(file_path, arcname=archive_name)
                                
                        # Preview (in previews/ subdir)
                        if "preview" in extensions:
                            ext = extensions["preview"]
                            file_path = project_path / "previews" / f"{item_id}{ext}"
                            archive_name = f"previews/{base_name}{ext}"
                            
                            if file_path.exists():
                                zf.write(file_path, arcname=archive_name)
                
                return zip_path
                
            except Exception as e:
                if zip_path.exists():
                    os.unlink(zip_path)
                raise e
                
        return await run_in_threadpool(_create_zip)
        
    async def update_item_metadata(self, project_id: str, item_id: str):
        """
        Background Task: Extract and update metadata for an item.
        Handles race conditions (item deleted) gracefully.
        """
        try:
            project_path = await self.ensure_project_dir(project_id)
            # Re-load manifest to get latest state
            manifest = await self.load_manifest(project_id)
            item = self._find_item_by_id(manifest["items"], item_id)
            
            if not item:
                logger.info(f"Metadata update skipped: Item {item_id} not found (deleted?)")
                return

            extensions = item.get("extensions", {})
            if "original" not in extensions:
                 logger.info(f"Metadata update skipped: Item {item_id} has no original file")
                 return
                 
            if "original" not in extensions:
                 logger.info(f"Metadata update skipped: Item {item_id} has no original file")
                 return
                 
            # base_name = item["base_name"]
            ext = extensions["original"]
            file_path = project_path / f"{item_id}{ext}"
            
            if not file_path.exists():
                logger.warning(f"Metadata update skipped: File {file_path} not found")
                return
                
            # heavy lifting (IO/CPU)
            metadata = await run_in_threadpool(self._extract_metadata, file_path)
            
            # Write back
            # Restart read-modify-write cycle to minimize window
            manifest = await self.load_manifest(project_id)
            item = self._find_item_by_id(manifest["items"], item_id)
            if item:
                item["metadata"] = metadata
                await self._save_manifest(project_id, manifest)
                logger.info(f"Metadata updated for item {item_id}")
                
        except Exception as e:
            logger.error(f"Error in update_item_metadata task: {e}")

    # ----------------------------------------------------------------------
    # File Operations
    # ----------------------------------------------------------------------

    async def save_media_file(self, project_id: str, filename: str, content: bytes, subtype: str = "original") -> str:
        """
        Save a media file (Item creation or update).
        """
        project_path = await self.ensure_project_dir(project_id)
        manifest = await self.load_manifest(project_id)
        items = manifest["items"]

        # Parse filename
        # Parse filename to get Base Name
        base_name = os.path.splitext(filename)[0]
        ext = os.path.splitext(filename)[1] # includes dot

        item = self._find_item_by_base_name(items, base_name)
        
        if not item:
            # Create new Item
            item = self._create_new_item(base_name)
            items.append(item)
            item_id = item["id"]
        else:
            item_id = item["id"]
            # EXTENSION REPLACEMENT CHECK
            old_ext = item["extensions"].get("original")
            if old_ext and old_ext != ext:
                # Delete old file (ID-based)
                old_filename = f"{item_id}{old_ext}"
                old_path = project_path / old_filename
                
                # Async unlink check
                def _unlink_old():
                     if old_path.exists():
                         try:
                             old_path.unlink()
                             logger.info(f"Deleted old original file: {old_filename} due to extension change")
                         except OSError as e:
                             logger.error(f"Failed to delete old file {old_filename}: {e}")
                
                await run_in_threadpool(_unlink_old)

        # Update metadata
        item["extensions"]["original"] = ext
        item["last_modified"] = datetime.now(timezone.utc).isoformat()
        
        # Save file to disk (UUID-based name)
        file_path = project_path / f"{item_id}{ext}"
        
        def _write():
             with open(file_path, 'wb') as f:
                 f.write(content)
                 
        await run_in_threadpool(_write)
            
        # Save Manifest
        await self._save_manifest(project_id, manifest)
        
        # History Backup
        await self.history_manager.backup_file(project_id, item_id, file_path, subtype="original")
        
        # Ensure thumbnail (Async)
        await self.ensure_thumbnail(project_id, item_id)
        
        return item_id

    async def save_caption_for_media(self, project_id: str, media_filename: str, content: str):
        """
        Save a caption for a media file.
        """
        project_path = await self.ensure_project_dir(project_id)
        manifest = await self.load_manifest(project_id)
        
        base_name = os.path.splitext(media_filename)[0]
        
        item = self._find_item_by_base_name(manifest["items"], base_name)
        if not item:
            raise ValueError(f"Item not found for base_name: {base_name}")

        # Caption always .txt
        ext = ".txt"

        # Read existing caption content if file exists
        existing_content = ""
        old_ext = item["extensions"].get("caption")
        
        # Async read check
        async def _read_existing():
            content = ""
            if old_ext:
                # ID-Based path
                old_caption_path = project_path / f"{item['id']}{old_ext}"
                if old_caption_path.exists():
                    try:
                        # use threadpool for read? yes technically IO
                         def _r():
                             with open(old_caption_path, 'r', encoding='utf-8') as f:
                                 return f.read()
                         content = await run_in_threadpool(_r)
                    except OSError:
                        pass
            return content

        existing_content = await _read_existing()

        # Check if content actually changed
        content_changed = existing_content != content

        # Cleanup old if ext changed (unlikely for caption but for consistency)
        if old_ext and old_ext != ext:
             # Delete old caption file
             old_cap_name = f"{item['id']}{old_ext}"
             old_path = project_path / old_cap_name
             
             def _unlink_old():
                  if old_path.exists():
                      try:
                          old_path.unlink()
                      except OSError:
                          pass
             await run_in_threadpool(_unlink_old)

        item["extensions"]["caption"] = ext
        item["last_modified"] = datetime.now(timezone.utc).isoformat()
        
        caption_filename = f"{item['id']}{ext}"
        file_path = project_path / caption_filename

        # Only write file and save manifest if content changed
        if content_changed:
            def _write():
                 with open(file_path, 'w', encoding='utf-8') as f:
                     f.write(content)
            await run_in_threadpool(_write)

            await self._save_manifest(project_id, manifest)

            # History Backup
            if content:
                await self.history_manager.backup_file(project_id, item["id"], file_path, subtype="caption")

    async def save_preview_for_media(self, project_id: str, media_filename: str, content: bytes, preview_extension: str):
        """
        Save a preview image for a media file.
        """
        project_path = await self.ensure_project_dir(project_id)
        previews_dir = project_path / "previews"
        
        # Ensure previews dir (it's cheap)
        def _mkdir():
             previews_dir.mkdir(exist_ok=True)
        await run_in_threadpool(_mkdir)
        
        manifest = await self.load_manifest(project_id)
        base_name = os.path.splitext(media_filename)[0]
        
        item = self._find_item_by_base_name(manifest["items"], base_name)
        if not item:
            raise ValueError(f"Item not found for base_name: {base_name}")
            
        # EXTENSION REPLACEMENT CHECK
        old_ext = item["extensions"].get("preview")
        if old_ext and old_ext != preview_extension:
            old_preview_name = f"{item['id']}{old_ext}"
            old_path = previews_dir / old_preview_name
            
            def _unlink_old():
                 if old_path.exists():
                     try:
                         old_path.unlink()
                         logger.info(f"Deleted old preview file: {old_preview_name}")
                     except OSError:
                         pass
            await run_in_threadpool(_unlink_old)
                    
        item["extensions"]["preview"] = preview_extension
        item["last_modified"] = datetime.now(timezone.utc).isoformat()
        
        preview_filename = f"{item['id']}{preview_extension}"
        file_path = previews_dir / preview_filename
        
        def _write():
             with open(file_path, 'wb') as f:
                 f.write(content)
        await run_in_threadpool(_write)
            
        await self._save_manifest(project_id, manifest)
        
        # History Backup
        await self.history_manager.backup_file(project_id, item["id"], file_path, subtype="preview")
        
        # Ensure Thumbnail
        # If we just saved a preview, we might want to update the thumbnail if it came from preview
        # Or just ensure it exists.
        await self.ensure_thumbnail(project_id, item["id"])

    async def rename_item(self, project_id: str, item_id: str, new_base_name: str):
        """
        Rename an item and all its associated files.
        """
        project_path = await self.ensure_project_dir(project_id)
        previews_dir = project_path / "previews"
        
        manifest = await self.load_manifest(project_id)
        item = self._find_item_by_id(manifest["items"], item_id)
        
        if not item:
            raise ValueError("Item not found")
            
        old_base_name = item["base_name"]
        if old_base_name == new_base_name:
            return

        # Check for collision (Metadata only)
        if self._find_item_by_base_name(manifest["items"], new_base_name):
            raise ValueError(f"Item with name '{new_base_name}' already exists")

        # Rename: ONLY Metadata update!
        # No disk IO for ID-based storage.

        # Update Manifest
        item["base_name"] = new_base_name
        item["last_modified"] = datetime.now(timezone.utc).isoformat()
        
        await self._save_manifest(project_id, manifest)

    async def delete_item(self, project_id: str, item_id: str):
        """
        Delete an item and all its associated files and history.
        """
        project_path = await self.ensure_project_dir(project_id)
        previews_dir = project_path / "previews"
        
        manifest = await self.load_manifest(project_id)
        item = self._find_item_by_id(manifest["items"], item_id)
        
        if not item:
            logger.warning(f"Attempted to delete non-existent item {item_id}")
            return # Idempotent

        base_name = item["base_name"]
        extensions = item["extensions"]
        
        def _delete():
            # 1. Delete Files (UUID based)
            if "original" in extensions:
                path = project_path / f"{item_id}{extensions['original']}"
                if path.exists():
                    path.unlink()
                    
            if "caption" in extensions:
                path = project_path / f"{item_id}{extensions['caption']}"
                if path.exists():
                    path.unlink()
                    
            if "preview" in extensions:
                path = previews_dir / f"{item_id}{extensions['preview']}"
                if path.exists():
                    path.unlink()
            
            # Delete Thumbnails
            thumbnails_dir = project_path / ".thumbnails"
            if thumbnails_dir.exists():
                for thumb in thumbnails_dir.glob(f"{item_id}_*.webp"):
                    try:
                        thumb.unlink()
                    except OSError:
                        pass
                        
        await run_in_threadpool(_delete)

        # 2. Delete History
        await self.history_manager.delete_all_history(project_id, item_id)
        
        # 3. Remove from Manifest
        manifest["items"] = [i for i in manifest["items"] if i["id"] != item_id]
        await self._save_manifest(project_id, manifest)

    async def sync_items(self, project_id: str, sync_files: List[Dict[str, str]], deleted_items: List[str] = None, force: bool = False):
        """
        Sync manifest with new order, file names, and deletions.
        """
        if deleted_items is None:
            deleted_items = []

        project_path = await self.ensure_project_dir(project_id)
        previews_dir = project_path / "previews"
        manifest = await self.load_manifest(project_id)
        
        current_items = {item["id"]: item for item in manifest["items"]}
        current_ids = set(current_items.keys())
        
        sync_ids = set(f["id"] for f in sync_files)
        # Handle None for deleted_items
        deleted_ids_set = set(deleted_items) if deleted_items else set()
        
        # 1. Validation (Integrity Check)
        
        # 1.1 Overlap Check (Strict even with force)
        if not sync_ids.isdisjoint(deleted_ids_set):
            raise ValueError(f"Overlap detected: Items cannot be in both 'files' and 'deleted_items'. Intersection: {sync_ids & deleted_ids_set}")
            
        request_total_ids = sync_ids | deleted_ids_set
        
        unknown_ids = request_total_ids - current_ids
        missing_ids = current_ids - request_total_ids
        
        if force:
            # Force Sync Logic
            
            # A. Handle Unknown IDs (Ignore them)
            if unknown_ids:
                logger.warning(f"Force Sync (Project {project_id}): Ignoring unknown IDs: {unknown_ids}")
                sync_files[:] = [f for f in sync_files if f["id"] in current_ids]
                if deleted_items:
                    deleted_items[:] = [d for d in deleted_items if d in current_ids]

            # B. Handle Missing IDs (Implicit Delete)
            if missing_ids:
                logger.warning(f"Force Sync (Project {project_id}): Auto-deleting missing IDs: {missing_ids}")
                if deleted_items is None:
                    deleted_items = []
                deleted_items.extend(list(missing_ids))
        
        else:
            # Strict Logic (Default)
            
            # 1.2 Unknown ID Check
            if unknown_ids:
                 raise ValueError(f"Inventory mismatch: Request contains unknown items: {unknown_ids}")

            # 1.3 Partial Mismatch Check
            if missing_ids:
                 raise ValueError(f"Inventory mismatch: Request missing items (must be in files or deleted_items): {missing_ids}")

        # 2. Process Deletions
        # execute deletion before renaming to avoid conflicts? 
        # Actually it's safer to delete first.

        # However, delete_item modifies manifest in memory and saves it. 
        # But we modify manifest here later for reordering.
        # If we call self.delete_item, it will reload manifest or modify it. 
        # self.delete_item saves manifest.
        # We should probably do deletion logic manually here to verify transaction *before* saving manifest?
        # But `delete_item` handles file cleanup.
        # Let's call self.delete_item sequentially. 
        # Note: self.delete_item updates manifest on disk. 
        # This might cause race condition if we hold `manifest` in memory here?
        # `manifest` variable here is just a dict.
        # If we call delete_item, it reads/writes manifest.
        # If we then proceed to use `manifest` (the variable), it is stale!
        # We should NOT use `manifest` variable after calling `delete_item` without reloading.
        # OR: We manipulate `manifest` variable here and do file deletion manually, then save once.
        # `delete_item` helper on disk:
        
        # Strategy: 
        # A. Call delete_item for each. Then RELOAD manifest for the rename/reorder phase.
        
        if deleted_items:
            for item_id in deleted_items:
                await self.delete_item(project_id, item_id)
            
            # RELOAD Manifest because delete_item modified it
            manifest = await self.load_manifest(project_id)
            current_items = {item["id"]: item for item in manifest["items"]}
            # Note: current_items now only contains surviving items.
            
        # 3. Analyze Renames and Check Collisions (on surviving items)
        renames = [] # List of (item_id, old_base, new_base)
        proposed_base_names = set()
        
        for entry in sync_files:
            item_id = entry["id"]
            filename = entry["filename"]
            
            # Derive new base name
            new_base = os.path.splitext(filename)[0]
            
            # Check for duplicates in proposed state
            if new_base in proposed_base_names:
                raise ValueError(f"Duplicate filename in sync request: {new_base}")
            proposed_base_names.add(new_base)
            
            item = current_items[item_id]
            if item["base_name"] != new_base:
                renames.append((item_id, item["base_name"], new_base))

        # 4. Execute Renames (Safe Shuffle via Temporary Names)
        if renames:
            # Phase 1: Rename all targets to temporary UUID-based names
            temp_map = {} # item_id -> temp_base_name
            
            for item_id, old_base, new_base in renames:
                item = current_items[item_id]
                temp_base = f"temp_{uuid.uuid4().hex}"
                temp_map[item_id] = temp_base
                
                await self._rename_files_on_disk(project_path, previews_dir, item["extensions"], old_base, temp_base)
                item["base_name"] = temp_base # Update in memory temporarily
                
            # Phase 2: Rename from temp to final new_base
            for item_id, old_base, new_base in renames:
                item = current_items[item_id] # item['base_name'] is now temp_base
                temp_base = temp_map[item_id]
                
                await self._rename_files_on_disk(project_path, previews_dir, item["extensions"], temp_base, new_base)
                item["base_name"] = new_base # Final update
                item["last_modified"] = datetime.now(timezone.utc).isoformat()

        # 5. Reconstruct Manifest (Apply Order)
        new_items_list = []
        for entry in sync_files:
            item = current_items[entry["id"]]
            new_items_list.append(item)
            
        manifest["items"] = new_items_list
        await self._save_manifest(project_id, manifest)

    async def _rename_files_on_disk(self, project_path: Path, previews_dir: Path, extensions: Dict[str, str], old_base: str, new_base: str):
        """Helper to rename all files for an item from old_base to new_base."""
        
        def _rename():
            # 1. Original
            if "original" in extensions:
                ext = extensions["original"]
                old_p = project_path / f"{old_base}{ext}"
                new_p = project_path / f"{new_base}{ext}"
                if old_p.exists():
                    old_p.rename(new_p)
                    
            # 2. Caption
            if "caption" in extensions:
                ext = extensions["caption"]
                old_p = project_path / f"{old_base}{ext}"
                new_p = project_path / f"{new_base}{ext}"
                if old_p.exists():
                    old_p.rename(new_p)
                    
            # 3. Preview
            if "preview" in extensions:
                ext = extensions["preview"]
                old_p = previews_dir / f"{old_base}{ext}"
                new_p = previews_dir / f"{new_base}{ext}"
                if old_p.exists():
                    old_p.rename(new_p)
        
        await run_in_threadpool(_rename)
