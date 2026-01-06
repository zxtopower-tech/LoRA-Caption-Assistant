"""
TDD Tests for Manifest V2 Deletion Logic.
"""

import sys
import pytest
from pathlib import Path

# Adjust path to import backend modules
ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

from storage.project_manager import ProjectManager
from storage.history_manager import HistoryManager

@pytest.fixture
def temp_v2_env(tmp_path):
    """Setup a temporary environment for V2 tests."""
    projects_dir = tmp_path / "projects"
    projects_dir.mkdir()
    
    history_mgr = HistoryManager(projects_dir)
    project_mgr = ProjectManager(projects_dir, history_mgr)
    
    return project_mgr, projects_dir

@pytest.fixture
async def setup_items(temp_v2_env):
    """Create a project with 3 standard items."""
    mgr, _ = temp_v2_env
    pid = "test-sync-deletion"
    
    # Item A: image01
    await mgr.save_media_file(pid, "image01.jpg", b"A", subtype="original")
    
    # Item B: image02
    await mgr.save_media_file(pid, "image02.png", b"B", subtype="original")
    
    # Item C: image03
    await mgr.save_media_file(pid, "image03.webp", b"C", subtype="original")
    
    manifest = await mgr.load_manifest(pid)
    items = manifest["items"]
    
    # Map by base_name for easy access in tests
    item_map = {i["base_name"]: i for i in items}
    
    return pid, item_map, items

@pytest.mark.asyncio
class TestManifestDeletion:

    async def test_sync_deletes_items(self, temp_v2_env, setup_items):
        """
        Scenario: Explicitly delete Item B.
        Expectation: Item B removed from manifest and disk. A and C remain.
        """
        mgr, roots = temp_v2_env
        pid, item_map, _ = setup_items
        
        # Keep A and C, Delete B
        sync_list = [
            {"id": item_map["image01"]["id"], "filename": "image01.jpg"},
            {"id": item_map["image03"]["id"], "filename": "image03.webp"},
        ]
        
        deleted_ids = [item_map["image02"]["id"]]
        
        # Call sync with deleted_items
        await mgr.sync_items(pid, sync_list, deleted_items=deleted_ids)
        
        # Verify Manifest
        manifest = await mgr.load_manifest(pid)
        current_ids = [i["id"] for i in manifest["items"]]
        assert item_map["image02"]["id"] not in current_ids
        assert len(current_ids) == 2
        
        # Verify Disk (ID based)
        p_dir = roots / pid
        # A and C exist
        assert (p_dir / f"{item_map['image01']['id']}.jpg").exists()
        assert (p_dir / f"{item_map['image03']['id']}.webp").exists()
        
        # B Deleted
        assert not (p_dir / f"{item_map['image02']['id']}.png").exists()

    async def test_sync_overlap_error(self, temp_v2_env, setup_items):
        """
        Scenario: Item B is in BOTH 'files' and 'deleted_items'.
        Expectation: ValueError (Ambiguous request).
        """
        mgr, _ = temp_v2_env
        pid, item_map, _ = setup_items
        
        sync_list = [
            {"id": item_map["image01"]["id"], "filename": "image01.jpg"},
            {"id": item_map["image02"]["id"], "filename": "image02.png"}, # Keep B
        ]
        
        deleted_ids = [item_map["image02"]["id"]] # Delete B too?
        
        with pytest.raises(ValueError, match="Overlap detected"):
            await mgr.sync_items(pid, sync_list, deleted_items=deleted_ids)

    async def test_sync_non_existent_delete_error(self, temp_v2_env, setup_items):
        """
        Scenario: Try to delete an ID that doesn't exist.
        Expectation: ValueError (Strict Integrity).
        """
        mgr, _ = temp_v2_env
        pid, item_map, _ = setup_items
        
        sync_list = [
            {"id": item_map["image01"]["id"], "filename": "image01.jpg"},
            {"id": item_map["image02"]["id"], "filename": "image02.png"},
            {"id": item_map["image03"]["id"], "filename": "image03.webp"},
        ]
        
        deleted_ids = ["garbage-uuid-999"]
        
        with pytest.raises(ValueError, match="Inventory mismatch"):
            await mgr.sync_items(pid, sync_list, deleted_items=deleted_ids)

    async def test_sync_partial_mismatch_error(self, temp_v2_env, setup_items):
        """
        Scenario: Keep A, Delete B, but existing C is mentioned nowhere.
        Expectation: ValueError (Inventory mismatch - C is unaccounted for).
        """
        mgr, _ = temp_v2_env
        pid, item_map, _ = setup_items
        
        sync_list = [
            {"id": item_map["image01"]["id"], "filename": "image01.jpg"},
        ]
        
        deleted_ids = [item_map["image02"]["id"]]
        
        # C is missing entirely
        
        with pytest.raises(ValueError, match="Inventory mismatch"):
            await mgr.sync_items(pid, sync_list, deleted_items=deleted_ids)

    async def test_sync_empty_project(self, temp_v2_env, setup_items):
        """
        Scenario: Delete ALL items.
        Expectation: Project becomes empty.
        """
        mgr, roots = temp_v2_env
        pid, item_map, _ = setup_items
        
        sync_list = []
        deleted_ids = [
            item_map["image01"]["id"],
            item_map["image02"]["id"],
            item_map["image03"]["id"]
        ]
        
        await mgr.sync_items(pid, sync_list, deleted_items=deleted_ids)
        
        manifest = await mgr.load_manifest(pid)
        assert len(manifest["items"]) == 0
        
        p_dir = roots / pid
        p_dir = roots / pid
        assert not (p_dir / f"{item_map['image01']['id']}.jpg").exists()
        assert not (p_dir / f"{item_map['image02']['id']}.png").exists()
        assert not (p_dir / f"{item_map['image03']['id']}.webp").exists()
