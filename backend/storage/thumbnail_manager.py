import os
import subprocess
import logging
from pathlib import Path
from typing import Tuple, Optional

from PIL import Image

import static_ffmpeg
static_ffmpeg.add_paths()

# Import extension definitions
from .file_operations import is_media_file, is_text_file

logger = logging.getLogger(__name__)

class ThumbnailManager:
    """
    Manages thumbnail generation for media files.
    """

    def __init__(self):
        # Determine ffmpeg/ffprobe paths
        # static-ffmpeg adds them to PATH
        self.ffmpeg_path = "ffmpeg"
        
    def generate_thumbnail(self, source_path: Path, dest_path: Path, size: Tuple[int, int] = (256, 256)) -> bool:
        """
        Generate a thumbnail for the given source file.
        
        Args:
            source_path: Path to source media file
            dest_path: Path where thumbnail should be saved
            size: Tuple of (max_width, max_height)
            
        Returns:
            True if successful, False otherwise
        """
        if not source_path.exists():
            logger.error(f"Source file not found: {source_path}")
            return False
            
        # Ensure parent directory exists
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Determine file type based on extension using file_operations constants logic
        # But here we need to know if it's Image or Video to decide generation strategy.
        # file_operations.MEDIA_EXTENSIONS includes both.
        # Let's inspect library logic or define subsets here.
        
        ext = source_path.suffix.lower()
        
        VIDEO_EXTENSIONS = {
            ".mp4", ".mov", ".avi", ".mkv", ".webm", ".flv", ".wmv"
        }
        
        IMAGE_EXTENSIONS = {
            ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp", ".svg"
        }
        
        try:
            if ext in VIDEO_EXTENSIONS:
                return self._generate_video_thumbnail(source_path, dest_path, size)
            elif ext in IMAGE_EXTENSIONS:
                return self._generate_image_thumbnail(source_path, dest_path, size)
            else:
                logger.warning(f"Unsupported file type for thumbnail: {source_path}")
                return False
        except Exception as e:
            logger.error(f"Failed to generate thumbnail for {source_path}: {e}")
            return False

    def _generate_image_thumbnail(self, source_path: Path, dest_path: Path, size: Tuple[int, int]) -> bool:
        """Generate thumbnail for image files using Pillow."""
        try:
            with Image.open(source_path) as img:
                # Convert to RGB if necessary (e.g. RGBA -> RGB for JPEG, but we use WebP which supports Alpha)
                # But to be safe for diverse formats:
                if img.mode in ('RGBA', 'LA') and dest_path.suffix.lower() in ('.jpg', '.jpeg'):
                    background = Image.new('RGB', img.size, (255, 255, 255))
                    background.paste(img, mask=img.split()[-1])
                    img = background
                elif img.mode == 'P':
                    img = img.convert('RGBA')
                
                # Resize maintaining aspect ratio
                img.thumbnail(size, Image.Resampling.LANCZOS)
                
                # Save
                img.save(dest_path)
                return True
        except Exception as e:
            logger.error(f"Image processing failed: {e}")
            raise

    def _generate_video_thumbnail(self, source_path: Path, dest_path: Path, size: Tuple[int, int]) -> bool:
        """Generate thumbnail for video files using ffmpeg."""
        # 1. Extract frame at 00:00:01
        # ffmpeg -ss 00:00:01 -i input -vframes 1 -vf scale=256:256:force_original_aspect_ratio=decrease output
        
        scale_filter = f"scale={size[0]}:{size[1]}:force_original_aspect_ratio=decrease"
        
        cmd = [
            self.ffmpeg_path,
            "-y", # Overwrite
            "-ss", "00:00:01", # Seek to 1s
            "-i", str(source_path),
            "-vframes", "1",
            "-vf", scale_filter,
            str(dest_path)
        ]
        
        try:
            subprocess.run(cmd, check=True, capture_output=True, text=True)
            return True
        except subprocess.CalledProcessError as e:
            logger.warning(f"ffmpeg failed at 1s seek: {e.stderr}. Retrying at 0s.")
            # Fallback to 0s if 1s fails (e.g. video shorter than 1s)
            cmd[2] = "00:00:00"
            try:
                subprocess.run(cmd, check=True, capture_output=True, text=True)
                return True
            except subprocess.CalledProcessError as e2:
                logger.error(f"ffmpeg fallback failed: {e2.stderr}")
                raise
