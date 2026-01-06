import pytest
import shutil
import uuid
from pathlib import Path
from storage.project_manager import ProjectManager
from storage.history_manager import HistoryManager

@pytest.fixture
def project_manager(tmp_path):
    projects_dir = tmp_path / "projects"
    projects_dir.mkdir()
    history_manager = HistoryManager(projects_dir)
    return ProjectManager(projects_dir, history_manager)

@pytest.mark.asyncio
async def test_save_item_persistence_v2(project_manager):
    """
    Test that files are saved with UUIDs on disk, but filenames are preserved in manifest.
    """
    project_id = str(uuid.uuid4())
    filename = "test_image.jpg"
    content = b"fake_image_content"
    
    # 1. Save File
    item_id = await project_manager.save_media_file(project_id, filename, content)
    
    # 2. Verify Manifest
    manifest = await project_manager.load_manifest(project_id)
    item = next(i for i in manifest["items"] if i["id"] == item_id)
    assert item["base_name"] == "test_image"
    assert item["extensions"]["original"] == ".jpg"
    
    # 3. Verify Disk Persistence (UUID-based)
    project_root = project_manager.get_project_root(project_id)
    uuid_path = project_root / f"{item_id}.jpg"
    legacy_path = project_root / filename
    
    assert uuid_path.exists(), "File should be stored as {uuid}.jpg"
    assert not legacy_path.exists(), "File should NOT be stored as {filename}.jpg"
    assert uuid_path.read_bytes() == content

@pytest.mark.asyncio
async def test_logical_rename_zero_io(project_manager):
    """
    Test that renaming an item only updates metadata and does NOT trigger disk I/O.
    """
    project_id = str(uuid.uuid4())
    item_id = await project_manager.save_media_file(project_id, "old_name.jpg", b"content")
    
    project_root = project_manager.get_project_root(project_id)
    file_path = project_root / f"{item_id}.jpg"
    original_mtime = file_path.stat().st_mtime
    
    # Action: Rename
    await project_manager.rename_item(project_id, item_id, "new_name")
    
    # Validation 1: Metadata Updated
    manifest = await project_manager.load_manifest(project_id)
    item = next(i for i in manifest["items"] if i["id"] == item_id)
    assert item["base_name"] == "new_name"
    
    # Validation 2: Zero Disk I/O (File name unchanged, mtime unchanged)
    assert file_path.exists()
    assert not (project_root / "new_name.jpg").exists()
    assert file_path.stat().st_mtime == original_mtime, "Rename should not modify the physical file"

@pytest.mark.asyncio
async def test_duplicate_name_prevention(project_manager):
    """
    Test that even without physical file conflicts, logical duplicates are prevented.
    """
    project_id = str(uuid.uuid4())
    await project_manager.save_media_file(project_id, "apple.jpg", b"c1")
    item2_id = await project_manager.save_media_file(project_id, "banana.jpg", b"c2")
    
    # Try renaming banana -> apple
    with pytest.raises(ValueError, match="already exists"):
        await project_manager.rename_item(project_id, item2_id, "apple")

@pytest.mark.asyncio
async def test_extension_change_physical_replacement(project_manager):
    """
    Test that changing extension (file format) DOES trigger physical file replacement.
    This simulates an 'overwrite' logic or format conversion where ext changes.
    """
    project_id = str(uuid.uuid4())
    # Save as PNG
    item_id = await project_manager.save_media_file(project_id, "icon.png", b"png_data")
    
    project_root = project_manager.get_project_root(project_id)
    png_path = project_root / f"{item_id}.png"
    assert png_path.exists()
    
    # Save same item (same base_name) but as JPG
    # Note: save_media_file handles "upsert" based on base_name lookup if ID not provided
    # But here we simulate user uploading "icon.jpg" covering "icon.png"
    # Or we can use explicit ID update if supported, but typically uploads are by name or we find by name.
    
    # Let's assume we upload "icon.jpg" -> Manager finds "icon" base_name -> Updates item
    await project_manager.save_media_file(project_id, "icon.jpg", b"jpg_data")
    
    jpg_path = project_root / f"{item_id}.jpg"
    
    # Verify PNG gone, JPG exists
    assert not png_path.exists()
    assert jpg_path.exists()
    assert jpg_path.read_bytes() == b"jpg_data"
    
    # Verify Manifest
    manifest = await project_manager.load_manifest(project_id)
    item = next(i for i in manifest["items"] if i["id"] == item_id)
    assert item["extensions"]["original"] == ".jpg"

@pytest.mark.asyncio
async def test_sidecar_paths_v2(project_manager):
    """
    Test that previews and captions also follow ID-based naming.
    """
    project_id = str(uuid.uuid4())
    item_id = await project_manager.save_media_file(project_id, "movie.mp4", b"video")
    
    # Save Preview
    await project_manager.save_preview_for_media(
        project_id, "movie.mp4", b"preview_img", ".png"
    )
    
    # Save Caption
    await project_manager.save_caption_for_media(
        project_id, "movie.mp4", "A validation movie"
    )
    
    project_root = project_manager.get_project_root(project_id)
    
    # Validate Paths
    preview_path = project_root / "previews" / f"{item_id}.png"
    caption_path = project_root / f"{item_id}.txt"
    
    assert preview_path.exists()
    assert caption_path.exists()
    
    # Ensure legacy paths don't exist
    assert not (project_root / "previews" / "movie.png").exists()
    assert not (project_root / "movie.txt").exists()
