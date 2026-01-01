
import pytest
from pathlib import Path
import shutil
import tempfile
from PIL import Image
from storage.project_manager import ProjectManager
from storage.history_manager import HistoryManager

@pytest.fixture
async def project_setup():
    """Setup project manager and temp directory."""
    with tempfile.TemporaryDirectory() as temp_dir:
        projects_dir = Path(temp_dir)
        history_manager = HistoryManager(projects_dir)
        pm = ProjectManager(projects_dir, history_manager)
        project_id = "test-project"
        await pm.ensure_project_dir(project_id)
        yield pm, project_id

def create_solid_image(path: Path, color: tuple, size=(100, 100), fmt="JPEG"):
    """Create a solid color image for testing."""
    img = Image.new("RGB", size, color)
    img.save(path, fmt)

def get_pixel_color(path: Path) -> tuple:
    """Read the color of the first pixel."""
    with Image.open(path) as img:
        return img.convert("RGB").getpixel((0, 0))

@pytest.mark.asyncio
async def test_ensure_thumbnail_history_original(project_setup):
    """
    Test generating thumbnail from an old original version.
    """
    pm, project_id = project_setup
    
    # 1. Create Ver 1 (Red)
    filename = "test_image.jpg"
    red_img_path = (await pm.ensure_project_dir(project_id)) / "temp_red.jpg"
    create_solid_image(red_img_path, (255, 0, 0)) # Red
    
    with open(red_img_path, "rb") as f:
        item_id = await pm.save_media_file(project_id, filename, f.read(), subtype="original")
        
    # Get timestamp of Ver 1 (Original history)
    history_list = await pm.history_manager.list_versions(project_id, item_id, subtype="original")
    assert len(history_list) == 1
    ver1_timestamp = history_list[0]["timestamp"]
    
    # 2. Update to Ver 2 (Blue)
    blue_img_path = (await pm.ensure_project_dir(project_id)) / "temp_blue.jpg"
    create_solid_image(blue_img_path, (0, 0, 255)) # Blue
    
    with open(blue_img_path, "rb") as f:
        await pm.save_media_file(project_id, filename, f.read(), subtype="original")
        
    # 3. Request thumbnail for Ver 1 (History)
    thumb_path = await pm.ensure_thumbnail(
        project_id, 
        item_id, 
        timestamp=ver1_timestamp, 
        subtype="original"
    )
    
    assert thumb_path is not None
    assert thumb_path.exists()
    
    # Verify name pattern: {item_id}_original_{timestamp}.webp
    assert thumb_path.name == f"{item_id}_original_{ver1_timestamp}.webp"
    
    # Verify Content: Should be Red (Ver 1), not Blue (Current)
    color = get_pixel_color(thumb_path)
    # Allow tolerance for WebP compression
    assert abs(color[0] - 255) < 5
    assert abs(color[1] - 0) < 5
    assert abs(color[2] - 0) < 5, f"Expected Red thumbnail, got {color}"

@pytest.mark.asyncio
async def test_ensure_thumbnail_history_preview(project_setup):
    """
    Test generating thumbnail from an old preview version.
    """
    pm, project_id = project_setup
    
    # 1. Create Item
    filename = "test_video.mp4" # Dummy video
    (await pm.ensure_project_dir(project_id)).mkdir(exist_ok=True, parents=True) # ensure root
    item_id = await pm.save_media_file(project_id, filename, b"dummy_content", subtype="original")
    
    # 2. Upload Preview Ver 1 (Green)
    green_path = (await pm.ensure_project_dir(project_id)) / "temp_green.png"
    create_solid_image(green_path, (0, 255, 0), fmt="PNG")
    
    with open(green_path, "rb") as f:
        # save_preview_for_media uses base_name, but we only have filename or item_id.
        # It takes media_filename.
        await pm.save_preview_for_media(project_id, filename, f.read(), ".png")
        
    # Get timestamp
    history_list = await pm.history_manager.list_versions(project_id, item_id, subtype="preview")
    assert len(history_list) == 1
    ver1_timestamp = history_list[0]["timestamp"]
    
    # 3. Request history thumbnail for preview
    thumb_path = await pm.ensure_thumbnail(
        project_id, 
        item_id, 
        timestamp=ver1_timestamp, 
        subtype="preview"
    )
    
    assert thumb_path is not None
    assert thumb_path.exists()
    assert thumb_path.name == f"{item_id}_preview_{ver1_timestamp}.webp"
    
    # Verify Content: Green
    color = get_pixel_color(thumb_path)
    # Allow tolerance for WebP compression
    assert abs(color[0] - 0) < 5
    assert abs(color[1] - 255) < 5
    assert abs(color[2] - 0) < 5

@pytest.mark.asyncio
async def test_ensure_thumbnail_history_caching(project_setup, monkeypatch):
    """
    Verify that history thumbnails are cached.
    """
    pm, project_id = project_setup
    
    # Setup: Create Ver 1 (Red)
    filename = "cache_test.jpg"
    red_img_path = (await pm.ensure_project_dir(project_id)) / "red.jpg"
    create_solid_image(red_img_path, (255, 0, 0))
    with open(red_img_path, "rb") as f:
        item_id = await pm.save_media_file(project_id, filename, f.read(), subtype="original")
        
    history_list = await pm.history_manager.list_versions(project_id, item_id, subtype="original")
    timestamp = history_list[0]["timestamp"]
    
    # 1. First Generation
    thumb1 = await pm.ensure_thumbnail(project_id, item_id, timestamp=timestamp, subtype="original")
    assert thumb1.exists()
    
    # 2. Second Call - Mock generate_thumbnail to fail if called
    def mock_generate(*args, **kwargs):
        raise RuntimeError("Should not be called! History thumbnail should be cached.")
        
    monkeypatch.setattr(pm.thumbnail_manager, "generate_thumbnail", mock_generate)
    
    # Should succeed without calling generator
    thumb2 = await pm.ensure_thumbnail(project_id, item_id, timestamp=timestamp, subtype="original")
    
    assert thumb2 == thumb1 # Same path
    assert thumb2.exists()

@pytest.mark.asyncio
async def test_ensure_thumbnail_invalid_timestamp(project_setup):
    """Test with non-existent timestamp."""
    pm, project_id = project_setup
    filename = "invalid_time.jpg"
    await pm.save_media_file(project_id, filename, b"content", subtype="original")
    
    # Valid item, invalid timestamp
    items = await pm.get_all_items(project_id)
    item_id = items[0]["id"]
    
    result = await pm.ensure_thumbnail(
        project_id, 
        item_id, 
        timestamp="20990101_000000", 
        subtype="original"
    )
    
    assert result is None

@pytest.mark.asyncio
async def test_ensure_thumbnail_corrupt_history_file(project_setup):
    """Test when history record exists but file is missing on disk."""
    pm, project_id = project_setup
    filename = "corrupt.jpg"
    # Create valid file + history
    path = (await pm.ensure_project_dir(project_id)) / "temp.jpg"
    create_solid_image(path, (100, 100, 100))
    with open(path, "rb") as f:
        item_id = await pm.save_media_file(project_id, filename, f.read())
        
    history_list = await pm.history_manager.list_versions(project_id, item_id, subtype="original")
    timestamp = history_list[0]["timestamp"]
    
    # Sabotage: Delete the actual history file
    version_path = await pm.history_manager.get_version_path(project_id, item_id, timestamp, subtype="original")
    assert version_path.exists()
    version_path.unlink() # Delete it
    
    # Request thumbnail
    result = await pm.ensure_thumbnail(project_id, item_id, timestamp=timestamp, subtype="original")
    
    assert result is None # Should handle missing source gracefully

@pytest.mark.asyncio
async def test_ensure_thumbnail_missing_subtype(project_setup):
    """
    Test defaulting to 'original' if subtype not provided 
    """
    pm, project_id = project_setup
    filename = "default_subtype.jpg"
    path = (await pm.ensure_project_dir(project_id)) / "temp.jpg"
    create_solid_image(path, (200, 200, 200))
    with open(path, "rb") as f:
        item_id = await pm.save_media_file(project_id, filename, f.read())
        
    history_list = await pm.history_manager.list_versions(project_id, item_id)
    timestamp = history_list[0]["timestamp"]
    
    # Call without subtype (using default)
    result = await pm.ensure_thumbnail(project_id, item_id, timestamp=timestamp) 
    
    assert result is not None
    assert "original" in result.name # Expected default behavior
