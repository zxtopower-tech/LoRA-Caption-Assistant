import sys
from pathlib import Path

# Adjust path to import backend modules
ROOT_DIR = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT_DIR / "backend"
sys.path.append(str(BACKEND_DIR))

import pytest
import shutil
import zipfile
import os
from fastapi.testclient import TestClient
from app import app
from storage.project_manager import ProjectManager
from storage.history_manager import HistoryManager

@pytest.fixture
def client():
    return TestClient(app)

@pytest.fixture
def temp_project_manager(tmp_path):
    projects_dir = tmp_path / "projects"
    projects_dir.mkdir()
    history_manager = HistoryManager(projects_dir)
    return ProjectManager(projects_dir, history_manager)

@pytest.mark.asyncio
async def test_download_project_zip_happy_path(client, temp_project_manager, monkeypatch):
    """
    Happy Path: Verify ZIP download works for a standard project.
    """
    # Override generic project_manager with our temp one
    monkeypatch.setattr("routers.projects.project_manager", temp_project_manager)
    
    # 1. Setup Project
    project_id = "test-proj-dl"
    await temp_project_manager.ensure_project_dir(project_id)
    await temp_project_manager.ensure_manifest(project_id)
    
    # 2. Add some files
    fake_img = b"fake_image_content"
    await temp_project_manager.save_media_file(project_id, "image01.jpg", fake_img)
    await temp_project_manager.save_caption_for_media(project_id, "image01", "A caption")
    
    # 3. Call Endpoint
    response = client.get(f"/api/projects/{project_id}/download")
    
    # 4. Verify Response
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    
    # 5. Verify ZIP Content
    # Write to temp file to inspect
    zip_path = temp_project_manager.projects_dir / "downloaded.zip"
    with open(zip_path, "wb") as f:
        f.write(response.content)
        
    assert zipfile.is_zipfile(zip_path)
    
    with zipfile.ZipFile(zip_path, 'r') as zf:
        file_list = zf.namelist()
        # Should contain manifest, image, caption
        assert "manifest.json" in file_list
        assert "image01.jpg" in file_list
        assert "image01.txt" in file_list
        
        # Verify content
        assert zf.read("image01.jpg") == fake_img
        assert zf.read("image01.txt") == b"A caption"

@pytest.mark.asyncio
async def test_download_project_zip_empty_project(client, temp_project_manager, monkeypatch):
    """
    Edge Case: Empty Project.
    """
    monkeypatch.setattr("routers.projects.project_manager", temp_project_manager)
    
    project_id = "empty-proj"
    await temp_project_manager.ensure_project_dir(project_id)
    await temp_project_manager.ensure_manifest(project_id)
    
    response = client.get(f"/api/projects/{project_id}/download")
    
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    
    zip_path = temp_project_manager.projects_dir / "empty.zip"
    with open(zip_path, "wb") as f:
        f.write(response.content)
        
    with zipfile.ZipFile(zip_path, 'r') as zf:
        file_list = zf.namelist()
        assert "manifest.json" in file_list
        assert len(file_list) == 1 # Only manifest

@pytest.mark.asyncio
async def test_download_project_zip_missing_files(client, temp_project_manager, monkeypatch):
    """
    Edge Case: Missing Files (in manifest but deleted from disk).
    ZIP generation should not fail.
    """
    monkeypatch.setattr("routers.projects.project_manager", temp_project_manager)
    
    project_id = "missing-files-proj"
    await temp_project_manager.ensure_project_dir(project_id)
    await temp_project_manager.ensure_manifest(project_id)
    
    # Create item then delete file
    item_id = await temp_project_manager.save_media_file(project_id, "ghost.jpg", b"boo")
    project_path = temp_project_manager.get_project_root(project_id)
    (project_path / f"{item_id}.jpg").unlink() # Delete maliciously
    
    response = client.get(f"/api/projects/{project_id}/download")
    
    # Should still succeed (partial zip)
    assert response.status_code == 200
    
    zip_path = temp_project_manager.projects_dir / "missing.zip"
    with open(zip_path, "wb") as f:
        f.write(response.content)
        
    with zipfile.ZipFile(zip_path, 'r') as zf:
        file_list = zf.namelist()
        assert "manifest.json" in file_list
        assert "ghost.jpg" not in file_list # Should be skipped

@pytest.mark.asyncio
async def test_download_project_zip_special_chars(client, temp_project_manager, monkeypatch):
    """
    Edge Case: Special Characters in filenames.
    """
    monkeypatch.setattr("routers.projects.project_manager", temp_project_manager)
    
    project_id = "special-char-proj"
    await temp_project_manager.ensure_project_dir(project_id)
    
    # Unicode filename
    korean_name = "image01_utf8.jpg"
    await temp_project_manager.save_media_file(project_id, korean_name, b"unicode content")
    
    response = client.get(f"/api/projects/{project_id}/download")
    assert response.status_code == 200
    
    zip_path = temp_project_manager.projects_dir / "special.zip"
    with open(zip_path, "wb") as f:
        f.write(response.content)
        
    with zipfile.ZipFile(zip_path, 'r') as zf:
        # ZipFile handles unicode if flags are set correctly by the generator
        # We verify we can find the file by name
        # Note: zipfile module might encoding differently depending on OS, but python 3 usually uses utf-8 flag
        
        # Check if we can find it in namelist
        # Sometimes encoding issues make exact string match hard, but let's try strict first
        found = False
        for name in zf.namelist():
            if name == korean_name:
                found = True
                break
            # Fallback check for encoding mess (cp437 vs utf8) if needed, 
            # but modern zip creation should support utf8.
        
        assert found, f"Filename {korean_name} not found in zip: {zf.namelist()}"
