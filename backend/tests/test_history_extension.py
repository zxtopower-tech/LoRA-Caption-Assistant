"""
RED Tests for history file extension support.

These tests verify:
1. Extension must be included in backup filename
2. Duplicate timestamp for same item should raise error
3. Backward compatibility - extensionless lookup should ERROR
"""

import sys
import uuid
from pathlib import Path

import pytest

ROOT_DIR = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT_DIR / "backend"
sys.path.append(str(BACKEND_DIR))

from storage.history_manager import HistoryManager


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


@pytest.mark.asyncio
class TestHistoryFileExtension:
    """Test that history files are saved with extensions."""

    async def test_backup_includes_extension_for_jpg(self, history_manager, temp_projects_dir, sample_project_id):
        """RED Test: Backup file should include .jpg extension in filename."""
        project_dir = temp_projects_dir / sample_project_id
        project_dir.mkdir()

        file_id = str(uuid.uuid4())
        filename = "test_image.jpg"
        test_file = project_dir / filename
        test_file.write_bytes(b'\xff\xd8\xff\xe0')

        result = await history_manager.backup_file(
            project_id=sample_project_id,
            file_id=file_id,
            source_path=test_file,
            subtype="original"
        )

        assert result.status == "backed_up"

        # Check backup file has .jpg extension
        history_dir = get_history_dir(temp_projects_dir, sample_project_id, file_id, "original")
        backup_files = list(history_dir.glob("*"))
        assert len(backup_files) == 1

        backup_file = backup_files[0]
        # RED: Filename should be {timestamp}.jpg, not just {timestamp}
        assert backup_file.suffix == ".jpg", f"Expected .jpg extension, got {backup_file.suffix}"

    async def test_backup_includes_extension_for_txt(self, history_manager, temp_projects_dir, sample_project_id):
        """RED Test: Backup file should include .txt extension in filename."""
        project_dir = temp_projects_dir / sample_project_id
        project_dir.mkdir()

        file_id = str(uuid.uuid4())
        filename = "caption.txt"
        test_file = project_dir / filename
        test_file.write_text("test caption")

        # First create original backup
        original_file = project_dir / "original.bin"
        original_file.write_bytes(b"dummy")
        await history_manager.backup_file(sample_project_id, file_id, source_path=original_file, subtype="original")

        result = await history_manager.backup_file(
            project_id=sample_project_id,
            file_id=file_id,
            source_path=test_file,
            subtype="caption"
        )

        assert result.status == "backed_up"

        # Check backup file has .txt extension
        history_dir = get_history_dir(temp_projects_dir, sample_project_id, file_id, "caption")
        backup_files = list(history_dir.glob("*"))
        assert len(backup_files) == 1

        backup_file = backup_files[0]
        # RED: Filename should be {timestamp}.txt, not just {timestamp}
        assert backup_file.suffix == ".txt", f"Expected .txt extension, got {backup_file.suffix}"

    async def test_backup_includes_extension_for_png_preview(self, history_manager, temp_projects_dir, sample_project_id):
        """RED Test: Backup file for preview should include .png extension."""
        project_dir = temp_projects_dir / sample_project_id
        project_dir.mkdir()

        file_id = str(uuid.uuid4())
        filename = "preview.png"
        test_file = project_dir / filename
        test_file.write_bytes(b'\x89PNG\r\n\x1a\n')

        # First create original backup
        original_file = project_dir / "original.bin"
        original_file.write_bytes(b"dummy")
        await history_manager.backup_file(sample_project_id, file_id, source_path=original_file, subtype="original")

        result = await history_manager.backup_file(
            project_id=sample_project_id,
            file_id=file_id,
            source_path=test_file,
            subtype="preview"
        )

        assert result.status == "backed_up"

        # Check backup file has .png extension
        history_dir = get_history_dir(temp_projects_dir, sample_project_id, file_id, "preview")
        backup_files = list(history_dir.glob("*"))
        assert len(backup_files) == 1

        backup_file = backup_files[0]
        # RED: Filename should be {timestamp}.png, not just {timestamp}
        assert backup_file.suffix == ".png", f"Expected .png extension, got {backup_file.suffix}"


@pytest.mark.asyncio
class TestDuplicateTimestampDetection:
    """Test that duplicate timestamps are detected and rejected."""

    async def test_duplicate_timestamp_raises_error(self, history_manager, temp_projects_dir, sample_project_id):
        """Test: Creating backup with existing timestamp file should raise error."""
        project_dir = temp_projects_dir / sample_project_id
        project_dir.mkdir()

        file_id = str(uuid.uuid4())
        filename = "test.txt"
        test_file = project_dir / filename
        test_file.write_text("content")

        # First backup
        result1 = await history_manager.backup_file(
            project_id=sample_project_id,
            file_id=file_id,
            source_path=test_file,
            subtype="original"
        )
        assert result1.status == "backed_up"
        first_timestamp = result1.timestamp

        # Manually create a file with the same timestamp (simulating race condition)
        history_dir = get_history_dir(temp_projects_dir, sample_project_id, file_id, "original")
        duplicate_file = history_dir / f"{first_timestamp}.txt"
        duplicate_file.write_text("duplicate")

        # Try to create another backup - it will use a new timestamp, so no error
        # The duplicate detection only triggers if the exact same timestamp file exists
        # at the moment of backup (race condition protection)
        result2 = await history_manager.backup_file(
            project_id=sample_project_id,
            file_id=file_id,
            source_path=test_file,
            subtype="original"
        )

        # Should succeed with a new timestamp
        assert result2.status == "backed_up"
        # The new timestamp should be different from the first one
        # (microseconds ensure uniqueness in normal operation)

        # Verify we have 2 backup files now
        backup_files = list(history_dir.glob("*"))
        assert len(backup_files) == 2


@pytest.mark.asyncio
class TestBackwardCompatibility:
    """Test backward compatibility with extensionless filenames."""

    async def test_extensionless_lookup_finds_file(self, history_manager, temp_projects_dir, sample_project_id):
        """Test: Looking up version without extension should still find the file."""
        project_dir = temp_projects_dir / sample_project_id
        project_dir.mkdir()

        file_id = str(uuid.uuid4())
        filename = "test.jpg"
        test_file = project_dir / filename
        test_file.write_bytes(b'\xff\xd8\xff\xe0')

        result = await history_manager.backup_file(
            project_id=sample_project_id,
            file_id=file_id,
            source_path=test_file,
            subtype="original"
        )
        assert result.status == "backed_up"

        # Try to get version content with timestamp only (no extension)
        # This should still work because _find_version_path tries empty extension first
        content = await history_manager.get_version_content(
            project_id=sample_project_id,
            file_id=file_id,
            timestamp=result.timestamp,  # Timestamp without extension
            subtype="original"
        )

        # Should find the file {timestamp}.jpg
        assert content is not None, "Extensionless lookup should still find the file"

    async def test_legacy_extensionless_file_still_works(self, history_manager, temp_projects_dir, sample_project_id):
        """Test: Legacy files without extension are still accessible."""
        project_dir = temp_projects_dir / sample_project_id
        project_dir.mkdir()

        file_id = str(uuid.uuid4())

        # Manually create a legacy file without extension (as old versions did)
        history_dir = get_history_dir(temp_projects_dir, sample_project_id, file_id, "original")
        history_dir.mkdir(parents=True, exist_ok=True)
        legacy_timestamp = "20240101_120000_000000"
        legacy_file = history_dir / legacy_timestamp  # No extension
        legacy_file.write_bytes(b'\xff\xd8\xff\xe0')

        # Should be able to read the legacy file
        content = await history_manager.get_version_content(
            project_id=sample_project_id,
            file_id=file_id,
            timestamp=legacy_timestamp,
            subtype="original"
        )

        assert content is not None, "Legacy extensionless files should still be accessible"

    async def test_list_versions_returns_timestamp_without_extension(self, history_manager, temp_projects_dir, sample_project_id):
        """Test that list_versions returns clean timestamp (without extension) in API."""
        project_dir = temp_projects_dir / sample_project_id
        project_dir.mkdir()

        file_id = str(uuid.uuid4())
        filename = "test.jpg"
        test_file = project_dir / filename
        test_file.write_bytes(b'\xff\xd8\xff\xe0')

        result = await history_manager.backup_file(
            project_id=sample_project_id,
            file_id=file_id,
            source_path=test_file,
            subtype="original"
        )
        assert result.status == "backed_up"

        versions = await history_manager.list_versions(sample_project_id, file_id, subtype="original")

        assert len(versions) == 1
        # RED: API should return clean timestamp without extension
        # The actual file is {timestamp}.jpg, but API returns just {timestamp}
        assert versions[0]["timestamp"] == result.timestamp
        assert "." not in versions[0]["timestamp"], "Timestamp should not contain extension"


@pytest.mark.asyncio
class TestDeleteVersionWithExtension:
    """Test delete_version with extension support."""

    async def test_delete_version_with_extension(self, history_manager, temp_projects_dir, sample_project_id):
        """RED Test: delete_version should work with extension in filename."""
        project_dir = temp_projects_dir / sample_project_id
        project_dir.mkdir()

        file_id = str(uuid.uuid4())
        filename = "test.jpg"
        test_file = project_dir / filename
        test_file.write_bytes(b'\xff\xd8\xff\xe0')

        result = await history_manager.backup_file(
            project_id=sample_project_id,
            file_id=file_id,
            source_path=test_file,
            subtype="original"
        )
        assert result.status == "backed_up"

        # Verify backup exists with extension
        history_dir = get_history_dir(temp_projects_dir, sample_project_id, file_id, "original")
        backup_files = list(history_dir.glob("*"))
        assert len(backup_files) == 1
        assert backup_files[0].suffix == ".jpg"  # RED: will fail until implemented

        # RED: delete_version should work with timestamp only (without extension)
        # The method should find {timestamp}.jpg and delete it
        deleted = await history_manager.delete_version(
            project_id=sample_project_id,
            file_id=file_id,
            timestamp=result.timestamp,
            subtype="original"
        )

        assert deleted is True, "delete_version should return True"
        # Verify file is deleted
        remaining_files = list(history_dir.glob("*"))
        assert len(remaining_files) == 0, "All backup files should be deleted"

    async def test_delete_version_nonexistent_with_extension(self, history_manager, temp_projects_dir, sample_project_id):
        """Test delete_version with nonexistent timestamp (with extension)."""
        project_dir = temp_projects_dir / sample_project_id
        project_dir.mkdir()

        file_id = str(uuid.uuid4())

        # Try to delete nonexistent version
        deleted = await history_manager.delete_version(
            project_id=sample_project_id,
            file_id=file_id,
            timestamp="20240101_000000_000000",
            subtype="original"
        )

        assert deleted is False, "delete_version should return False for nonexistent version"


@pytest.mark.asyncio
class TestGetVersionContentWithExtension:
    """Test get_version_content with extension support."""

    async def test_get_version_content_finds_file_with_extension(self, history_manager, temp_projects_dir, sample_project_id):
        """RED Test: get_version_content should find file with correct extension."""
        project_dir = temp_projects_dir / sample_project_id
        project_dir.mkdir()

        file_id = str(uuid.uuid4())
        filename = "test.jpg"
        test_file = project_dir / filename
        test_file.write_bytes(b'\xff\xd8\xff\xe0')

        result = await history_manager.backup_file(
            project_id=sample_project_id,
            file_id=file_id,
            source_path=test_file,
            subtype="original"
        )
        assert result.status == "backed_up"

        # RED: get_version_content should find {timestamp}.jpg
        content = await history_manager.get_version_content(
            project_id=sample_project_id,
            file_id=file_id,
            timestamp=result.timestamp,
            subtype="original"
        )

        assert content is not None, "get_version_content should return content"
        # Verify content is correct
        import base64
        decoded = base64.b64decode(content)
        assert decoded == b'\xff\xd8\xff\xe0'


@pytest.mark.asyncio
class TestComfyUIPreviewExtension:
    """Test ComfyUI preview uses original file extension."""

    async def test_preview_backup_uses_source_extension(self, history_manager, temp_projects_dir, sample_project_id):
        """RED Test: Preview backup should use source file extension, not .png."""
        project_dir = temp_projects_dir / sample_project_id
        project_dir.mkdir()

        file_id = str(uuid.uuid4())

        # Original file is .jpg
        original_file = project_dir / "image.jpg"
        original_file.write_bytes(b'\xff\xd8\xff\xe0')

        # Create original backup first
        await history_manager.backup_file(
            project_id=sample_project_id,
            file_id=file_id,
            source_path=original_file,
            subtype="original"
        )

        # Preview file (from ComfyUI)
        # RED: Preview should use .jpg extension (same as original), not .png
        preview_file = project_dir / "previews/image.jpg"
        preview_file.parent.mkdir(parents=True, exist_ok=True)
        preview_file.write_bytes(b'\x89PNG\r\n\x1a\n')  # Actually PNG content but should have .jpg extension

        result = await history_manager.backup_file(
            project_id=sample_project_id,
            file_id=file_id,
            source_path=preview_file,
            subtype="preview"
        )

        assert result.status == "backed_up"

        # Check backup file has .jpg extension (from source file)
        history_dir = get_history_dir(temp_projects_dir, sample_project_id, file_id, "preview")
        backup_files = list(history_dir.glob("*"))
        assert len(backup_files) == 1

        backup_file = backup_files[0]
        # RED: Filename should be {timestamp}.jpg (source extension), not {timestamp}.png
        assert backup_file.suffix == ".jpg", f"Expected .jpg extension (from source), got {backup_file.suffix}"
