
import pytest
import shutil
import json
import time
from pathlib import Path
from unittest.mock import MagicMock, patch
from PIL import Image

from storage.project_manager import ProjectManager
from storage.history_manager import HistoryManager

@pytest.fixture
def test_env(tmp_path):
    projects_dir = tmp_path / "projects"
    history_dir = tmp_path / "history"
    projects_dir.mkdir()
    history_dir.mkdir()
    
    hm = HistoryManager(history_dir)
    pm = ProjectManager(projects_dir, hm)
    return pm, projects_dir

@pytest.fixture
async def mock_project(test_env):
    pm, _ = test_env
    project_id = "test-proj-meta"
    await pm.ensure_project_dir(project_id)
    await pm.ensure_manifest(project_id)
    return project_id

def create_dummy_image(path: Path, width=100, height=100):
    img = Image.new('RGB', (width, height), color='red')
    img.save(path)

def create_corrupt_file(path: Path):
    with open(path, 'wb') as f:
        f.write(b'not an image or video')

@pytest.mark.asyncio
async def test_extract_image_metadata_happy_path(test_env, mock_project):
    """Test standard image metadata extraction."""
    pm, _ = test_env
    project_id = mock_project
    
    # Setup
    filename = "test_img.jpg"
    file_path = pm._get_project_path(project_id) / filename
    create_dummy_image(file_path, width=640, height=480)
    
    # Save (initially without metadata)
    with open(file_path, 'rb') as f:
        content = f.read()
    item_id = await pm.save_media_file(project_id, filename, content)
    
    # Metadata should be empty initially (assuming only save_media_file was called and it doesn't do it anymore)
    # But wait, our Plan says save_media_file NO LONGER does it. 
    # So we must manually run the update method which we are testing.
    
    # ACT: Run the async task synchronously for testing
    await pm.update_item_metadata(project_id, item_id)
    
    # ASSERT
    item = await pm.get_item(project_id, item_id)
    assert "metadata" in item
    assert item["metadata"]["width"] == 640
    assert item["metadata"]["height"] == 480
    # Also check extension logic didn't break
    assert item["extensions"]["original"] == ".jpg"

@pytest.mark.asyncio
async def test_extract_video_metadata_mocked(test_env, mock_project):
    """Test video metadata using mocked ffprobe."""
    pm, _ = test_env
    project_id = mock_project
    
    filename = "test_vid.mp4"
    file_path = pm._get_project_path(project_id) / filename
    create_corrupt_file(file_path) # Content doesn't matter since we mock probe
    
    with open(file_path, 'rb') as f:
        content = f.read()
    item_id = await pm.save_media_file(project_id, filename, content)

    # Mock static_ffmpeg (or wherever probe_media logic lives)
    # Since we haven't implemented `_probe_video_metadata` yet, we expect this test to fail 
    # or we mock the internal call calls.
    # Let's mock the method `_probe_video_metadata` on the instance if possible, 
    # or patch the external dependency. 
    # For TDD reducement, let's assume `_probe_video_metadata` will exist.
    
    with patch.object(pm, '_probe_video_metadata', return_value={"duration": 12.5, "width": 1920, "height": 1080}) as mock_probe:
        await pm.update_item_metadata(project_id, item_id)
        
        mock_probe.assert_called_once()
        
    item = await pm.get_item(project_id, item_id)
    assert item["metadata"]["duration"] == 12.5
    assert item["metadata"]["width"] == 1920

@pytest.mark.asyncio
async def test_extract_metadata_corrupt_file(test_env, mock_project):
    """Corrupt file should result in empty metadata, not a crash."""
    pm, _ = test_env
    project_id = mock_project
    
    filename = "corrupt.jpg"
    file_path = pm._get_project_path(project_id) / filename
    create_corrupt_file(file_path)
    
    with open(file_path, 'rb') as f:
        item_id = await pm.save_media_file(project_id, filename, f.read())
        
    # Act
    await pm.update_item_metadata(project_id, item_id)
    
    # Assert
    item = await pm.get_item(project_id, item_id)
    # Metadata field should exist but be empty (or error info if we chose updates)
    assert item["metadata"] == {}

@pytest.mark.asyncio
async def test_race_condition_file_deleted(test_env, mock_project):
    """If file is deleted before metadata task runs, it should handle gracefully."""
    pm, _ = test_env
    project_id = mock_project
    
    filename = "ghost.jpg"
    file_path = pm._get_project_path(project_id) / filename
    create_dummy_image(file_path)
    
    with open(file_path, 'rb') as f:
        item_id = await pm.save_media_file(project_id, filename, f.read())
        
    # Simulate delete
    await pm.delete_item(project_id, item_id)
    
    # Act: Task runs LATE
    # It should not raise error
    try:
        await pm.update_item_metadata(project_id, item_id)
    except Exception as e:
        pytest.fail(f"update_item_metadata raised exception on deleted item: {e}")
        
    # Double check it didn't recreate anything weird
    assert await pm.get_item(project_id, item_id) is None

@pytest.mark.asyncio
async def test_extension_replacement_clears_metadata(test_env, mock_project):
    """If a file is replaced (ext change), we must ensure metadata is re-generated or cleared logic holds."""
    pm, _ = test_env
    project_id = mock_project
    
    # 1. Save Image
    fname1 = "asset.jpg"
    path1 = pm._get_project_path(project_id) / fname1
    create_dummy_image(path1, 100, 100)
    with open(path1, 'rb') as f:
        item_id = await pm.save_media_file(project_id, fname1, f.read()) # Implies update
        
    await pm.update_item_metadata(project_id, item_id)
    assert (await pm.get_item(project_id, item_id))["metadata"]["width"] == 100
    
    # 2. Upload Video with same base name (Replacement)
    fname2 = "asset.mp4"
    path2 = pm._get_project_path(project_id) / fname2
    create_corrupt_file(path2) # Mocking probe anyway
    
    with open(path2, 'rb') as f:
        # This will internally delete asset.jpg
        await pm.save_media_file(project_id, fname2, f.read())
        
    # At this point, metadata might still be the OLD one unless save_media_file clears it!
    # This is a crucial design detail: save_media_file should probably reset 'metadata' to {} 
    # to avoid showing Image metadata for a Video file while calculating.
    
    item = await pm.get_item(project_id, item_id)
    # Ideally should be cleared or contain basic info? 
    # Let's assert it is cleared or we rely on update_item_metadata to overwrite it.
    # If we don't clear it, UI might show old Image res for new Video.
    # Expectation: save_media_file resets metadata if extension changes.
    
    # Note: If implementation doesn't clear it, this test will fail (User requirement implicit).
    # We'll see.
    
    # Update new metadata
    with patch.object(pm, '_probe_video_metadata', return_value={"duration": 5}):
        await pm.update_item_metadata(project_id, item_id)
        
    item = await pm.get_item(project_id, item_id)
    assert "width" not in item["metadata"] # Previous image width should be gone
    assert item["metadata"]["duration"] == 5
