"""
Tests for history manager (history_manager.py).
"""

import base64
import shutil
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
    return "12345678-1234-1234-1234-123456789abc"


def get_history_dir(temp_projects_dir, project_id, file_id, subtype="original"):
    """Get history directory for a file ID and subtype."""
    return temp_projects_dir / project_id / ".history" / file_id / subtype


def get_all_backup_files(temp_projects_dir, project_id, file_id, subtype="original"):
    """Get all backup files for a specific file ID and subtype."""
    history_dir = get_history_dir(temp_projects_dir, project_id, file_id, subtype)
    if not history_dir.exists():
        return []
    return list(history_dir.glob("*"))


@pytest.mark.asyncio
class TestHistoryManager:
    """Test HistoryManager functionality."""

    async def test_backup_file_creates_history_entry(self, history_manager, temp_projects_dir, sample_project_id):
        """Test that backing up a file creates a history entry."""
        project_dir = temp_projects_dir / sample_project_id
        project_dir.mkdir()

        file_id = str(uuid.uuid4())
        filename = "test.txt"
        test_file = project_dir / filename
        test_file.write_text("original content")

        result = await history_manager.backup_file(
            project_id=sample_project_id,
            file_id=file_id,
            source_path=test_file,
            subtype="original"
        )

        assert result.status == "backed_up"
        assert result.timestamp is not None

        # Check backup exists
        history_dir = get_history_dir(temp_projects_dir, sample_project_id, file_id, "original")
        assert history_dir.exists()
        backup_files = list(history_dir.glob("*"))
        assert len(backup_files) == 1

    async def test_backup_file_skips_unchanged_content(self, history_manager, temp_projects_dir, sample_project_id):
        """Test that backing up unchanged content is skipped (deduplication)."""
        project_dir = temp_projects_dir / sample_project_id
        project_dir.mkdir()

        file_id = str(uuid.uuid4())
        filename = "test.txt"
        test_file = project_dir / filename
        content = "same content"
        test_file.write_text(content)

        # First backup
        result1 = await history_manager.backup_file(
            project_id=sample_project_id,
            file_id=file_id,
            source_path=test_file
        )
        assert result1.status == "backed_up"

        # Second backup with same content
        result2 = await history_manager.backup_file(
            project_id=sample_project_id,
            file_id=file_id,
            source_path=test_file
        )
        assert result2.status == "skipped"
        assert "deduplication" in result2.reason

        # Should only have one backup file
        backup_files = get_all_backup_files(temp_projects_dir, sample_project_id, file_id)
        assert len(backup_files) == 1

    async def test_backup_file_force_creates_new_backup(self, history_manager, temp_projects_dir, sample_project_id):
        """Test that force=True creates a new backup even if unchanged."""
        project_dir = temp_projects_dir / sample_project_id
        project_dir.mkdir()

        file_id = str(uuid.uuid4())
        filename = "test.txt"
        test_file = project_dir / filename
        content = "same content"
        test_file.write_text(content)

        # First backup
        await history_manager.backup_file(
            project_id=sample_project_id,
            file_id=file_id,
            source_path=test_file
        )

        # Force backup
        result = await history_manager.backup_file(
            project_id=sample_project_id,
            file_id=file_id,
            source_path=test_file,
            force=True
        )

        assert result.status == "backed_up"

        # Should have two backup files
        backup_files = get_all_backup_files(temp_projects_dir, sample_project_id, file_id)
        assert len(backup_files) == 2

    async def test_backup_file_returns_error_for_nonexistent_file(self, history_manager, temp_projects_dir, sample_project_id):
        """Test that backing up a nonexistent file returns error."""
        project_dir = temp_projects_dir / sample_project_id
        project_dir.mkdir(parents=True, exist_ok=True) # Ensure project dir exists
        
        file_id = str(uuid.uuid4())
        nonexistent_file = project_dir / "nonexistent.txt"

        result = await history_manager.backup_file(
            project_id=sample_project_id,
            file_id=file_id,
            source_path=nonexistent_file
        )

        assert result.status == "error"
        assert "does not exist" in result.reason

    async def test_list_versions_returns_sorted_list(self, history_manager, temp_projects_dir, sample_project_id):
        """Test that list_versions returns versions sorted newest first."""
        project_dir = temp_projects_dir / sample_project_id
        project_dir.mkdir()

        file_id = str(uuid.uuid4())
        filename = "test.txt"
        test_file = project_dir / filename
        
        # Create 3 backups
        test_file.write_text("version 1")
        await history_manager.backup_file(sample_project_id, file_id, source_path=test_file, force=True)
        
        test_file.write_text("version 2")
        await history_manager.backup_file(sample_project_id, file_id, source_path=test_file, force=True)
        
        test_file.write_text("version 3")
        await history_manager.backup_file(sample_project_id, file_id, source_path=test_file, force=True)

        versions = await history_manager.list_versions(sample_project_id, file_id)

        assert len(versions) == 3
        # Check sorted by modified time (newest first)
        assert versions[0]["modified"] >= versions[1]["modified"]
        assert versions[1]["modified"] >= versions[2]["modified"]

    async def test_list_versions_returns_empty_for_file_with_no_history(self, history_manager, sample_project_id):
        """Test that list_versions returns empty list for file with no history."""
        file_id = str(uuid.uuid4())
        versions = await history_manager.list_versions(sample_project_id, file_id)

        assert versions == []

@pytest.mark.asyncio
class TestGetVersionContent:
    """Test get_version_content method with various file types and scenarios."""

    async def test_get_version_content_for_image_file_returns_base64(self, history_manager, temp_projects_dir, sample_project_id):
        """Test that getting version content for an image file returns Base64-encoded content."""
        project_dir = temp_projects_dir / sample_project_id
        project_dir.mkdir(parents=True)

        file_id = str(uuid.uuid4())
        filename = "test_image.jpg"
        original_bytes = b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00'
        test_file = project_dir / filename
        test_file.write_bytes(original_bytes)

        # Create backup
        result = await history_manager.backup_file(
            project_id=sample_project_id, 
            file_id=file_id, 
            source_path=test_file,
            subtype="original"
        )
        assert result.status == "backed_up"
        assert result.timestamp is not None

        # Get version content
        content = await history_manager.get_version_content(
            project_id=sample_project_id, 
            file_id=file_id, 
            timestamp=result.timestamp,
            subtype="original"
        )

        # Should be returned as Base64 encoded
        assert content is not None
        decoded = base64.b64decode(content)
        assert decoded == original_bytes

    async def test_get_version_content_for_text_file_returns_utf8_text(self, history_manager, temp_projects_dir, sample_project_id):
        """Test that getting version content for a text file returns UTF-8 text."""
        project_dir = temp_projects_dir / sample_project_id
        project_dir.mkdir(parents=True)

        file_id = str(uuid.uuid4())
        filename = "test_caption.txt"
        original_text = "This is a test caption with UTF-8: \u2728 Emoji"
        test_file = project_dir / filename
        test_file.write_text(original_text, encoding='utf-8')

        # Create dummy original backup first
        original_bytes = b"dummy original"
        original_file = project_dir / "original.bin"
        original_file.write_bytes(original_bytes)
        await history_manager.backup_file(sample_project_id, file_id, source_path=original_file, subtype="original")

        # Create backup - use subtype="caption"
        result = await history_manager.backup_file(
            project_id=sample_project_id, 
            file_id=file_id, 
            source_path=test_file,
            subtype="caption"
        )
        assert result.status == "backed_up"

        # Get version content
        content = await history_manager.get_version_content(
            project_id=sample_project_id, 
            file_id=file_id, 
            timestamp=result.timestamp,
            subtype="caption"
        )

        # Should be returned as UTF-8 text
        assert content == original_text

    async def test_get_version_content_with_subtype_preview(self, history_manager, temp_projects_dir, sample_project_id):
        """Test get_version_content with subtype='preview'."""
        project_dir = temp_projects_dir / sample_project_id
        project_dir.mkdir(parents=True)

        file_id = str(uuid.uuid4())
        preview_filename = "item_image01.png"

        # Create preview file and backup
        original_bytes = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR'
        test_file = project_dir / preview_filename
        test_file.write_bytes(original_bytes)

        # Create dummy original backup first
        dummy_bytes = b"dummy original"
        original_file = project_dir / "original.bin"
        original_file.write_bytes(dummy_bytes)
        await history_manager.backup_file(sample_project_id, file_id, source_path=original_file, subtype="original")

        # Create backup (subtype="preview")
        result = await history_manager.backup_file(
            project_id=sample_project_id, 
            file_id=file_id, 
            source_path=test_file,
            subtype="preview"
        )
        assert result.status == "backed_up"
        assert result.timestamp is not None

        # Check with subtype="preview" - .history/{id}/preview/{timestamp}
        # (history_manager finds the path automatically, not using test helper)
        content = await history_manager.get_version_content(
            project_id=sample_project_id, 
            file_id=file_id, 
            timestamp=result.timestamp, 
            subtype="preview"
        )

        assert content is not None
        decoded = base64.b64decode(content)
        assert decoded == original_bytes

    async def test_get_version_content_returns_none_for_nonexistent_timestamp(self, history_manager, sample_project_id):
        """Test that get_version_content returns None for nonexistent timestamp."""
        file_id = str(uuid.uuid4())
        content = await history_manager.get_version_content(
            sample_project_id, file_id, "20240101_000000_000000"
        )
        assert content is None


@pytest.mark.asyncio
class TestDeleteAllHistory:
    """Test delete_all_history method."""

    async def test_delete_all_history_success(self, history_manager, temp_projects_dir, sample_project_id):
        """Test that delete_all_history removes all history versions for a file."""
        project_dir = temp_projects_dir / sample_project_id
        project_dir.mkdir(parents=True)

        file_id = str(uuid.uuid4())
        filename = "test_image.jpg"
        test_file = project_dir / filename
        test_file.write_bytes(b'\xff\xd8\xff\xe0')

        # Create 3 backup versions
        await history_manager.backup_file(sample_project_id, file_id, source_path=test_file, force=True)
        test_file.write_bytes(b'\xff\xd8\xff\xe1')
        await history_manager.backup_file(sample_project_id, file_id, source_path=test_file, force=True)
        test_file.write_bytes(b'\xff\xd8\xff\xe2')
        await history_manager.backup_file(sample_project_id, file_id, source_path=test_file, force=True)

        # Verify backups exist
        backup_files = get_all_backup_files(temp_projects_dir, sample_project_id, file_id)
        assert len(backup_files) == 3

        # Delete all history
        result = await history_manager.delete_all_history(sample_project_id, file_id)

        # Verify all backups deleted
        assert result is True
        
        # Check base directory doesn't exist
        history_base = temp_projects_dir / sample_project_id / ".history" / file_id
        assert not history_base.exists()

    async def test_delete_all_history_nonexistent_file(self, history_manager, temp_projects_dir, sample_project_id):
        """Test that delete_all_history handles nonexistent file gracefully."""
        project_dir = temp_projects_dir / sample_project_id
        project_dir.mkdir(parents=True)
        
        file_id = str(uuid.uuid4())

        # Try to delete history for nonexistent file ID
        result = await history_manager.delete_all_history(sample_project_id, file_id)

        # Should return False or handle gracefully
        assert result is False

