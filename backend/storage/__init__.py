"""
Storage layer for granular file management.

This package provides modules for:
- Atomic file operations
- Version history management
- Project directory management
- Concurrency control
- Migration from legacy ZIP format
"""

from .file_operations import (
    atomic_write,
    compute_hash,
    safe_filename,
    is_text_file,
    is_media_file,
)

__all__ = [
    "atomic_write",
    "compute_hash",
    "safe_filename",
    "is_text_file",
    "is_media_file",
]
