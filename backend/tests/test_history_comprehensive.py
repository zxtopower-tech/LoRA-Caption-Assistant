"""
Comprehensive Tests for History Logic (V2).
Covers lifecycle (Media+Caption+Preview), Deduplication, and Multiple Edits.
"""
import pytest
import sys
import time
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
async def test_history_lifecycle_full_v2(temp_v2_env):
    """
    Scenario: Media + Caption + Preview.
    Verify all subtypes have history.
    """
    pm, hm = temp_v2_env
    project_id = "test-hist-full-v2"
    await pm.ensure_project_dir(project_id)
    await pm.ensure_manifest(project_id)
    
    # 1. Media
    await pm.save_media_file(project_id, "image01.jpg", b"version1")
    items = await pm.get_all_items(project_id)
    item = items[0]
    item_id = item["id"]
    
    # 2. Caption
    await pm.save_caption_for_media(project_id, "image01", "caption v1")
    
    # 3. Preview
    await pm.save_preview_for_media(project_id, "image01", b"preview v1", ".png")
    
    # Verify History
    orig_hist = await hm.list_versions(project_id, item_id, subtype="original")
    cap_hist = await hm.list_versions(project_id, item_id, subtype="caption")
    prev_hist = await hm.list_versions(project_id, item_id, subtype="preview")
    
    assert len(orig_hist) == 1
    assert len(cap_hist) == 1
    assert len(prev_hist) == 1

@pytest.mark.asyncio
async def test_history_deduplication_v2(temp_v2_env):
    """
    Scenario: Save same content multiple times.
    Expect history count to NOT increase (deduplication).
    """
    pm, hm = temp_v2_env
    project_id = "test-hist-dedup-v2"
    await pm.ensure_project_dir(project_id)
    
    # 1. Initial Save
    await pm.save_media_file(project_id, "image02.jpg", b"same_content")
    items = await pm.get_all_items(project_id)
    item = items[0]
    item_id = item["id"]
    
    assert len(await hm.list_versions(project_id, item_id, subtype="original")) == 1
    
    # 2. Save exact same content 3 times
    for _ in range(3):
        # Note: save_media_file in V2 might update the file modification time,
        # but backup_file checks content hash.
        await pm.save_media_file(project_id, "image02.jpg", b"same_content")
        time.sleep(0.01) # Ensure separate timestamps if it WERE to backup
        
    # Verify history count is still 1
    hist = await hm.list_versions(project_id, item_id, subtype="original")
    assert len(hist) == 1

    # 3. Change content -> should backup
    await pm.save_media_file(project_id, "image02.jpg", b"NEW_content")
    hist_new = await hm.list_versions(project_id, item_id, subtype="original")
    assert len(hist_new) == 2

@pytest.mark.asyncio
async def test_history_multiple_edits_v2(temp_v2_env):
    """
    Scenario: Save distinct content multiple times.
    Expect history count to increase.
    """
    pm, hm = temp_v2_env
    project_id = "test-hist-edits-v2"
    await pm.ensure_project_dir(project_id)
    
    # Initial
    await pm.save_media_file(project_id, "doc.txt", b"v1")
    items = await pm.get_all_items(project_id)
    item = items[0]
    item_id = item["id"]
    
    # Edit 3 times
    for i in range(3):
        content = f"v{i+2}".encode('utf-8')
        time.sleep(1.1)
        await pm.save_media_file(project_id, "doc.txt", content)
        
    # Total versions: 1 (initial) + 3 (edits) = 4
    hist = await hm.list_versions(project_id, item_id, subtype="original")
    assert len(hist) == 4
