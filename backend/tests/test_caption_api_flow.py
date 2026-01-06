"""
Tests for Caption API Flow (V2) using ProjectManager directly.
"""
import pytest
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT_DIR / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.append(str(BACKEND_DIR))

from storage.project_manager import ProjectManager
from storage.history_manager import HistoryManager

@pytest.fixture
def temp_v2_env(tmp_path):
    projects_dir = tmp_path / "projects"
    projects_dir.mkdir()
    hm = HistoryManager(projects_dir)
    pm = ProjectManager(projects_dir, hm)
    return pm, hm

@pytest.mark.asyncio
async def test_caption_update_referencing_media_filename(temp_v2_env):
    """
    Test saving caption by referencing the media filename (e.g. image.jpg).
    This simulates frontend sending 'image.jpg' as key for caption update.
    """
    pm, hm = temp_v2_env
    project_id = "test-cap-media-ref"
    await pm.ensure_project_dir(project_id)
    await pm.ensure_manifest(project_id)
    
    # 1. Create Media
    await pm.save_media_file(project_id, "image01.jpg", b"content")
    items = await pm.get_all_items(project_id)
    item = items[0]
    
    # 2. Save Caption using "image01.jpg"
    # ProjectManager.save_caption_for_media logic should handle stripping ext
    await pm.save_caption_for_media(project_id, "image01.jpg", "caption content")
    
    # Verify file
    project_root = pm.get_project_root(project_id) # get_project_root is likely sync (path op)
    # Check if get_project_root is async? Viewed it before: it is sync.
    assert (project_root / f"{item['id']}.txt").read_text() == "caption content"
    
    # Verify Manifest
    item = await pm.get_item(project_id, item["id"])
    assert item["extensions"]["caption"] == ".txt"

@pytest.mark.asyncio
async def test_caption_update_referencing_txt_filename(temp_v2_env):
    """
    Test saving caption by referencing the txt filename (e.g. image.txt).
    """
    pm, hm = temp_v2_env
    project_id = "test-cap-txt-ref"
    await pm.ensure_project_dir(project_id)
    await pm.ensure_manifest(project_id)
    
    # 1. Create Media
    await pm.save_media_file(project_id, "image02.jpg", b"content")
    items = await pm.get_all_items(project_id)
    item = items[0]
    
    # 2. Save Caption using "image02.txt"
    await pm.save_caption_for_media(project_id, "image02.txt", "caption content 2")
    
    # Verify file
    project_root = pm.get_project_root(project_id)
    assert (project_root / f"{item['id']}.txt").read_text() == "caption content 2"
    
    # Verify Manifest
    item = await pm.get_item(project_id, item["id"])
    assert item["extensions"]["caption"] == ".txt"

@pytest.mark.asyncio
async def test_caption_update_non_existent_item(temp_v2_env):
    """
    Test error when saving caption for non-existent item.
    """
    pm, _ = temp_v2_env
    project_id = "test-cap-fail"
    await pm.ensure_project_dir(project_id)
    
    with pytest.raises(ValueError, match="Item not found"):
        await pm.save_caption_for_media(project_id, "missing.jpg", "content")
