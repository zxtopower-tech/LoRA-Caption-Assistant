"""
Tests for Media Upload Flow (V2 API).
"""
import sys
import pytest
from pathlib import Path
from fastapi.testclient import TestClient

# Adjust path to import backend modules
ROOT_DIR = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT_DIR / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.append(str(BACKEND_DIR))

from storage.project_manager import ProjectManager
from storage.history_manager import HistoryManager
# Import the module so we can patch it
import routers.projects as projects_module
from app import app

@pytest.fixture
def temp_env(tmp_path):
    projects_dir = tmp_path / "projects"
    projects_dir.mkdir()
    
    # Store old instances
    msg_pm = projects_module.project_manager
    msg_hm = projects_module.history_manager
    msg_qm = projects_module.queue_manager
    
    # Create new instances
    hm = HistoryManager(projects_dir)
    pm = ProjectManager(projects_dir, hm)
    
    # Helper to bypass queue and run immediately (since queue_manager uses background threads/asyncio)
    # But queue_manager.execute_file_operation uses asyncio.
    # TestClient calls endpoints which async def.
    # We can probably use the real queue manager logic if it's thread safe or async compatible.
    # Or, mock it to just run the function.
    
    async def mock_exec(project_id, key, func):
        return await func()
    
    projects_module.queue_manager.execute_file_operation = mock_exec
    projects_module.project_manager = pm
    projects_module.history_manager = hm
    
    yield pm, hm
    
    # Restore
    projects_module.project_manager = msg_pm
    projects_module.history_manager = msg_hm
    projects_module.queue_manager = msg_qm

@pytest.fixture
def client():
    return TestClient(app)

@pytest.mark.asyncio
async def test_upload_flow_v2_full(temp_env, client):
    """
    Test the full lifecycle: Upload Media -> Add Caption -> Add Preview.
    """
    pm, hm = temp_env
    project_id = "test-upload-v2"
    
    # 0. Setup Project
    await pm.ensure_project_dir(project_id)
    await pm.ensure_manifest(project_id)
    
    # 1. Upload Item (Original)
    files = {"file": ("scene_01.jpg", b"image_content", "image/jpeg")}
    resp = client.post(f"/api/projects/{project_id}/items", files=files)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "id" in data
    item_id = data["id"]
    
    # Verify Manifest
    item = await pm.get_item(project_id, item_id)
    assert item is not None
    assert item["base_name"] == "scene_01"
    assert item["extensions"]["original"] == ".jpg"
    
    # 2. Upload Caption
    # Endpoint: POST /.../items/{item_id}/caption
    caption_data = {"caption": "A nice sunset"}
    resp = client.post(f"/api/projects/{project_id}/items/{item_id}/caption", data=caption_data)
    assert resp.status_code == 200, resp.text
    
    # Verify Caption on disk (ID-based)
    project_root = pm.get_project_root(project_id)
    assert (project_root / f"{item_id}.txt").read_text() == "A nice sunset"
    
    # Verify metadata
    item = await pm.get_item(project_id, item_id)
    assert item["extensions"]["caption"] == ".txt"
    
    # 3. Upload Preview
    # Endpoint: POST /.../items/{item_id}/preview
    preview_file = {"file": ("preview_thumb.png", b"preview_png_data", "image/png")}
    resp = client.post(f"/api/projects/{project_id}/items/{item_id}/preview", files=preview_file)
    assert resp.status_code == 200, resp.text
    
    # Verify Preview on disk (ID-based)
    assert (project_root / "previews" / f"{item_id}.png").read_bytes() == b"preview_png_data"
    
    # Verify metadata
    item = await pm.get_item(project_id, item_id)
    assert item["extensions"]["preview"] == ".png"

@pytest.mark.asyncio
async def test_upload_duplicate_rename(temp_env, client):
    """
    Test behavior when uploading a file with existing base_name. I expect UPDATE.
    """
    pm, hm = temp_env
    project_id = "test-dup-v2"
    await pm.ensure_project_dir(project_id)
    await pm.ensure_manifest(project_id)
    
    # Upload first
    client.post(f"/api/projects/{project_id}/items", files={"file": ("MyChar.webp", b"v1", "image/webp")})
    item1 = (await pm.get_all_items(project_id))[0]
    id1 = item1["id"]
    
    # Upload same name again
    client.post(f"/api/projects/{project_id}/items", files={"file": ("MyChar.webp", b"v2", "image/webp")})
    
    items = await pm.get_all_items(project_id)
    assert len(items) == 1, "Should stay 1 item (update logic)"
    item2 = items[0]
    assert item2["id"] == id1, "ID should persist on update"
    
    # Verify content changed (ID-based)
    root = pm.get_project_root(project_id)
    assert (root / f"{id1}.webp").read_bytes() == b"v2"
