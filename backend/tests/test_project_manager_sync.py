"""
TDD Tests for Manifest V2 Sync Logic.
Focuses on 'sync_items' method in ProjectManager.
"""

import sys
import pytest
import shutil
from pathlib import Path


# Adjust path to import backend modules
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
    pid = "test-sync-project"
    
    # Item A: image01
    await mgr.save_media_file(pid, "image01.jpg", b"A", subtype="original")
    
    # Item B: image02
    await mgr.save_media_file(pid, "image02.png", b"B", subtype="original")
    
    # Item C: image03
    await mgr.save_media_file(pid, "image03.webp", b"C", subtype="original")
    
    manifest = await mgr.load_manifest(pid)
    items = manifest["items"] # List order: A, B, C
    
    # Map by base_name for easy access in tests
    item_map = {i["base_name"]: i for i in items}
    
    return pid, item_map, items

@pytest.mark.asyncio
class TestManifestSync:

    async def test_sync_reorders_items(self, temp_v2_env, setup_items):
        """
        Scenario: Reorder items [A, B, C] -> [C, A, B].
        Expectation: Manifest 'items' list order reflects the change.
        """
        mgr, _ = temp_v2_env
        pid, item_map, original_items = setup_items
        
        # New Order: C, A, B
        new_order_ids = [
            item_map["image03"]["id"],
            item_map["image01"]["id"],
            item_map["image02"]["id"]
        ]
        
        # Construct sync input (just id and filename, simulation frontend request)
        # Note: Frontend sends {id, filename}, backend logic should rely on ID.
        sync_list = [
            {"id": item_map["image03"]["id"], "filename": "image03.webp"}, # Keep name
            {"id": item_map["image01"]["id"], "filename": "image01.jpg"}, # Keep name
            {"id": item_map["image02"]["id"], "filename": "image02.png"}, # Keep name
        ]
        
        await mgr.sync_items(pid, sync_list)
        
        # Verify
        manifest = await mgr.load_manifest(pid)
        current_ids = [i["id"] for i in manifest["items"]]
        assert current_ids == new_order_ids
        
    async def test_sync_renames_items(self, temp_v2_env, setup_items):
        """
        Scenario: Rename 'image01' -> 'photo_one'.
        Expectation: File on disk changes, Manifest updates base_name.
        """
        mgr, roots = temp_v2_env
        pid, item_map, _ = setup_items
        
        # Target: image01 -> photo_one
        target_id = item_map["image01"]["id"]
        
        sync_list = [
            {"id": item_map["image01"]["id"], "filename": "photo_one.jpg"}, # RENAME request
            {"id": item_map["image02"]["id"], "filename": "image02.png"},
            {"id": item_map["image03"]["id"], "filename": "image03.webp"},
        ]
        
        await mgr.sync_items(pid, sync_list)
        
        # Verify Manifest
        manifest = await mgr.load_manifest(pid)
        renamed_item = next(i for i in manifest["items"] if i["id"] == target_id)
        assert renamed_item["base_name"] == "photo_one"
        
        # Verify Disk (ID based)
        p_dir = roots / pid
        # File should exist at {uuid}.jpg
        assert (p_dir / f"{target_id}.jpg").exists()
        
        # Logical filenames should NOT exist
        assert not (p_dir / "photo_one.jpg").exists()
        assert not (p_dir / "image01.jpg").exists()

    async def test_sync_mixed_reorder_and_rename(self, temp_v2_env, setup_items):
        """
        Scenario: Reorder + Rename multiple items at once.
        [A, B, C] -> [B(renamed), C, A(renamed)]
        """
        mgr, roots = temp_v2_env
        pid, item_map, _ = setup_items
        
        # Plan:
        # B (image02) -> "b_moved"
        # C (image03) -> "image03" (No change)
        # A (image01) -> "a_moved"
        
        sync_list = [
            {"id": item_map["image02"]["id"], "filename": "b_moved.png"},
            {"id": item_map["image03"]["id"], "filename": "image03.webp"},
            {"id": item_map["image01"]["id"], "filename": "a_moved.jpg"},
        ]
        
        await mgr.sync_items(pid, sync_list)
        
        manifest = await mgr.load_manifest(pid)
        
        # Check Order
        assert manifest["items"][0]["id"] == item_map["image02"]["id"]
        assert manifest["items"][1]["id"] == item_map["image03"]["id"]
        assert manifest["items"][2]["id"] == item_map["image01"]["id"]
        
        # Check Names
        assert manifest["items"][0]["base_name"] == "b_moved"
        assert manifest["items"][2]["base_name"] == "a_moved"
        
        # Check Disk (UUIDs)
        p_dir = roots / pid
        id_b = item_map["image02"]["id"]
        id_a = item_map["image01"]["id"]
        
        assert (p_dir / f"{id_b}.png").exists()
        assert (p_dir / f"{id_a}.jpg").exists()
        
        # Ensure new logical names didn't create files
        assert not (p_dir / "b_moved.png").exists()
        assert not (p_dir / "a_moved.jpg").exists()

    async def test_sync_integrity_fails_on_missing_item(self, temp_v2_env, setup_items):
        """
        Scenario: Request does not include all existing IDs.
        Expectation: ValueError (Atomic, no partial updates).
        """
        mgr, _ = temp_v2_env
        pid, item_map, _ = setup_items
        
        # Missing Item C
        sync_list = [
            {"id": item_map["image01"]["id"], "filename": "image01.jpg"},
            {"id": item_map["image02"]["id"], "filename": "image02.png"},
        ]
        
        with pytest.raises(ValueError, match="Inventory mismatch"):
            await mgr.sync_items(pid, sync_list)
            
    async def test_sync_integrity_fails_on_unknown_id(self, temp_v2_env, setup_items):
        """
        Scenario: Request includes a garbage ID.
        """
        mgr, _ = temp_v2_env
        pid, item_map, _ = setup_items
        
        sync_list = [
            {"id": item_map["image01"]["id"], "filename": "image01.jpg"},
            {"id": item_map["image02"]["id"], "filename": "image02.png"},
            {"id": item_map["image03"]["id"], "filename": "image03.webp"},
            {"id": "garbage-uuid-1234", "filename": "hacker.jpg"},
        ]
        
        with pytest.raises(ValueError, match="Inventory mismatch"):
            await mgr.sync_items(pid, sync_list)

    async def test_sync_collision_rollback(self, temp_v2_env, setup_items):
        """
        Scenario: Try to rename A -> "image02" (which B uses).
        Expectation: ValueError (Collision), and A is NOT renamed on disk.
        """
        mgr, roots = temp_v2_env
        pid, item_map, _ = setup_items
        
        # Try to rename image01 -> image02 (Conflict with B)
        sync_list = [
            {"id": item_map["image01"]["id"], "filename": "image02.jpg"}, # Conflict!
            {"id": item_map["image02"]["id"], "filename": "image02.png"}, # B
            {"id": item_map["image03"]["id"], "filename": "image03.webp"},
        ]
        
        # Note: In a robust system, we might handle swapping names cleanly, 
        # but for now, duplicates are generally disallowed or handled strictly.
        # Assuming simple strict check first.
        
        with pytest.raises(ValueError, match="Duplicate filename"):
            await mgr.sync_items(pid, sync_list)
            
        # Verify Rollback (No change in Manifest)
        manifest = await mgr.load_manifest(pid)
        item_a = next(i for i in manifest["items"] if i["id"] == item_map["image01"]["id"])
        assert item_a["base_name"] == "image01"
        
        # Disk check (UUID matches)
        p_dir = roots / pid
        assert (p_dir / f"{item_map['image01']['id']}.jpg").exists()
