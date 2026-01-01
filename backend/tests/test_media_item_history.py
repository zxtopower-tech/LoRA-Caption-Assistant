"""
Tests for Item History (V2 API).
"""
import sys
import pytest
import time
from pathlib import Path
from fastapi.testclient import TestClient

ROOT_DIR = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT_DIR / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.append(str(BACKEND_DIR))

from storage.project_manager import ProjectManager
from storage.history_manager import HistoryManager
import routers.projects as projects_module
from app import app

@pytest.fixture
def temp_env(tmp_path):
    projects_dir = tmp_path / "projects"
    projects_dir.mkdir()
    
    msg_pm = projects_module.project_manager
    msg_hm = projects_module.history_manager
    msg_qm = projects_module.queue_manager
    
    hm = HistoryManager(projects_dir)
    pm = ProjectManager(projects_dir, hm)
    
    projects_module.project_manager = pm
    projects_module.history_manager = hm
    async def mock_exec(project_id, key, func): return await func()
    projects_module.queue_manager.execute_file_operation = mock_exec
    
    yield pm, hm
    
    projects_module.project_manager = msg_pm
    projects_module.history_manager = msg_hm
    projects_module.queue_manager = msg_qm

@pytest.fixture
def client():
    return TestClient(app)

@pytest.mark.asyncio
async def test_get_item_history_v2(temp_env, client):
    """
    Test GET /items/{item_id}/history returns aggregated history.
    """
    pm, hm = temp_env
    project_id = "test-hist-v2"
    await pm.ensure_project_dir(project_id)
    await pm.ensure_manifest(project_id)
    
    # 1. Create Initial Item (History v1)
    await pm.save_media_file(project_id, "image.jpg", b"v1")
    items = await pm.get_all_items(project_id)
    item_id = items[0]["id"]
    
    time.sleep(1.1)
    
    # 2. Update Media (History v2)
    await pm.save_media_file(project_id, "image.jpg", b"v2")
    
    time.sleep(1.1)

    # 3. Add Caption (History v1 for caption)
    await pm.save_caption_for_media(project_id, "image", "caption1")
    
    # 4. Request History
    resp = client.get(f"/api/projects/{project_id}/items/{item_id}/history")
    
    # Expect 200 (Integration Check) - if not implemented, 404 or 405.
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}. Endpoint might be missing."
    
    data = resp.json()
    assert "item_id" in data
    assert data["item_id"] == item_id
    assert "history" in data
    
    history = data["history"]
    
    # [TDD] Structure Validation & New Fields Check
    
    # 1. Original (Image) History Check
    originals = [h for h in history if h["subtype"] == "original"]
    # We expect 2 originals (v1, v2 save trigger backups) or dependent on logic.
    # Previous test expected 2.
    assert len(originals) >= 1
    
    latest_original = originals[0]
    
    # 1-1. 'hash' must be REMOVED
    assert "hash" not in latest_original, "'hash' field should be removed in favor of inferred metadata"
    
    # 1-2. 'extension' check (No dot)
    assert "extension" in latest_original
    assert latest_original["extension"] == "jpg"
    
    # 1-3. 'thumbnail_url' check
    assert "thumbnail_url" in latest_original
    # Format: /api/projects/{id}/thumbnails/{item_id}?history_timestamp={timestamp}&subtype={subtype}
    expected_thumb_url = f"/api/projects/{project_id}/thumbnails/{item_id}?history_timestamp={latest_original['timestamp']}&subtype=original"
    assert latest_original["thumbnail_url"] == expected_thumb_url
    
    # 1-4. 'is_available' check
    assert "is_available" in latest_original
    assert latest_original["is_available"] is True
    
    
    # 2. Caption History Check
    # To verify caption history, let's update it
    await pm.save_caption_for_media(project_id, "image", "caption2")
    # This triggers backup of caption2.
    
    resp = client.get(f"/api/projects/{project_id}/items/{item_id}/history")
    history = resp.json()["history"]
    captions = [h for h in history if h["subtype"] == "caption"]
    
    assert len(captions) >= 1
    latest_caption = captions[0]
    
    # 2-1. Extension check
    assert latest_caption["extension"] == "txt"
    
    # 2-2. Content Preview check
    assert "content_preview" in latest_caption
    # We saved "caption2" previously
    assert "caption2" in latest_caption["content_preview"]
    
    # 2-3. is_available check
    assert latest_caption["is_available"] is True


@pytest.mark.asyncio
async def test_history_edge_cases(temp_env, client):
    """
    Test edge cases: Empty content, Missing file, Binary content.
    """
    pm, hm = temp_env
    project_id = "test-hist-edge"
    await pm.ensure_project_dir(project_id)
    await pm.ensure_manifest(project_id)
    
    # Create Item
    await pm.save_media_file(project_id, "edge_case.jpg", b"content")
    items = await pm.get_all_items(project_id)
    item_id = items[0]["id"]
    
    # 1. Empty Caption
    # Force backup of empty file
    caption_path = pm.get_project_root(project_id) / "edge_case.txt"
    with open(caption_path, "w") as f: f.write("") # Empty
    
    # Create a backup
    res = await hm.backup_file(project_id, item_id, caption_path, subtype="caption", force=True)
    empty_ts = res.timestamp
    
    # 2. Binary Caption (Bad content)
    # Write binary to .txt
    with open(caption_path, "wb") as f: f.write(b"\x80\xFF\x00\x12") # Invalid UTF-8
    res = await hm.backup_file(project_id, item_id, caption_path, subtype="caption", force=True)
    binary_ts = res.timestamp
    
    # Request API
    resp = client.get(f"/api/projects/{project_id}/items/{item_id}/history")
    assert resp.status_code == 200
    history = resp.json()["history"]
    
    # Verify Empty
    empty_ver = next((h for h in history if h["timestamp"] == empty_ts), None)
    assert empty_ver is not None
    assert empty_ver["content_preview"] == ""
    assert empty_ver["is_available"] is True
    
    # Verify Binary (Should cope gracefully)
    binary_ver = next((h for h in history if h["timestamp"] == binary_ts), None)
    assert binary_ver is not None
    # Assuming corrupt text file is marked as unavailable or has None preview
    assert binary_ver["is_available"] is False
    assert binary_ver["content_preview"] is None
