"""
Atomic file operations and utilities for granular file management.

This module provides:
- Atomic file writes using temporary file pattern
- SHA256 hash computation for deduplication
- Filename sanitization for security
- File type detection (text vs media)
"""

import hashlib
import re
from pathlib import Path
from typing import Union


# Text file extensions (keep all history versions)
TEXT_EXTENSIONS = {".txt", ".json", ".csv", ".md"}

# Media file extensions (rotate: keep last N versions)
MEDIA_EXTENSIONS = {
    # Images
    ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp", ".svg",
    # Videos
    ".mp4", ".mov", ".avi", ".mkv", ".webm", ".flv", ".wmv",
    # Audio
    ".mp3", ".wav", ".ogg", ".flac", ".aac", ".m4a",
}


def atomic_write(path: Path, content: Union[bytes, str]) -> None:
    """
    Write content to a file atomically using temporary file pattern.

    This prevents corruption if the process crashes during write.
    Uses the same pattern as `write_json` in app.py:141-146.

    Args:
        path: Target file path
        content: Content to write (bytes or str)

    Raises:
        OSError: If write or rename fails
    """
    # Create temporary file with same extension
    temp_path = path.with_suffix(path.suffix + ".tmp")

    try:
        if isinstance(content, bytes):
            with temp_path.open("wb") as f:
                f.write(content)
        else:
            with temp_path.open("w", encoding="utf-8") as f:
                f.write(content)

        # Atomic rename (overwrites target if exists)
        temp_path.replace(path)
    except Exception:
        # Clean up temp file on failure
        if temp_path.exists():
            temp_path.unlink()
        raise


def compute_hash(path: Path) -> str:
    """
    Compute SHA256 hash of a file for deduplication.

    Args:
        path: File path to hash

    Returns:
        Hexadecimal SHA256 hash string

    Raises:
        OSError: If file cannot be read
    """
    sha256 = hashlib.sha256()
    with path.open("rb") as f:
        # Read in chunks for large files
        for chunk in iter(lambda: f.read(8192), b""):
            sha256.update(chunk)
    return sha256.hexdigest()


def safe_filename(name: str) -> str:
    """
    Sanitize filename to prevent path traversal attacks.

    Blocks:
    - Parent directory traversal (..)
    - Absolute paths
    - Directory separators
    - Null bytes
    - Control characters

    Args:
        name: Original filename

    Returns:
        Sanitized filename

    Raises:
        ValueError: If filename is invalid or contains blocked patterns
    """
    if not name:
        raise ValueError("Filename cannot be empty")

    # Block null bytes and control characters
    if any(ord(c) < 32 for c in name):
        raise ValueError("Filename contains control characters")

    # Block parent directory traversal
    if ".." in name:
        raise ValueError("Filename cannot contain parent directory reference (..)")

    # Block directory separators
    if "/" in name or "\\" in name:
        raise ValueError("Filename cannot contain directory separators")

    # Block absolute paths (Unix and Windows)
    if name.startswith("/") or (len(name) >= 2 and name[1] == ":"):
        raise ValueError("Filename cannot be an absolute path")

    # Limit length
    if len(name) > 255:
        raise ValueError("Filename too long (max 255 characters)")

    # Allow only safe characters (alphanumeric, underscore, hyphen, dot)
    # This is more restrictive than necessary but very safe
    safe = re.sub(r"[^a-zA-Z0-9._-]", "_", name)

    if not safe or safe in {".", ".."}:
        raise ValueError("Invalid filename after sanitization")

    return safe


def is_text_file(path: Path) -> bool:
    """
    Check if a file is a text file based on extension.

    Text files get full history retention (no rotation).

    Args:
        path: File path to check

    Returns:
        True if file has text extension, False otherwise
    """
    return path.suffix.lower() in TEXT_EXTENSIONS


def is_media_file(path: Path) -> bool:
    """
    Check if a file is a media file based on extension.

    Media files get rotated history (keep last N versions).

    Args:
        path: File path to check

    Returns:
        True if file has media extension, False otherwise
    """
    return path.suffix.lower() in MEDIA_EXTENSIONS
