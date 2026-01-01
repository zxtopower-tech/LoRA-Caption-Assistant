"""
Debug script to trace preview matching logic.
"""

import sys
from pathlib import Path
from utils.file_utils import extract_base_name

# Simulate the matching logic
def debug_preview_matching():
    """Debug the preview matching logic."""

    # Actual data from filesystem
    media_files = [
        "item_image03.jpg",
        "item_image02.webp",
        "item_image01.jpg",
        "item_image06.webp",
        "item_image04.jpg",
        "item_image05.jpg",
    ]

    preview_files = [
        "item_image0.png",
        "item_image1.jpg",
        "item_image2.jpg",
        "item_image3.jpg",
        "item_image4.jpg",
        "item_image5.jpg",
    ]

    import re

    # Build preview_base_map
    preview_base_map = {}
    for preview in preview_files:
        base = extract_base_name(preview)
        match = re.match(r'^(.*?)(\d+)$', base)
        if match:
            prefix = match.group(1)
            number = match.group(2)
            key = f"{prefix}{number}"
            preview_base_map[key] = preview
            preview_base_map[base] = preview
        else:
            preview_base_map[base] = preview

    print("Preview base map:")
    for k, v in preview_base_map.items():
        print(f"  '{k}' -> '{v}'")
    print()

    # Check each media file
    print("Media file preview matching:")
    print("-" * 80)
    for filename in media_files:
        base = extract_base_name(filename)
        has_preview = False

        # Exact match
        if filename in preview_files:
            has_preview = True
            reason = "exact filename match"
        elif base in preview_base_map:
            has_preview = True
            reason = f"base match: '{base}'"
        else:
            # Try offset matching
            match = re.match(r'^(.*?)(\d+)$', base)
            if match:
                prefix = match.group(1)
                number = int(match.group(2))
                for num_offset in [-1, 0, 1]:
                    test_base = f"{prefix}{number + num_offset}"
                    if test_base in preview_base_map:
                        has_preview = True
                        reason = f"offset match: '{base}' -> '{test_base}'"
                        break

        status = "✓" if has_preview else "✗"
        print(f"  {status} {filename:30} (base: '{base}') -> {has_preview}")
        if has_preview:
            print(f"      Reason: {reason}")

    print("-" * 80)

if __name__ == "__main__":
    debug_preview_matching()
