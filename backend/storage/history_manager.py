"""
Version history management with deduplication and rotation.

This module provides:
- File version backup with deduplication
- Text files: full history (no rotation)
- Media files: rotation (keep last N versions)
- Version listing and restoration
- Project-level point-in-time recovery

History storage structure:
.history/{filename}/{timestamp}
"""

import base64
import logging
import os
import shutil
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

from .file_operations import (
    atomic_write,
    compute_hash,
    is_media_file,
    is_text_file,
)
from .concurrency import run_in_threadpool


@dataclass
class BackupResult:
    """Result of a backup operation."""
    status: str  # "backed_up", "skipped", "error"
    timestamp: Optional[str] = None
    reason: Optional[str] = None
    previous_hash: Optional[str] = None


class HistoryManager:
    """
    Manages version history for project files.

    History storage structure:
    .history/{filename}/{timestamp}

    Examples:
    .history/item_image01.jpg/20251226_180127_392499
    .history/item_image01.txt/20251226_180133_432037
    .history/previews/item_image01.png/20251226_180140_123456
    """

    def __init__(self, projects_dir: Path):
        """
        Initialize HistoryManager.

        Args:
            projects_dir: Base directory containing projects
        """
        self._projects_dir = projects_dir

    def _history_dir(self, project_id: str) -> Path:
        """Get the .history directory for a project."""
        return self._projects_dir / project_id / ".history"

    def _file_history_dir(self, project_id: str, file_id: str, subtype: str = "original") -> Path:
        """Get the history directory for a specific file and subtype.
        
        Args:
            project_id: Project UUID
            file_id: File UUID
            subtype: "original", "preview", or "caption"

        Returns: .history/{file_id}/{subtype} (or just .history/{file_id} for migration simplicity if needed, but let's separate)
        
        New Structure:
        .history/{UUID}/original/{timestamp}
        .history/{UUID}/preview/{timestamp}
        .history/{UUID}/caption/{timestamp}
        """
        # Note: If we want to keep it flat for "original" to match previous behavior (easier migration?), 
        # we could do: if subtype == "original": return base / file_id
        # But separating is cleaner. Let's use subdirectories.
        return self._history_dir(project_id) / file_id / subtype

    def _generate_timestamp(self) -> str:
        """Generate ISO 8601 sortable timestamp with microseconds."""
        return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S_%f")

    def _parse_timestamp(self, filename: str) -> str:
        """Extract timestamp from history filename.

        History files are named: TIMESTAMP{EXTENSION}
        This method strips the extension and returns the timestamp only.
        """
        # Remove extension if present
        if "." in filename:
            return filename.rsplit(".", 1)[0]
        return filename

    def _find_version_path(self, history_dir: Path, timestamp: str) -> Optional[Path]:
        """Find the actual backup file path for a given timestamp.

        Since files are stored with extensions (e.g., 20240101_120000_000000.jpg),
        we need to find the file that matches the timestamp.

        Args:
            history_dir: The history directory to search in
            timestamp: The timestamp (without extension) to find

        Returns:
            Path to the backup file, or None if not found
        """
        if not history_dir.exists():
            return None

        # Try to find a file that starts with the timestamp
        for ext in ["", ".jpg", ".jpeg", ".png", ".gif", ".txt", ".json", ".csv", ".md"]:
            candidate = history_dir / f"{timestamp}{ext}"
            if candidate.exists():
                return candidate

        # Fallback: glob to find any file starting with timestamp
        for candidate in history_dir.glob(f"{timestamp}.*"):
            if candidate.is_file():
                return candidate

        return None

    async def backup_file(
        self,
        project_id: str,
        file_id: str,
        source_path: Optional[Path] = None,
        force: bool = False,
        subtype: str = "original",
        filename_for_legacy_lookup: Optional[str] = None
    ) -> BackupResult:
        """
        Backup a file to history with deduplication.
        """
        # print(f"[DEBUG] backup_file called for project={project_id}, file={file_id}, subtype={subtype}")
        if source_path is None:
            return BackupResult(status="error", reason="source_path required")
            
        current_file = source_path

        # Check if current file exists
        if not current_file.exists():
            return BackupResult(
                status="error",
                reason=f"Current file does not exist: {current_file}"
            )

        # For preview/caption, verify original backup exists
        if subtype in ("preview", "caption"):
            original_history_dir = self._file_history_dir(project_id, file_id, "original")
            if not original_history_dir.exists():
                return BackupResult(
                    status="error",
                    reason=f"Original backup required before {subtype} backup (no original backup directory found)"
                )
            
            # Check backups presence async
            def _check_orig_backups():
                return list(original_history_dir.glob("*"))
            
            original_backups = await run_in_threadpool(_check_orig_backups)
            if not original_backups:
                return BackupResult(
                    status="error",
                    reason=f"Original backup required before {subtype} backup (no original backups found)"
                )

        # Compute current hash
        try:
            current_hash = await run_in_threadpool(compute_hash, current_file)
        except OSError as e:
            return BackupResult(
                status="error",
                reason=f"Failed to compute hash: {e}"
            )

        # Check deduplication (unless force=True)
        if not force:
            latest_backup = await self._get_latest_backup(project_id, file_id, subtype)
            if latest_backup:
                try:
                    backup_hash = await run_in_threadpool(compute_hash, latest_backup)
                    if current_hash == backup_hash:
                        return BackupResult(
                            status="skipped",
                            reason="Content unchanged (deduplication)",
                            previous_hash=current_hash,
                        )
                except OSError:
                    pass

        # Create backup
        timestamp = self._generate_timestamp()
        extension = current_file.suffix if current_file.suffix else ""
        history_file_dir = self._file_history_dir(project_id, file_id, subtype)
        
        # IO: mkdir
        await run_in_threadpool(lambda: history_file_dir.mkdir(parents=True, exist_ok=True))

        # Check for duplicate timestamp
        backup_path = history_file_dir / f"{timestamp}{extension}"
        if backup_path.exists():
             return BackupResult(
                status="error",
                reason=f"Backup with timestamp {timestamp} already exists"
            )

        try:
            await run_in_threadpool(shutil.copy2, current_file, backup_path)
        except OSError as e:
            return BackupResult(
                status="error",
                reason=f"Failed to create backup: {e}"
            )

        return BackupResult(
            status="backed_up",
            timestamp=timestamp,
            previous_hash=current_hash,
        )

    async def _get_latest_backup(self, project_id: str, file_id: str, subtype: str = "original") -> Optional[Path]:
        """Get the most recent backup for a file."""
        history_dir = self._file_history_dir(project_id, file_id, subtype)
        if not history_dir.exists():
            return None

        # Get all files, sort by modification time (newest first)
        def _list_files():
             if not history_dir.exists(): return []
             return list(history_dir.glob("*"))
             
        files = await run_in_threadpool(_list_files)
        if not files:
            return None

        # Sorting might be fast enough, but if many files, blocking? 
        # Typically history version count is small (rotated).
        files.sort(key=lambda p: p.stat().st_mtime, reverse=True)
        return files[0]

    async def get_latest_version_content(self, project_id: str, file_id: str, subtype: str = "original") -> Optional[str]:
        """
        Get content of the most recent backup version.

        Args:
            project_id: Project UUID
            file_id: File UUID
            subtype: "original", "preview", or "caption"

        Returns:
            Content as string, or None if no history exists
        """
        latest_backup = await self._get_latest_backup(project_id, file_id, subtype)
        if not latest_backup:
            return None

        try:
            if subtype == "caption":
                return latest_backup.read_text(encoding='utf-8')
            else:
                # Assume binary
                content_bytes = latest_backup.read_bytes()
                return base64.b64encode(content_bytes).decode('ascii')
        except (OSError, UnicodeDecodeError):
            return None

    async def list_versions(self, project_id: str, file_id: str, subtype: str = "original") -> List[Dict[str, Any]]:
        """
        List all version timestamps for a file.
        """
        history_dir = self._file_history_dir(project_id, file_id, subtype)
        if not history_dir.exists():
            return []

        def _scan_versions():
             results = []
             for history_file in history_dir.glob("*"):
                if history_file.is_file():
                    stat = history_file.stat()
                    timestamp = self._parse_timestamp(history_file.name)
                    extension = history_file.suffix.lstrip('.')
                    is_available = True
                    content_preview = None
                    
                    if subtype == "caption":
                        try:
                            try:
                                full_text = history_file.read_text(encoding='utf-8')
                                content_preview = full_text
                            except UnicodeDecodeError:
                                is_available = False
                        except OSError:
                            is_available = False
                            
                    version_info = {
                        "timestamp": timestamp,
                        "extension": extension,
                        "size": stat.st_size,
                        "modified": stat.st_mtime,
                        "is_available": is_available
                    }
                    if subtype == "caption":
                        version_info["content_preview"] = content_preview
                    results.append(version_info)
             return results

        versions = await run_in_threadpool(_scan_versions)
        # Sort newest first
        versions.sort(key=lambda v: v["modified"], reverse=True)
        return versions

    async def get_version_content(
        self,
        project_id: str,
        file_id: str,
        timestamp: str,
        subtype: str = "original",
    ) -> str | None:
        """
        Get content of a specific version of a file.
        """
        logger.info(f"[GET_VERSION] Starting get version content - project_id={project_id}, file_id={file_id}, subtype={subtype}, timestamp={timestamp}")

        history_dir = self._file_history_dir(project_id, file_id, subtype)
        version_path = self._find_version_path(history_dir, timestamp)

        if version_path is None or not version_path.exists():
            logger.warning(f"[GET_VERSION] Version path does not exist for timestamp: {timestamp}")
            return None

        try:
             def _read():
                if subtype == "caption":
                    # Read text content
                    return version_path.read_text(encoding='utf-8')
                else:
                    # Assume binary
                    return version_path.read_bytes()
            
             content_raw = await run_in_threadpool(_read)
             
             if subtype == "caption":
                 return content_raw
             else:
                 return base64.b64encode(content_raw).decode('ascii')
                 
        except (OSError, UnicodeDecodeError) as e:
            logger.error(f"[GET_VERSION] Error reading version content: {e}")
            return None

    async def get_version_path(
        self,
        project_id: str,
        file_id: str,
        timestamp: str,
        subtype: str = "original",
    ) -> Path | None:
        """
        Get the actual file path of a specific version.

        Args:
            project_id: Project UUID
            file_id: File UUID
            timestamp: Timestamp of version to locate
            subtype: "original", "preview", or "caption"

        Returns:
            Path to the version file, or None if not found
        """
        history_dir = self._file_history_dir(project_id, file_id, subtype)
        
        def _find():
             return self._find_version_path(history_dir, timestamp)
             
        version_path = await run_in_threadpool(_find)

        if version_path is None or not version_path.exists():
            return None

        return version_path

    async def delete_version(self, project_id: str, file_id: str, timestamp: str, subtype: str = "original") -> bool:
        """
        Delete a specific version from file history.
        """
        history_dir = self._file_history_dir(project_id, file_id, subtype)
        if not history_dir.exists():
            return False

        def _delete():
            history_file = self._find_version_path(history_dir, timestamp)
            if history_file is None or not history_file.exists():
                return False
            try:
                history_file.unlink()
                # Clean up empty history directory
                if not list(history_dir.glob("*")):
                    try:
                        history_dir.rmdir()
                    except OSError:
                        pass
                return True
            except OSError:
                return False

        return await run_in_threadpool(_delete)

    async def delete_all_history(self, project_id: str, file_id: str) -> bool:
        """
        Delete all history versions for a file (all subtypes).
        """
        history_base = self._history_dir(project_id) / file_id
        
        if not history_base.exists():
            return False

        def _delete_all():
             try:
                shutil.rmtree(history_base)
                return True
             except OSError:
                return False
        
        return await run_in_threadpool(_delete_all)
