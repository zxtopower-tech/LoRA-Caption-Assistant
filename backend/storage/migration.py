"""
Migration logic for legacy ZIP-based projects.

This module provides:
- ZIP to unpacked directory migration
- Integrity validation
- Migration marker management
- Safe cleanup of legacy ZIPs

Migration States:
    State 0: No ZIP, No Directory → New project (no action)
    State 1: ZIP exists, No Directory → Migrate needed
    State 2: ZIP exists, Directory exists, Marker exists → Migrated, cleanup optional
    State 3: ZIP exists, Directory exists, No Marker → Incomplete (re-migrate)
    State 4: No ZIP, Directory exists, Marker exists → Fully migrated
"""

import json
import zipfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional


@dataclass
class MigrationResult:
    """Result of a migration operation."""
    status: str  # "migrated", "already_migrated", "failed", "no_zip"
    files_count: int = 0
    error: Optional[str] = None
    marker_path: Optional[Path] = None


class MigrationManager:
    """
    Manages migration from ZIP-based to unpacked directory storage.
    """

    def __init__(self, projects_dir: Path):
        """
        Initialize MigrationManager.

        Args:
            projects_dir: Base directory containing projects
        """
        self._projects_dir = projects_dir

    def _get_zip_path(self, project_id: str) -> Path:
        """Get the path to a project's ZIP file."""
        return self._projects_dir / f"{project_id}.zip"

    def _get_project_dir(self, project_id: str) -> Path:
        """Get the path to a project's unpacked directory."""
        return self._projects_dir / project_id

    def _get_marker_path(self, project_id: str) -> Path:
        """Get the path to a project's migration marker file."""
        return self._projects_dir / project_id / ".migrated"

    def is_migrated(self, project_id: str) -> bool:
        """
        Check if a project has been migrated.

        Args:
            project_id: Project UUID

        Returns:
            True if migration marker exists
        """
        marker_path = self._get_marker_path(project_id)
        return marker_path.exists()

    def get_migration_marker(self, project_id: str) -> Optional[Dict[str, Any]]:
        """
        Read the migration marker for a project.

        Args:
            project_id: Project UUID

        Returns:
            Marker data dict, or None if not found
        """
        marker_path = self._get_marker_path(project_id)
        if not marker_path.exists():
            return None

        try:
            with marker_path.open("r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            return None

    def needs_migration(self, project_id: str) -> bool:
        """
        Check if a project needs migration.

        Returns True if ZIP exists but no migration marker.

        Args:
            project_id: Project UUID

        Returns:
            True if migration is needed
        """
        zip_path = self._get_zip_path(project_id)
        if not zip_path.exists():
            return False

        return not self.is_migrated(project_id)

    def migrate_project(self, project_id: str) -> MigrationResult:
        """
        Migrate a project from ZIP to unpacked directory.

        Process:
        1. Validate ZIP exists and can be opened
        2. Create project directory
        3. Extract ZIP contents
        4. Create .history directory
        5. Write migration marker
        6. Validate extraction

        Original ZIP is preserved (not deleted).

        Args:
            project_id: Project UUID

        Returns:
            MigrationResult with status and metadata
        """
        zip_path = self._get_zip_path(project_id)
        project_dir = self._get_project_dir(project_id)

        # Check if ZIP exists
        if not zip_path.exists():
            return MigrationResult(status="no_zip")

        # If already migrated and directory exists, skip
        if self.is_migrated(project_id) and project_dir.exists():
            return MigrationResult(
                status="already_migrated",
                marker_path=self._get_marker_path(project_id),
            )

        # Validate ZIP integrity
        try:
            with zipfile.ZipFile(zip_path, "r") as zf:
                # Count files for validation
                zip_file_count = len(zf.namelist())
                zip_total_size = sum(zf.getinfo(name).file_size for name in zf.namelist())
        except zipfile.BadZipFile:
            return MigrationResult(
                status="failed",
                error="ZIP file is corrupted or invalid"
            )
        except Exception as e:
            return MigrationResult(
                status="failed",
                error=f"Failed to read ZIP: {e}"
            )

        # Create project directory
        project_dir.mkdir(parents=True, exist_ok=True)

        # Extract ZIP
        try:
            with zipfile.ZipFile(zip_path, "r") as zf:
                zf.extractall(project_dir)
        except Exception as e:
            # Cleanup partial extraction
            if project_dir.exists():
                self._cleanup_partial_migration(project_dir)
            return MigrationResult(
                status="failed",
                error=f"Failed to extract ZIP: {e}"
            )

        # Create .history directory
        history_dir = project_dir / ".history"
        history_dir.mkdir(exist_ok=True)

        # Validate extraction
        extracted_count = sum(1 for _ in project_dir.rglob("*") if _.is_file())
        extracted_size = sum(
            f.stat().st_size
            for f in project_dir.rglob("*")
            if f.is_file() and ".history" not in f.parts
        )

        # Allow some tolerance for file count (directory entries, etc.)
        if abs(extracted_count - zip_file_count) > 10:
            return MigrationResult(
                status="failed",
                error=f"Validation failed: expected {zip_file_count} files, got {extracted_count}"
            )

        # Write migration marker
        marker_data = {
            "migratedAt": datetime.now(timezone.utc).isoformat(),
            "sourceZip": zip_path.name,
            "filesExtracted": extracted_count,
            "validation": "passed",
        }

        marker_path = self._get_marker_path(project_id)
        try:
            with marker_path.open("w", encoding="utf-8") as f:
                json.dump(marker_data, f, indent=2)
        except Exception as e:
            return MigrationResult(
                status="failed",
                error=f"Failed to write migration marker: {e}"
            )

        return MigrationResult(
            status="migrated",
            files_count=extracted_count,
            marker_path=marker_path,
        )

    def _cleanup_partial_migration(self, project_dir: Path) -> None:
        """
        Clean up a partial migration directory.

        Args:
            project_dir: Project directory to clean up
        """
        try:
            # Remove directory and all contents
            if project_dir.is_dir():
                import shutil
                shutil.rmtree(project_dir)
        except Exception:
            # Log but don't fail
            pass

    def validate_migration(self, project_id: str) -> bool:
        """
        Validate that a migration was successful.

        Checks:
        - Migration marker exists
        - Project directory exists
        - .history directory exists
        - Files are present

        Args:
            project_id: Project UUID

        Returns:
            True if migration appears valid
        """
        project_dir = self._get_project_dir(project_id)
        marker_path = self._get_marker_path(project_id)

        # Check marker and directory exist
        if not marker_path.exists() or not project_dir.exists():
            return False

        # Check .history directory exists
        history_dir = project_dir / ".history"
        if not history_dir.exists():
            return False

        # Check there are files in the project
        files = list(project_dir.rglob("*"))
        if not any(f.is_file() for f in files):
            return False

        return True

    def cleanup_legacy_zip(self, project_id: str) -> bool:
        """
        Delete the legacy ZIP file after successful migration.

        WARNING: This is irreversible! Only call after explicit user confirmation.

        Args:
            project_id: Project UUID

        Returns:
            True if deleted, False otherwise
        """
        # Validate migration first
        if not self.validate_migration(project_id):
            return False

        zip_path = self._get_zip_path(project_id)
        if not zip_path.exists():
            return False

        try:
            zip_path.unlink()
            return True
        except Exception:
            return False

    def migrate_all_projects(self) -> Dict[str, Any]:
        """
        Migrate all projects that need migration.

        Scans all projects and migrates those with ZIP files
        but no migration marker.

        Args:
            None

        Returns:
            Dict with "migrated", "skipped", "failed" lists
        """
        results = {"migrated": [], "skipped": [], "failed": []}

        # Find all potential project ZIPs
        for zip_path in self._projects_dir.glob("*.zip"):
            project_id = zip_path.stem

            # Skip if not a valid UUID (basic check)
            if len(project_id) != 36:
                continue

            # Check if already migrated
            if self.is_migrated(project_id):
                results["skipped"].append(project_id)
                continue

            # Attempt migration
            result = self.migrate_project(project_id)
            if result.status == "migrated":
                results["migrated"].append(project_id)
            elif result.status == "failed":
                results["failed"].append({
                    "project_id": project_id,
                    "error": result.error,
                })
            elif result.status == "already_migrated":
                results["skipped"].append(project_id)

        return results
