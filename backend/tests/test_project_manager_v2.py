"""
Tests for ProjectManager V2 Architecture (ID/Item-based).

This file defines the expected behavior for the Manifest V2 structure.
"""

import sys
import json
import pytest
from pathlib import Path

# Adjust path to import backend modules
ROOT_DIR = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT_DIR / "backend"
sys.path.append(str(BACKEND_DIR))

# We will import ProjectManager once it's recreated.
# For now, tests will import it but fail because file is missing, until we create it.
from storage.project_manager import ProjectManager
from storage.history_manager import HistoryManager

@pytest.fixture
def temp_v2_env(tmp_path):
    """Setup a temporary environment for V2 tests."""
    projects_dir = tmp_path / "projects"
    projects_dir.mkdir()
    
    # Initialize managers
    history_mgr = HistoryManager(projects_dir)
    project_mgr = ProjectManager(projects_dir, history_mgr)
    
    return project_mgr, projects_dir

@pytest.fixture
def project_id():
    return "test-project-v2"

@pytest.mark.asyncio
class TestProjectManagerV2:
    """Checking V2 Item-based Architecture."""

    async def test_ensure_manifest_creates_v2_structure(self, temp_v2_env, project_id):
        """
        Scenario: Initialize a new project.
        Expectation: Manifest version is 2, and root key is 'items'.
        """
        mgr, _ = temp_v2_env
        await mgr.ensure_project_dir(project_id)
        
        # This might need explicit initialization or just ensure_manifest
        manifest = await mgr.ensure_manifest(project_id)
        
        assert manifest.get("version") == 2
        assert "items" in manifest
        assert isinstance(manifest["items"], list)
        assert "files" not in manifest  # Should not have legacy key

    async def test_save_media_creates_item_entry(self, temp_v2_env, project_id):
        """
        Scenario: Upload 'image01.jpg'.
        Expectation:
        - Creates an Item with base_name='image01'.
        - extensions.original is '.jpg'.
        - File is saved as 'image01.jpg'.
        """
        mgr, root_dir = temp_v2_env
        filename = "image01.jpg"
        content = b"original_content"
        
        # Sync call (as decided for Manager level IO)
        await mgr.save_media_file(project_id, filename, content, subtype="original")
        
        # Verify Manifest
        manifest = await mgr.load_manifest(project_id)
        item = manifest["items"][0]
        
        assert item["base_name"] == "image01"
        assert item["extensions"]["original"] == ".jpg"
        assert "id" in item
        
        # Verify Disk
        project_dir = root_dir / project_id
        assert (project_dir / filename).exists()
        assert (project_dir / filename).read_bytes() == content

    async def test_add_caption_to_existing_item(self, temp_v2_env, project_id):
        """
        Scenario: 'image01.jpg' exists. Add caption 'image01.txt'.
        """
        mgr, _ = temp_v2_env
        
        # 1. Save Original
        await mgr.save_media_file(project_id, "image01.jpg", b"img", subtype="original")
        
        # 2. Save Caption
        # We'll stick to a clean API: save_caption_for_media(project_id, base_name, content)
        # Assuming SYNCHRONOUS now.
        await mgr.save_caption_for_media(project_id, "image01.jpg", "my caption")
        
        manifest = await mgr.load_manifest(project_id)
        assert len(manifest["items"]) == 1
        item = manifest["items"][0]
        
        assert item["extensions"]["original"] == ".jpg"
        assert item["extensions"]["caption"] == ".txt"

    async def test_add_preview_to_existing_item(self, temp_v2_env, project_id):
        """
        Scenario: 'image01.jpg' exists. Add preview.
        """
        mgr, root_dir = temp_v2_env
        await mgr.save_media_file(project_id, "image01.jpg", b"img", subtype="original")
        
        # New API: save_preview_for_media(project_id, base_name, content, ext)
        # Sync
        await mgr.save_preview_for_media(project_id, "image01.jpg", b"preview_data", preview_extension=".png")
        
        manifest = await mgr.load_manifest(project_id)
        item = manifest["items"][0]
        
        assert item["extensions"]["preview"] == ".png"
        
        # Check disk
        preview_path = root_dir / project_id / "previews" / "image01.png"
        assert preview_path.exists()

    async def test_rename_item_updates_all_files(self, temp_v2_env, project_id):
        """
        Scenario: Rename Item 'image01' -> 'vacation'.
        """
        mgr, root_dir = temp_v2_env
        
        # Setup
        await mgr.save_media_file(project_id, "image01.jpg", b"img", subtype="original")
        await mgr.save_caption_for_media(project_id, "image01.jpg", "cap")
        
        manifest = await mgr.load_manifest(project_id)
        original_id = manifest["items"][0]["id"]
        
        # Rename Action
        # We will use explicit method now: rename_item(project_id, item_id, new_base_name)
        await mgr.rename_item(project_id, original_id, "vacation")
        
        # Verify
        manifest = await mgr.load_manifest(project_id)
        item = manifest["items"][0]
        assert item["base_name"] == "vacation"
        assert item["id"] == original_id
        
        p_dir = root_dir / project_id
        assert not (p_dir / "image01.jpg").exists()
        assert (p_dir / "vacation.jpg").exists()
        assert not (p_dir / "image01.txt").exists()
        assert (p_dir / "vacation.txt").exists()

    async def test_delete_item_removes_all_files(self, temp_v2_env, project_id):
        """
        Scenario: Delete Item with Original, Caption, Preview.
        """
        mgr, root_dir = temp_v2_env
        # Setup
        await mgr.save_media_file(project_id, "image01.jpg", b"img", subtype="original")
        await mgr.save_caption_for_media(project_id, "image01.jpg", "cap")
        await mgr.save_preview_for_media(project_id, "image01.jpg", b"prev", preview_extension=".png")
        
        manifest = await mgr.load_manifest(project_id)
        item_id = manifest["items"][0]["id"]
        
        # Delete by ID
        await mgr.delete_item(project_id, item_id)
        
        # Verify
        manifest = await mgr.load_manifest(project_id)
        assert len(manifest["items"]) == 0
        
        p_dir = root_dir / project_id
        assert not (p_dir / "image01.jpg").exists()
        assert not (p_dir / "image01.txt").exists()
        assert not (p_dir / "previews" / "image01.png").exists()

    async def test_replace_extension_cleanup(self, temp_v2_env, project_id):
        """
        Scenario: Replace 'image01.jpg' with 'image01.png'.
        Expectation: 
        - 'image01.jpg' is DELETED.
        - 'image01.png' is CREATED.
        - Caption/Preview are PRESERVED.
        - Item ID same.
        """
        mgr, root_dir = temp_v2_env
        p_dir = root_dir / project_id
        
        # 1. Setup Initial State (JPG + Caption + Preview)
        await mgr.save_media_file(project_id, "image01.jpg", b"jpeg_content", subtype="original")
        await mgr.save_caption_for_media(project_id, "image01.jpg", "caption_content")
        await mgr.save_preview_for_media(project_id, "image01.jpg", b"preview_content", preview_extension=".png")
        
        # Verify setup
        assert (p_dir / "image01.jpg").exists()
        assert (p_dir / "image01.txt").exists()
        
        # 2. Replace with PNG (Same base_name 'image01')
        await mgr.save_media_file(project_id, "image01.png", b"png_content", subtype="original")
        
        # 3. Verify Cleanup
        manifest = await mgr.load_manifest(project_id)
        item = manifest["items"][0]
        
        assert item["extensions"]["original"] == ".png"
        assert item["extensions"]["caption"] == ".txt" # Preserved
        assert item["extensions"]["preview"] == ".png" # Preserved
        
        assert not (p_dir / "image01.jpg").exists(), "Old JPG should be deleted"
        assert (p_dir / "image01.png").exists(), "New PNG should exist"
        assert (p_dir / "image01.txt").exists(), "Caption should remain"
        assert (p_dir / "previews" / "image01.png").exists(), "Preview should remain"
