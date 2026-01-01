"""
Tests for File Listing Metadata (V2 API).
"""
import sys
import pytest
from pathlib import Path
from fastapi.testclient import TestClient

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
    msg_qm = projects_module.queue_manager # also patch queue manager to be safe
    
    # Create new instances
    hm = HistoryManager(projects_dir)
    pm = ProjectManager(projects_dir, hm)
    
    # Patch
    projects_module.project_manager = pm
    projects_module.history_manager = hm
    # Mock queue execution to be synchronous
    async def mock_exec(project_id, key, func):
        return await func()
    projects_module.queue_manager.execute_file_operation = mock_exec
    
    yield pm, hm, projects_dir
    
    # Restore
    projects_module.project_manager = msg_pm
    projects_module.history_manager = msg_hm
    projects_module.queue_manager = msg_qm

@pytest.fixture
def client():
    return TestClient(app)

@pytest.mark.asyncio
async def test_list_items_metadata_v2(temp_env, client):
    """
    Test GET /items returns correct V2 structure with thumbnails and file URLs.
    """
    pm, hm, root_dir = temp_env
    project_id = "test-list-v2"
    await pm.ensure_project_dir(project_id)
    await pm.ensure_manifest(project_id)
    
    # Manually populate some items via PM
    # Item 1: Image only
    await pm.save_media_file(project_id, "image01.jpg", b"img1")
    
    # Item 2: Image + Caption
    await pm.save_media_file(project_id, "image02.png", b"img2")
    await pm.save_caption_for_media(project_id, "image02", "my caption")
    
    # Item 3: Video + Preview
    await pm.save_media_file(project_id, "video01.mp4", b"vid1")
    await pm.save_preview_for_media(project_id, "video01", b"thumb", ".png")
    
    # Call API
    resp = client.get(f"/api/projects/{project_id}/items")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    items = data["items"]
    assert len(items) == 3
    
    # Convert to dict by base_name for easy checking
    items_map = {item["base_name"]: item for item in items}
    
    # Check Item 1
    i1 = items_map["image01"]
    assert i1["extensions"]["original"] == ".jpg"
    assert "caption" not in i1["extensions"]
    assert "preview" not in i1["extensions"]
    assert "original" in i1["files"]
    assert i1["files"]["original"].endswith("image01.jpg")
    assert i1["thumbnail_url"].endswith(f"/thumbnails/{i1['id']}")
    
    # Check Item 2
    i2 = items_map["image02"]
    assert i2["extensions"]["original"] == ".png"
    assert i2["extensions"]["caption"] == ".txt"
    assert "caption" in i2["files"]
    assert i2["files"]["caption"].endswith("image02.txt")
    
    # Check Item 3
    i3 = items_map["video01"]
    assert i3["extensions"]["original"] == ".mp4"
    assert i3["extensions"]["preview"] == ".png"
    assert "preview" in i3["files"]
    assert i3["files"]["preview"].endswith("video01.png")
    
def test_list_items_project_not_found(temp_env, client):
    resp = client.get("/api/projects/non-existent/items")
    assert resp.status_code == 404
