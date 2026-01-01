"""
Tests for history manager dependency on original file backups.

This module tests that caption and preview backups require original file backups to exist first.
"""

import sys
import uuid
from pathlib import Path

import pytest

ROOT_DIR = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT_DIR / "backend"
sys.path.append(str(BACKEND_DIR))

from storage.history_manager import HistoryManager, BackupResult


@pytest.fixture
def temp_projects_dir(tmp_path):
    """Create a temporary projects directory."""
    projects_dir = tmp_path / "projects"
    projects_dir.mkdir()
    yield projects_dir


@pytest.fixture
def history_manager(temp_projects_dir):
    """Create a HistoryManager with temporary directory."""
    return HistoryManager(temp_projects_dir)


@pytest.fixture
def sample_project_id():
    """Sample project UUID."""
    return str(uuid.uuid4())


def get_history_dir(temp_projects_dir, project_id, file_id, subtype="original"):
    """Get history directory for a file ID and subtype."""
    return temp_projects_dir / project_id / ".history" / file_id / subtype


@pytest.mark.asyncio
class TestCaptionBackupDependency:
    """Test caption backup dependency on original file backups."""

    async def test_caption_backup_fails_without_original(self, history_manager, temp_projects_dir, sample_project_id):
        """Test that caption backup fails when no original backup exists."""
        project_dir = temp_projects_dir / sample_project_id
        project_dir.mkdir()

        file_id = str(uuid.uuid4())
        caption_file = project_dir / "caption.txt"
        caption_file.write_text("test caption")

        # Try to backup caption without any original backup
        result = await history_manager.backup_file(
            project_id=sample_project_id,
            file_id=file_id,
            source_path=caption_file,
            subtype="caption"
        )

        # Should fail with error status
        assert result.status == "error"
        assert "original" in result.reason.lower() or "required" in result.reason.lower()

    async def test_caption_backup_succeeds_with_original(self, history_manager, temp_projects_dir, sample_project_id):
        """Test that caption backup succeeds when original backup exists."""
        project_dir = temp_projects_dir / sample_project_id
        project_dir.mkdir()

        file_id = str(uuid.uuid4())

        # First, create an original backup
        original_file = project_dir / "image.jpg"
        original_file.write_bytes(b'\xff\xd8\xff\xe0')
        original_result = await history_manager.backup_file(
            project_id=sample_project_id,
            file_id=file_id,
            source_path=original_file,
            subtype="original"
        )
        assert original_result.status == "backed_up"

        # Now caption backup should succeed
        caption_file = project_dir / "caption.txt"
        caption_file.write_text("test caption")
        caption_result = await history_manager.backup_file(
            project_id=sample_project_id,
            file_id=file_id,
            source_path=caption_file,
            subtype="caption"
        )

        # Should succeed
        assert caption_result.status == "backed_up"
        assert caption_result.timestamp is not None

        # Verify caption backup exists
        caption_history_dir = get_history_dir(temp_projects_dir, sample_project_id, file_id, "caption")
        assert caption_history_dir.exists()
        backup_files = list(caption_history_dir.glob("*"))
        assert len(backup_files) == 1


@pytest.mark.asyncio
class TestPreviewBackupDependency:
    """Test preview backup dependency on original file backups."""

    async def test_preview_backup_fails_without_original(self, history_manager, temp_projects_dir, sample_project_id):
        """Test that preview backup fails when no original backup exists."""
        project_dir = temp_projects_dir / sample_project_id
        project_dir.mkdir()

        file_id = str(uuid.uuid4())
        preview_file = project_dir / "preview.png"
        preview_file.write_bytes(b'\x89PNG\r\n\x1a\n')

        # Try to backup preview without any original backup
        result = await history_manager.backup_file(
            project_id=sample_project_id,
            file_id=file_id,
            source_path=preview_file,
            subtype="preview"
        )

        # Should fail with error status
        assert result.status == "error"
        assert "original" in result.reason.lower() or "required" in result.reason.lower()

    async def test_preview_backup_succeeds_with_original(self, history_manager, temp_projects_dir, sample_project_id):
        """Test that preview backup succeeds when original backup exists."""
        project_dir = temp_projects_dir / sample_project_id
        project_dir.mkdir()

        file_id = str(uuid.uuid4())

        # First, create an original backup
        original_file = project_dir / "image.jpg"
        original_file.write_bytes(b'\xff\xd8\xff\xe0')
        original_result = await history_manager.backup_file(
            project_id=sample_project_id,
            file_id=file_id,
            source_path=original_file,
            subtype="original"
        )
        assert original_result.status == "backed_up"

        # Now preview backup should succeed
        preview_file = project_dir / "preview.png"
        preview_file.write_bytes(b'\x89PNG\r\n\x1a\n')
        preview_result = await history_manager.backup_file(
            project_id=sample_project_id,
            file_id=file_id,
            source_path=preview_file,
            subtype="preview"
        )

        # Should succeed
        assert preview_result.status == "backed_up"
        assert preview_result.timestamp is not None

        # Verify preview backup exists
        preview_history_dir = get_history_dir(temp_projects_dir, sample_project_id, file_id, "preview")
        assert preview_history_dir.exists()
        backup_files = list(preview_history_dir.glob("*"))
        assert len(backup_files) == 1


@pytest.mark.asyncio
class TestOriginalBackupUnaffected:
    """Test that original backups are not affected by dependency rules."""

    async def test_original_backup_unaffected(self, history_manager, temp_projects_dir, sample_project_id):
        """Test that original backups work independently without any preconditions."""
        project_dir = temp_projects_dir / sample_project_id
        project_dir.mkdir()

        file_id = str(uuid.uuid4())
        original_file = project_dir / "image.jpg"
        original_file.write_bytes(b'\xff\xd8\xff\xe0')

        # Original backup should work without any preconditions
        result = await history_manager.backup_file(
            project_id=sample_project_id,
            file_id=file_id,
            source_path=original_file,
            subtype="original"
        )

        # Should succeed
        assert result.status == "backed_up"
        assert result.timestamp is not None

        # Verify original backup exists
        original_history_dir = get_history_dir(temp_projects_dir, sample_project_id, file_id, "original")
        assert original_history_dir.exists()
        backup_files = list(original_history_dir.glob("*"))
        assert len(backup_files) == 1
