import shutil
from pathlib import Path
import pytest
from PIL import Image

# Import to be implemented
# from storage.thumbnail_manager import ThumbnailManager

# Mocking or using real storage?
# Since ThumbnailManager logic is self-contained (takes path in, path out), we can integration test it with files.
# But we need to import it. It doesn't exist yet, so this test will fail to import (Red).

ASSETS_DIR = Path(__file__).parent / "assets"
OUTPUT_DIR = Path(__file__).parent / "output"

@pytest.fixture(scope="module", autouse=True)
def setup_dirs():
    OUTPUT_DIR.mkdir(exist_ok=True)
    yield
    # Cleanup?
    # shutil.rmtree(OUTPUT_DIR)

@pytest.fixture
def thumbnail_manager():
    # Lazy import to allow test file to be parsed even if module doesn't exist yet
    from storage.thumbnail_manager import ThumbnailManager
    return ThumbnailManager()

def test_generate_image_thumbnail(thumbnail_manager):
    src = ASSETS_DIR / "test_image.jpg"
    dest = OUTPUT_DIR / "thumb_image.webp"
    
    # Assert src exists (precondition)
    assert src.exists()
    
    result = thumbnail_manager.generate_thumbnail(src, dest, size=(256, 256))
    
    assert result is True
    assert dest.exists()
    
    # Verify image properties
    with Image.open(dest) as img:
        width, height = img.size
        assert max(width, height) <= 256
        # Original is 1920x1080 (16:9)
        # 256 width -> height should be ~144
        assert width == 256
        assert 140 < height < 150

def test_generate_video_thumbnail(thumbnail_manager):
    src = ASSETS_DIR / "test_video.mp4"
    dest = OUTPUT_DIR / "thumb_video.webp"
    
    assert src.exists()
    
    result = thumbnail_manager.generate_thumbnail(src, dest, size=(256, 256))
    
    assert result is True
    assert dest.exists()
    
    with Image.open(dest) as img:
        width, height = img.size
        # Video is 1280x720 (16:9)
        assert width == 256
        assert 140 < height < 150

def test_unsupported_file(thumbnail_manager):
    src = ASSETS_DIR / "test_text.txt"
    dest = OUTPUT_DIR / "thumb_text.webp"
    
    result = thumbnail_manager.generate_thumbnail(src, dest)
    assert result is False
    assert not dest.exists()
