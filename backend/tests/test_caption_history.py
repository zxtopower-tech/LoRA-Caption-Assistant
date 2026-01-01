"""
Tests for Caption History (V2).
Verifies that caption updates trigger history backups correctly using ID-based architecture.

New logic:
- blank → blank: skip
- blank → new_caption: save history (new_caption)
- existing → new_caption: save history (new_caption)
- existing → blank: skip
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
async def test_caption_update_creates_history_v2(temp_v2_env):
    """
    Test that updating a caption creates a history entry.
    New logic: blank → existing creates history, existing → existing creates history.
    """
    pm, hm = temp_v2_env
    project_id = "test-cap-hist-v2"
    await pm.ensure_project_dir(project_id)
    await pm.ensure_manifest(project_id)

    # 1. Create Media
    await pm.save_media_file(project_id, "image01.jpg", b"image content")
    items = await pm.get_all_items(project_id)
    item = items[0]
    item_id = item["id"]

    # 2. Save Initial Caption (blank → existing, history expected)
    await pm.save_caption_for_media(project_id, "image01", "caption v1")

    # Verify History (should be 1 - first save creates history)
    history = await hm.list_versions(project_id, item_id, subtype="caption")
    assert len(history) == 1, "First caption save should create history"


    # 3. Update Caption (existing → existing changed, history expected)
    time.sleep(1.1)
    await pm.save_caption_for_media(project_id, "image01", "caption v2")

    # Verify History increased
    history = await hm.list_versions(project_id, item_id, subtype="caption")
    assert len(history) == 2, "Caption update should create history"

    # Sort by timestamp desc
    history.sort(key=lambda x: x["timestamp"], reverse=True)

    # Verify contents (if possible, but list_versions only gives metadata)
    # We can assume strict ordering by time.

@pytest.mark.asyncio
async def test_caption_history_separation(temp_v2_env):
    """
    Ensure caption history is separate from original media history.
    """
    pm, hm = temp_v2_env
    project_id = "test-cap-sep-v2"
    await pm.ensure_project_dir(project_id)

    # 1. Save Media
    await pm.save_media_file(project_id, "video.mp4", b"video")
    items = await pm.get_all_items(project_id)
    item_id = items[0]["id"]

    # 2. Save Caption (blank → existing, history expected)
    await pm.save_caption_for_media(project_id, "video", "cap1")

    # 3. Update Caption (existing → existing changed, creates history)
    time.sleep(1.1)
    await pm.save_caption_for_media(project_id, "video", "cap2")

    # 4. Update Media
    time.sleep(1.1)
    await pm.save_media_file(project_id, "video.mp4", b"video v2")

    # Check histories
    original_hist = await hm.list_versions(project_id, item_id, subtype="original")
    caption_hist = await hm.list_versions(project_id, item_id, subtype="caption")

    # Original: v1, v2 (2 entries)
    assert len(original_hist) == 2

    # Caption: cap1, cap2 (2 entries, both saves create history)
    assert len(caption_hist) == 2


@pytest.mark.asyncio
async def test_caption_blank_scenarios(temp_v2_env):
    """
    Test caption history behavior for blank scenarios:
    - blank → blank: no history
    - blank → existing: save history (new_caption)
    - existing → existing (changed): save history (new_caption)
    - existing → blank: skip (no new_caption)
    """
    pm, hm = temp_v2_env
    project_id = "test-cap-blank"
    await pm.ensure_project_dir(project_id)
    await pm.ensure_manifest(project_id)

    # Create media
    await pm.save_media_file(project_id, "image01.jpg", b"image content")
    items = await pm.get_all_items(project_id)
    item = items[0]
    item_id = item["id"]

    # Scenario 1: blank → blank (no history expected)
    await pm.save_caption_for_media(project_id, "image01", "")
    history = await hm.list_versions(project_id, item_id, subtype="caption")
    assert len(history) == 0, "blank → blank should not create history"

    # Scenario 2: blank → existing (history expected - new_caption)
    await pm.save_caption_for_media(project_id, "image01", "first caption")
    history = await hm.list_versions(project_id, item_id, subtype="caption")
    assert len(history) == 1, "blank → existing should create history (new_caption)"

    # Scenario 3: existing → existing (changed) (history expected - new_caption)
    time.sleep(1.1)
    await pm.save_caption_for_media(project_id, "image01", "second caption")
    history = await hm.list_versions(project_id, item_id, subtype="caption")
    assert len(history) == 2, "existing → changed should create history (new_caption)"

    # Scenario 4: existing → blank (skip - no new_caption)
    time.sleep(1.1)
    await pm.save_caption_for_media(project_id, "image01", "")
    history = await hm.list_versions(project_id, item_id, subtype="caption")
    assert len(history) == 2, "existing → blank should not create history (no new_caption)"
