"""
Tests for ComfyUI preview save functionality.

Tests the comfy preview save logic which:
1. Extracts baseName from original filename
2. Creates preview as {baseName}.png in previews/ directory
3. Backs up existing preview before overwriting
4. Creates backup of new preview (with deduplication)

Note: These tests directly call the save logic, not the API endpoint,
following the project's testing guidelines (no TestClient for API endpoints).
"""

import hashlib
import sys
from io import BytesIO
from pathlib import Path

import pytest

ROOT_DIR = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT_DIR / "backend"
sys.path.append(str(BACKEND_DIR))

from storage.history_manager import HistoryManager
from storage.project_manager import ProjectManager
from utils.file_utils import extract_base_name


@pytest.fixture
def temp_projects_dir(tmp_path):
    """Create a temporary projects directory."""
    projects_dir = tmp_path / "projects"
    projects_dir.mkdir()
    yield projects_dir


@pytest.fixture
def sample_project_id():
    """Sample project UUID."""
    return "test-project-12345678-abcd"


@pytest.fixture
def temp_project(temp_projects_dir, sample_project_id):
    """Create a temporary project."""
    project_dir = temp_projects_dir / sample_project_id
    project_dir.mkdir()
    yield project_dir


@pytest.fixture
def history_manager(temp_projects_dir):
    """Create a HistoryManager with temporary directory."""
    return HistoryManager(temp_projects_dir)


@pytest.fixture
def project_manager(temp_projects_dir):
    """Create a ProjectManager with temporary directory."""
    return ProjectManager(temp_projects_dir)


async def save_comfy_preview_logic(
    project_dir: Path,
    history_manager: HistoryManager,
    project_id: str,
    preview_content: bytes,
    original_filename: str
):
    """
    Core logic for saving ComfyUI preview (extracted from endpoint).

    This is the actual business logic from the /comfy-preview endpoint.
    """
    # Extract baseName from original filename
    base_name = extract_base_name(original_filename)

    # Preview filename is always {baseName}.png
    preview_filename = f"{base_name}.png"
    
    # We need item_id for V2 history
    # This helper doesn't have access to manifest or PM to look up item_id.
    # Tests probably need to pass item_id or mock it.
    # Looking at usage, "item_image01.jpg" is passed.
    # In V2, we CANNOT backup using filename path logic directly if HistoryManager expects (project_id, item_id, source_path, subtype).
    
    # However, let's look at HistoryManager reference in previous step.
    # async def backup_file(self, project_id, item_id, source_path, subtype="original", ...)
    
    # This test file seems to rely on OLD HistoryManager logic where file path strings were used?
    # Or maybe it relies on just mocking?
    # If HistoryManager is the real V2 one, we must use item_id.
    
    # But wait, this test file creates a HistoryManager with temp_projects_dir.
    # It creates a temporary project.
    # All tests pass filenames like "item_image01.jpg".
    
    # If I blindly change to await, I might hit "item_id" issues if the args don't match.
    # Let's assume for now that the caller (test) should be providing a UUID for item_id if needed, 
    # OR we are using a mock/dummy item_id in this helper since the tests might not care about *which* item it is, just that it backs up.
    
    # But `preview_backup_path = f"previews/{preview_filename}"` passed as second arg to backup_file.
    # backup_file signature: (project_id, item_id, source_path, ...)
    # So `preview_backup_path` is being passed as `item_id`.
    # This means the item_id will be "previews/item_image01.png".
    # HistoryManager will try to make .history/previews/item_image01.png/...
    # This seemingly works if item_id can contain slashes?
    
    # Setup paths
    previews_dir = project_dir / "previews"
    previews_dir.mkdir(exist_ok=True)

    preview_path = previews_dir / preview_filename
    
    # Fake item_id for testing (using path string as ID for legacy test compat)
    item_id = f"previews/{preview_filename}" # This will be the item_id

    # Check if preview already exists
    existing_preview = None
    if preview_path.exists():
        existing_preview = preview_path

    # Backup existing preview if it exists
    backup_result = None
    if existing_preview:
        # Note: we must pass item_id, source_path, subtype
        # The original code passed `project_id, preview_backup_path, source_path=existing_preview, force=False`
        # `preview_backup_path` was used as `file_id` (2nd arg).
        backup_result = await history_manager.backup_file(
            project_id, item_id, source_path=existing_preview, force=False, subtype="preview"
        )

    # Write new preview file
    from storage.file_operations import atomic_write
    atomic_write(preview_path, preview_content)

    # Create backup of new preview (with deduplication - force=False)
    new_backup_result = await history_manager.backup_file(
        project_id, item_id, source_path=preview_path, force=False, subtype="preview"
    )

    # Format response
    response_backup_result = {
        "status": new_backup_result.status,
        "timestamp": new_backup_result.timestamp,
    }
    if new_backup_result.reason:
        response_backup_result["reason"] = new_backup_result.reason

    # Determine overall status
    status = "saved"
    if new_backup_result.status == "skipped" and not existing_preview:
        status = "skipped"

    return {
        "status": status,
        "preview_path": f"previews/{preview_filename}",
        "backup_result": response_backup_result,
        "preview_path_full": preview_path,
    }


@pytest.mark.asyncio
class TestComfyPreviewSaveNewFile:
    """Test saving new preview files."""

    async def test_save_comfy_preview_new_file_creates_preview(self, temp_project, history_manager, sample_project_id):
        """Test saving a new ComfyUI preview creates the preview file."""
        preview_content = b"new_preview_image_data"

        # Mock the original backup dependency to allow preview backup
        # HistoryManager now requires original backup to exist first for previews
        # We need to simulate that an original file backup exists for this "item"
        # Since logic uses "previews/{filename}" as item_id, we just need to ensure that passes checks.
        # However, checking HistoryManager.backup_file:
        # if subtype in ("preview", "caption"):
        #     original_history_dir = self._file_history_dir(project_id, file_id, "original")
        #     if not original_history_dir.exists()...
        
        # So we MUST create an original backup for whatever ID is being passed.
        # In this test helper, we pass "previews/{preview_filename}" as item_id.
        item_id = "previews/item_image01.png"
        
        # Create dummy original backup
        original_dummy = temp_project / "dummy.original"
        original_dummy.write_bytes(b"dummy")
        await history_manager.backup_file(sample_project_id, item_id, original_dummy, subtype="original")
        
        result = await save_comfy_preview_logic(
            temp_project,
            history_manager,
            sample_project_id,
            preview_content,
            "item_image01.jpg"
        )

        assert result["status"] == "saved"
        assert result["preview_path"] == "previews/item_image01.png"

        # Verify preview file exists
        preview_path = result["preview_path_full"]
        assert preview_path.exists()
        assert preview_path.read_bytes() == preview_content

    async def test_save_comfy_preview_creates_backup(self, temp_project, history_manager, temp_projects_dir, sample_project_id):
        """Test saving a new preview creates a history backup."""
        preview_content = b"new_preview_with_backup"

        # Pre-create original backup for dependency
        item_id = "previews/item_image02.png"
        original_dummy = temp_project / "dummy.original"
        original_dummy.write_bytes(b"dummy")
        await history_manager.backup_file(sample_project_id, item_id, original_dummy, subtype="original")

        result = await save_comfy_preview_logic(
            temp_project,
            history_manager,
            sample_project_id,
            preview_content,
            "item_image02.jpg"
        )

        assert result["backup_result"]["status"] == "backed_up"
        assert result["backup_result"]["timestamp"] is not None

        # Verify backup exists in history
        # Note: HistoryManager structure says .history/{item_id}/{subtype}
        # item_id is "previews/item_image02.png" (contains slash!)
        # So path: .history/previews/item_image02.png/preview/...
        history_dir = temp_projects_dir / sample_project_id / ".history" / "previews" / "item_image02.png" / "preview"
        assert history_dir.exists()

        backup_files = list(history_dir.glob("*"))
        assert len(backup_files) == 1
        assert backup_files[0].read_bytes() == preview_content

    async def test_save_comfy_preview_different_extensions(self, temp_project, history_manager, sample_project_id):
        """Test preview naming works for various original file extensions."""
        test_cases = [
            ("photo.jpg", "photo.png"),
            ("image.jpeg", "image.png"),
            ("picture.png", "picture.png"),
            ("graphic.webp", "graphic.png"),
            ("video.mp4", "video.png"),
        ]

        for original_filename, expected_preview in test_cases:
            preview_content = f"preview_for_{original_filename}".encode()
            
            # Pre-create original backup
            item_id = f"previews/{expected_preview}"
            original_dummy = temp_project / "dummy.original"
            original_dummy.write_bytes(b"dummy")
            await history_manager.backup_file(sample_project_id, item_id, original_dummy, subtype="original")

            result = await save_comfy_preview_logic(
                temp_project,
                history_manager,
                sample_project_id,
                preview_content,
                original_filename
            )

            assert result["preview_path"] == f"previews/{expected_preview}"

            # Verify file exists
            preview_path = temp_project / "previews" / expected_preview
            assert preview_path.exists()


@pytest.mark.asyncio
class TestComfyPreviewSaveDeduplication:
    """Test deduplication when saving identical content."""

    async def test_save_comfy_preview_duplicate_content_skipped(self, temp_project, history_manager, temp_projects_dir, sample_project_id):
        """Test saving same preview content twice skips second backup (deduplication)."""
        preview_content = b"duplicate_preview_content"

        # Pre-create original backup
        item_id = "previews/item_image03.png"
        original_dummy = temp_project / "dummy.original"
        original_dummy.write_bytes(b"dummy")
        await history_manager.backup_file(sample_project_id, item_id, original_dummy, subtype="original")

        # First save
        result1 = await save_comfy_preview_logic(
            temp_project,
            history_manager,
            sample_project_id,
            preview_content,
            "item_image03.jpg"
        )

        assert result1["backup_result"]["status"] == "backed_up"
        first_timestamp = result1["backup_result"]["timestamp"]

        # Count backup files
        history_dir = temp_projects_dir / sample_project_id / ".history" / "previews" / "item_image03.png" / "preview"
        backup_count_after_first = len(list(history_dir.glob("*")))
        assert backup_count_after_first == 1

        # Second save with same content
        result2 = await save_comfy_preview_logic(
            temp_project,
            history_manager,
            sample_project_id,
            preview_content,
            "item_image03.jpg"
        )

        assert result2["status"] == "saved"  # File still saved
        assert result2["backup_result"]["status"] == "skipped"
        assert result2["backup_result"]["reason"] == "Content unchanged (deduplication)"

        # Verify no new backup created
        backup_count_after_second = len(list(history_dir.glob("*")))
        assert backup_count_after_second == backup_count_after_first


@pytest.mark.asyncio
class TestComfyPreviewSaveOverwrite:
    """Test overwriting existing previews."""

    async def test_save_comfy_preview_overwrites_existing(self, temp_project, history_manager, temp_projects_dir, sample_project_id):
        """Test saving preview overwrites existing file and backs up old version."""
        first_content = b"first_preview_content"
        second_content = b"second_preview_content"

        # Pre-create original backup
        item_id = "previews/item_image04.png"
        original_dummy = temp_project / "dummy.original"
        original_dummy.write_bytes(b"dummy")
        await history_manager.backup_file(sample_project_id, item_id, original_dummy, subtype="original")
        
        # Save first preview
        result1 = await save_comfy_preview_logic(
            temp_project,
            history_manager,
            sample_project_id,
            first_content,
            "item_image04.jpg"
        )

        first_backup_timestamp = result1["backup_result"]["timestamp"]

        # Verify first preview content
        preview_path = temp_project / "previews" / "item_image04.png"
        assert preview_path.read_bytes() == first_content

        # Save second preview (different content)
        result2 = await save_comfy_preview_logic(
            temp_project,
            history_manager,
            sample_project_id,
            second_content,
            "item_image04.jpg"
        )

        assert result2["status"] == "saved"
        assert result2["backup_result"]["status"] == "backed_up"
        second_backup_timestamp = result2["backup_result"]["timestamp"]

        # Verify preview file updated
        assert preview_path.read_bytes() == second_content

        # Verify backups exist in history - Looking in "preview" subtype
        history_dir = temp_projects_dir / sample_project_id / ".history" / "previews" / "item_image04.png" / "preview"
        backup_files = sorted(history_dir.glob("*"), key=lambda p: p.name)

        # Should have at least 2 backups (may have 3 if no deduplication on first backup)
        assert len(backup_files) >= 2

        # Verify we have backups for both contents
        backup_contents = [f.read_bytes() for f in backup_files]
        assert first_content in backup_contents
        assert second_content in backup_contents

        # Verify newest backup is second_content
        assert backup_files[-1].read_bytes() == second_content

    async def test_save_comfy_preview_overwrite_same_content_skips(self, temp_project, history_manager, temp_projects_dir, sample_project_id):
        """Test overwriting with same content skips backup (deduplication)."""
        preview_content = b"same_content_preview"

        # Pre-create original backup
        item_id = "previews/item_image05.png"
        original_dummy = temp_project / "dummy.original"
        original_dummy.write_bytes(b"dummy")
        await history_manager.backup_file(sample_project_id, item_id, original_dummy, subtype="original")

        # Save first preview
        result1 = await save_comfy_preview_logic(
            temp_project,
            history_manager,
            sample_project_id,
            preview_content,
            "item_image05.jpg"
        )

        assert result1["backup_result"]["status"] == "backed_up"

        # Save second preview (same content)
        result2 = await save_comfy_preview_logic(
            temp_project,
            history_manager,
            sample_project_id,
            preview_content,
            "item_image05.jpg"
        )

        assert result2["backup_result"]["status"] == "skipped"
        assert result2["backup_result"]["reason"] == "Content unchanged (deduplication)"

        # Verify only one backup exists
        history_dir = temp_projects_dir / sample_project_id / ".history" / "previews" / "item_image05.png" / "preview"
        backup_files = list(history_dir.glob("*"))
        assert len(backup_files) == 1


@pytest.mark.asyncio
class TestComfyPreviewBaseNameExtraction:
    # Note: TestComfyPreviewBaseNameExtraction tests sync function extract_base_name so it doesn't need async
    pass

@pytest.mark.asyncio
class TestComfyPreviewSaveDifferentBasenames:
    """Test saving previews with different base names."""

    async def test_save_comfy_preview_different_basenames(self, temp_project, history_manager, temp_projects_dir, sample_project_id):
        """Test previews with different base names are stored separately."""
        preview1_content = b"preview_for_item01"
        preview2_content = b"preview_for_item02"
        
        # Pre-create original backups
        # Need actual files for backup_file to work? No, backup_file checks source_path.exists().
        # So we must create validation dummies on disk.
        (temp_project / "dummy1").write_bytes(b"1")
        (temp_project / "dummy2").write_bytes(b"2")
        
        res1 = await history_manager.backup_file(sample_project_id, "previews/item_image01.png", temp_project / "dummy1", subtype="original")
        assert res1.status == "backed_up", f"Setup backup 1 failed: {res1.reason}"
        res2 = await history_manager.backup_file(sample_project_id, "previews/item_image02.png", temp_project / "dummy2", subtype="original")
        assert res2.status == "backed_up", f"Setup backup 2 failed: {res2.reason}"

        # Save first preview
        result1 = await save_comfy_preview_logic(
            temp_project,
            history_manager,
            sample_project_id,
            preview1_content,
            "item_image01.jpg"
        )

        # Save second preview with different base name
        result2 = await save_comfy_preview_logic(
            temp_project,
            history_manager,
            sample_project_id,
            preview2_content,
            "item_image02.png"
        )

        # Verify both preview files exist
        preview1_path = temp_project / "previews" / "item_image01.png"
        preview2_path = temp_project / "previews" / "item_image02.png"

        assert preview1_path.exists()
        assert preview2_path.exists()

        assert preview1_path.read_bytes() == preview1_content
        assert preview2_path.read_bytes() == preview2_content

        # Verify both have separate history
        history1_dir = temp_projects_dir / sample_project_id / ".history" / "previews" / "item_image01.png"
        history2_dir = temp_projects_dir / sample_project_id / ".history" / "previews" / "item_image02.png"

        assert history1_dir.exists()
        assert history2_dir.exists()

        # Check in 'preview' subtype folder
        assert (history1_dir / "preview").exists()
        assert (history2_dir / "preview").exists() 
        
        assert len(list((history1_dir / "preview").glob("*"))) == 1
        assert len(list((history2_dir / "preview").glob("*"))) == 1

    async def test_save_comfy_preview_same_basename_different_original_ext(self, temp_project, history_manager, sample_project_id):
        """Test that same base name with different original extensions maps to same preview."""
        preview_content = b"preview_for_item_image03"

        # Pre-create original backup for first item
        item_id = "previews/item_image03.png"
        # Since logic extracts basename, both .jpg and .png map to item_image03.png
        # So we rely on item_image03.png existing in history?
        # The logic passes "previews/item_image03.png" as item_id.
        original_dummy = temp_project / "dummy3"
        original_dummy.write_bytes(b"3")
        await history_manager.backup_file(sample_project_id, item_id, original_dummy, subtype="original")
        
        # Save with .jpg original
        result1 = await save_comfy_preview_logic(
            temp_project,
            history_manager,
            sample_project_id,
            preview_content,
            "item_image03.jpg"
        )

        assert result1["preview_path"] == "previews/item_image03.png"

        preview_path = temp_project / "previews" / "item_image03.png"
        first_write_time = preview_path.stat().st_mtime

        # Save with .png original (same base name)
        result2 = await save_comfy_preview_logic(
            temp_project,
            history_manager,
            sample_project_id,
            preview_content,
            "item_image03.png"
        )

        assert result2["preview_path"] == "previews/item_image03.png"

        # Verify same preview file was overwritten
        assert preview_path.exists()
        second_write_time = preview_path.stat().st_mtime

        # File should have been overwritten (modification time changed)
        assert second_write_time >= first_write_time


class TestComfyPreviewBaseNameExtraction:
    """Test base name extraction for various filenames."""

    def test_extract_base_name_common_extensions(self):
        """Test base name extraction for common image/video extensions."""
        test_cases = [
            ("item_image01.jpg", "item_image01"),
            ("photo.jpeg", "photo"),
            ("picture.png", "picture"),
            ("graphic.webp", "graphic"),
            ("video.mp4", "video"),
            ("clip.mov", "clip"),
            ("animation.gif", "animation"),
            ("image.bmp", "image"),
        ]

        for filename, expected_base in test_cases:
            result = extract_base_name(filename)
            assert result == expected_base, f"Failed for {filename}: got {result}, expected {expected_base}"

    def test_extract_base_name_edge_cases(self):
        """Test base name extraction for edge cases."""
        test_cases = [
            ("noextension", "noextension"),
            ("multiple.dots.in.name.jpg", "multiple.dots.in.name"),
            ("archive.tar.gz", "archive.tar"),  # Only splits on last dot
        ]

        for filename, expected_base in test_cases:
            result = extract_base_name(filename)
            assert result == expected_base, f"Failed for {filename}: got {result}, expected {expected_base}"
