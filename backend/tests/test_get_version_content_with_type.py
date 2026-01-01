"""
Tests for HistoryManager.get_version_content() using V2 ProjectManager integration.
"""
import pytest
import sys
import base64
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
async def test_get_original_content_base64_v2(temp_v2_env):
    """
    Test 1: Get original file content via history (media).
    Should receive Base64 encoded string.
    """
    pm, hm = temp_v2_env
    project_id = "test-get-ver-orig"
    await pm.ensure_project_dir(project_id)
    await pm.ensure_manifest(project_id)
    
    # 1. Create Media
    original_bytes = b"original data"
    await pm.save_media_file(project_id, "image01.jpg", original_bytes)
    items = await pm.get_all_items(project_id)
    item = items[0]
    item_id = item["id"]
    
    # Verify we have 1 version
    history = await hm.list_versions(project_id, item_id, subtype="original")
    assert len(history) == 1
    timestamp = history[0]["timestamp"]
    
    # 2. Get Content
    content = await hm.get_version_content(project_id, item_id, timestamp, subtype="original")
    assert content is not None
    
    # Expect Base64
    expected_b64 = base64.b64encode(original_bytes).decode('ascii')
    assert content == expected_b64

@pytest.mark.asyncio
async def test_get_caption_content_text_v2(temp_v2_env):
    """
    Test 2: Get caption file content via history.
    Should receive raw text string.
    """
    pm, hm = temp_v2_env
    project_id = "test-get-ver-cap"
    await pm.ensure_project_dir(project_id)
    
    # 1. Create Media (dependency)
    await pm.save_media_file(project_id, "image02.jpg", b"dummy")
    items = await pm.get_all_items(project_id)
    item = items[0]
    item_id = item["id"]
    
    # 2. Save Caption
    caption_text = "my detailed caption"
    await pm.save_caption_for_media(project_id, "image02", caption_text)
    
    # Verify history
    history = await hm.list_versions(project_id, item_id, subtype="caption")
    assert len(history) == 1
    timestamp = history[0]["timestamp"]
    
    # 3. Get Content
    content = await hm.get_version_content(project_id, item_id, timestamp, subtype="caption")
    assert content is not None
    
    # Expect Text (exact match)
    assert content == caption_text

@pytest.mark.asyncio
async def test_get_preview_content_base64_v2(temp_v2_env):
    """
    Test 3: Get preview content via history.
    Should receive Base64 encoded string.
    """
    pm, hm = temp_v2_env
    project_id = "test-get-ver-prev"
    await pm.ensure_project_dir(project_id)
    
    # 1. Create Media
    await pm.save_media_file(project_id, "video.mp4", b"video")
    items = await pm.get_all_items(project_id)
    item = items[0]
    item_id = item["id"]
    
    # 2. Save Preview
    preview_bytes = b"preview PNG data"
    await pm.save_preview_for_media(project_id, "video", preview_bytes, ".png")
    
    # Verify history
    history = await hm.list_versions(project_id, item_id, subtype="preview")
    assert len(history) == 1
    timestamp = history[0]["timestamp"]
    
    # 3. Get Content
    content = await hm.get_version_content(project_id, item_id, timestamp, subtype="preview")
    assert content is not None
    
    # Expect Base64
    expected_b64 = base64.b64encode(preview_bytes).decode('ascii')
    assert content == expected_b64
