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
    pid = "test-sync-force"
    
    # Item A: image01
    await mgr.save_media_file(pid, "image01.jpg", b"A", subtype="original")
    
    # Item B: image02
    await mgr.save_media_file(pid, "image02.png", b"B", subtype="original")
    
    # Item C: video01 (Modified from image03 to match test expectations if needed, keeping mostly consistent)
    await mgr.save_media_file(pid, "video01.mp4", b"C", subtype="original")
    
    manifest = await mgr.load_manifest(pid)
    items = manifest["items"]
    
    # Map by base_name for easy access in tests
    item_map = {i["base_name"]: i for i in items}
    
    return pid, item_map, items

@pytest.mark.asyncio
async def test_force_sync_auto_deletes_missing(temp_v2_env, setup_items):
    """
    Scenario: Force=True. Request is missing items that exist on server.
    Expectation: Missing items are auto-deleted safely.
    """
    mgr, _ = temp_v2_env
    pid, item_map, _ = setup_items
    
    # Server has A, B, C
    # Request only A and B
    sync_list = [
        {"id": item_map["image01"]["id"], "filename": "image01.jpg"},
        {"id": item_map["image02"]["id"], "filename": "image02.png"},
    ]
    
    # Force=True
    await mgr.sync_items(pid, sync_list, force=True)
    
    # Verify C (video01) is gone
    manifest = await mgr.load_manifest(pid)
    item_ids = [i["id"] for i in manifest["items"]]
    assert item_map["video01"]["id"] not in item_ids
    assert len(item_ids) == 2

@pytest.mark.asyncio
async def test_force_sync_ignores_unknown(temp_v2_env, setup_items):
    """
    Scenario: Force=True. Request contains unknown IDs.
    Expectation: Unknown IDs are ignored (skipped), existing items synced.
    """
    mgr, _ = temp_v2_env
    pid, item_map, _ = setup_items
    
    # Request A + Unknown D
    sync_list = [
        {"id": item_map["image01"]["id"], "filename": "image01.jpg"},
        {"id": "unknown-uuid-1234", "filename": "ghost.jpg"},
    ]
    
    # Force=True
    await mgr.sync_items(pid, sync_list, force=True)
    
    # Verify result: 
    # - image01 is kept.
    # - image02, video01 are DELETED (because they were missing from request and force=True implies "make it look like this list")
    # - ghost.jpg is IGNORED (not created)
    
    manifest = await mgr.load_manifest(pid)
    item_ids = [i["id"] for i in manifest["items"]]
    
    assert item_map["image01"]["id"] in item_ids
    assert "unknown-uuid-1234" not in item_ids
    assert len(item_ids) == 1

@pytest.mark.asyncio
async def test_force_sync_cleanup_sidecars(temp_v2_env, setup_items):
    """
    Scenario: Force delete of an item.
    Expectation: ALL associated files (Original, Thumbnail, History, Preview) are deleted.
    """
    mgr, project_path = temp_v2_env
    pid, item_map, _ = setup_items
    item_id = item_map["image01"]["id"]
    base_name = item_map["image01"]["base_name"]
    
    # Setup Sidecars
    # 1. Thumbnail
    thumb_dir = project_path / pid / ".thumbnails"
    thumb_dir.mkdir(parents=True, exist_ok=True)
    thumb_path = thumb_dir / f"{item_id}_original.webp"
    thumb_path.touch()
    
    # 2. Preview (Mock)
    preview_dir = project_path / pid / "previews"
    preview_dir.mkdir(parents=True, exist_ok=True)
    # V2: Preview uses {item_id}.ext
    preview_path = preview_dir / f"{item_id}.png"
    preview_path.touch()
    
    # Update manifest to know about preview
    manifest = await mgr.load_manifest(pid)
    for item in manifest["items"]:
        if item["id"] == item_id:
            item["extensions"]["preview"] = ".png"
    await mgr._save_manifest(pid, manifest)
    
    # 3. History
    history_dir = project_path / pid / ".history" / item_id
    history_dir.mkdir(parents=True, exist_ok=True)
    (history_dir / "v1.json").touch()
    
    # Action: Force Sync without this item
    # Request only B and C
    sync_list = [
        {"id": item_map["image02"]["id"], "filename": "image02.png"},
        {"id": item_map["video01"]["id"], "filename": "video01.mp4"},
    ]
    
    await mgr.sync_items(pid, sync_list, force=True)
    
    # Verify:
    # 1. Item gone from manifest
    manifest = await mgr.load_manifest(pid)
    assert item_id not in [i["id"] for i in manifest["items"]]
    
    # 2. Files gone
    # 2. Files gone
    assert not (project_path / pid / f"{item_id}.jpg").exists(), "Original file should be deleted"
    assert not thumb_path.exists(), "Thumbnail should be deleted"
    assert not preview_path.exists(), "Preview should be deleted"
    assert not history_dir.exists(), "History directory should be deleted"

@pytest.mark.asyncio
async def test_force_sync_defaults_false(temp_v2_env, setup_items):
    """
    Scenario: Request missing items WITHOUT force=True (or force=False)
    Expectation: ValueError (Integrity Check)
    """
    mgr, _ = temp_v2_env
    pid, item_map, _ = setup_items
    
    # Request A only
    sync_list = [
        {"id": item_map["image01"]["id"], "filename": "image01.jpg"}
    ]
    
    # Default is force=False (should fail because force not passed, and existing items B,C missing)
    with pytest.raises(ValueError, match="Inventory mismatch"):
        await mgr.sync_items(pid, sync_list)
        
    # Explicit force=False
    with pytest.raises(ValueError, match="Inventory mismatch"):
        await mgr.sync_items(pid, sync_list, force=False)
