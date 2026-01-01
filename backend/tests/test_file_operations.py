"""
Tests for file operations utility module (file_operations.py).
"""

import os
import sys
from pathlib import Path

import pytest

ROOT_DIR = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT_DIR / "backend"
sys.path.append(str(BACKEND_DIR))

from storage.file_operations import (
    atomic_write,
    compute_hash,
    safe_filename,
    is_text_file,
    is_media_file,
)


class TestFileOperations:
    """Test file_operations module."""

    def test_safe_filename_validates_basics(self):
        """Test basic safe filename validation."""
        assert safe_filename("test.txt") == "test.txt"
        assert safe_filename("image-1.png") == "image-1.png"
        assert safe_filename("my_file.json") == "my_file.json"

    def test_safe_filename_sanitizes_invalid_chars(self):
        """Test sanitization of invalid characters."""
        # Spaces become underscores (or handled as allowed based on impl, but let's check)
        # The implementation re.sub(r"[^a-zA-Z0-9._-]", "_", name) means space -> _
        assert safe_filename("test file.txt") == "test_file.txt"
        assert safe_filename("file(1).txt") == "file_1_.txt"
        assert safe_filename("won$ign.txt") == "won_ign.txt"

    def test_safe_filename_blocks_traversal(self):
        """Test blocking path traversal."""
        with pytest.raises(ValueError, match="parent directory"):
            safe_filename("../etc/passwd")
        
        with pytest.raises(ValueError, match="parent directory"):
            safe_filename("..")

    def test_safe_filename_blocks_separators(self):
        """Test blocking directory separators."""
        with pytest.raises(ValueError, match="separators"):
            safe_filename("dir/file.txt")
        
        with pytest.raises(ValueError, match="separators"):
            safe_filename("dir\\file.txt")

    def test_safe_filename_blocks_null_bytes(self):
        """Test blocking null bytes."""
        with pytest.raises(ValueError, match="control characters"):
            safe_filename("file\0.txt")

    def test_atomic_write_creates_file(self, tmp_path):
        """Test atomic_write creates file with content."""
        target_file = tmp_path / "test.txt"
        content = "hello world"
        
        atomic_write(target_file, content)
        
        assert target_file.exists()
        assert target_file.read_text() == content
        # Temp file should be gone
        assert not target_file.with_suffix(".txt.tmp").exists()

    def test_atomic_write_overwrites_existing(self, tmp_path):
        """Test atomic_write overwrites existing file."""
        target_file = tmp_path / "test.txt"
        target_file.write_text("old content")
        
        new_content = "new content"
        atomic_write(target_file, new_content)
        
        assert target_file.read_text() == new_content

    def test_atomic_write_handles_bytes(self, tmp_path):
        """Test atomic_write handles bytes content."""
        target_file = tmp_path / "test.bin"
        content = b"\x00\x01\x02"
        
        atomic_write(target_file, content)
        
        assert target_file.read_bytes() == content

    def test_compute_hash_consistency(self, tmp_path):
        """Test compute_hash produces consistent results."""
        file1 = tmp_path / "file1.txt"
        file2 = tmp_path / "file2.txt"
        
        content = b"same content"
        file1.write_bytes(content)
        file2.write_bytes(content)
        
        hash1 = compute_hash(file1)
        hash2 = compute_hash(file2)
        
        assert hash1 == hash2
        assert len(hash1) == 64  # SHA256 hex length

    def test_compute_hash_differs_for_content(self, tmp_path):
        """Test compute_hash differs for different content."""
        file1 = tmp_path / "file1.txt"
        file2 = tmp_path / "file2.txt"
        
        file1.write_bytes(b"content A")
        file2.write_bytes(b"content B")
        
        assert compute_hash(file1) != compute_hash(file2)

    def test_is_text_file(self):
        """Test text file detection."""
        assert is_text_file(Path("test.txt"))
        assert is_text_file(Path("test.json"))
        assert is_text_file(Path("test.md"))
        assert not is_text_file(Path("test.png"))

    def test_is_media_file(self):
        """Test media file detection."""
        assert is_media_file(Path("test.png"))
        assert is_media_file(Path("test.jpg"))
        assert is_media_file(Path("test.mp4"))
        assert not is_media_file(Path("test.txt"))
