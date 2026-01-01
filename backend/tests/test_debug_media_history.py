"""
Debug script to understand the get_media_item_history behavior.
"""

import tempfile
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent))

from storage.history_manager import HistoryManager
from storage.project_manager import ProjectManager
from routers.projects import get_item_history
from utils.file_utils import extract_base_name


def main():
    with tempfile.TemporaryDirectory() as tmpdir:
        projects_dir = Path(tmpdir)
        project_id = "test-project-123"
        project_dir = projects_dir / project_id
        project_dir.mkdir()

        # Create files
        original_file = project_dir / "item_image01.jpg"
        original_file.write_bytes(b"original image content")
        print(f"Created original file: {original_file}")

        caption_file = project_dir / "item_image01.txt"
        caption_file.write_text("caption v1")
        print(f"Created caption file: {caption_file}")

        previews_dir = project_dir / "previews"
        previews_dir.mkdir()
        preview_file = previews_dir / "item_image01.jpg"
        preview_file.write_bytes(b"preview image content")
        print(f"Created preview file: {preview_file}")

        # Setup managers
        history_manager = HistoryManager(projects_dir)
        project_manager = ProjectManager(projects_dir)

        # Backup files with delays to create different timestamps
        import time

        history_manager.backup_file(project_id, "item_image01.jpg")
        print(f"\nBacked up original")
        time.sleep(0.1)

        history_manager.backup_file(project_id, "item_image01.txt")
        print(f"Backed up caption v1")
        time.sleep(0.1)

        history_manager.backup_file(project_id, "previews/item_image01.jpg")
        print(f"Backed up preview")
        time.sleep(0.1)

        caption_file.write_text("caption v2")
        history_manager.backup_file(project_id, "item_image01.txt")
        print(f"Backed up caption v2")

        # Check individual histories
        print("\n" + "=" * 80)
        print("INDIVIDUAL FILE HISTORIES:")
        print("=" * 80)

        original_versions = history_manager.list_versions(project_id, "item_image01.jpg")
        print(f"\nOriginal file history ({len(original_versions)} versions):")
        for v in original_versions:
            print(f"  - {v['timestamp']}")

        caption_versions = history_manager.list_versions(project_id, "item_image01.txt")
        print(f"\nCaption file history ({len(caption_versions)} versions):")
        for v in caption_versions:
            print(f"  - {v['timestamp']}")

        preview_versions = history_manager.list_versions(project_id, "previews/item_image01.jpg")
        print(f"\nPreview file history ({len(preview_versions)} versions):")
        for v in preview_versions:
            print(f"  - {v['timestamp']}")

        # Now call the endpoint logic
        print("\n" + "=" * 80)
        print("INTEGRATED MEDIA ITEM HISTORY:")
        print("=" * 80)

        # Simulate the endpoint call
        import asyncio
        from fastapi import Query

        # We need to call it differently since it's an async endpoint
        # Let's manually execute the logic
        from routers.projects import safe_filename

        filename = "item_image01.jpg"
        safe_name = safe_filename(filename)

        # Handle .txt extension: if caller passes caption filename, convert to original
        if safe_name.endswith('.txt'):
            base_name = extract_base_name(safe_name)
            original_filename = f"{base_name}.jpg"  # Default
            caption_filename = f"{base_name}.txt"
            preview_filename = f"previews/{original_filename}"
        else:
            original_filename = safe_name
            caption_filename = f"{extract_base_name(safe_name)}.txt"
            preview_filename = f"previews/{safe_name}"

        print(f"\nFile mapping:")
        print(f"  Original: {original_filename}")
        print(f"  Caption:  {caption_filename}")
        print(f"  Preview:  {preview_filename}")

        # Collect all versions from all three files
        all_entries = []

        def add_file_versions(file_path: str, file_type: str):
            versions = history_manager.list_versions(project_id, file_path)
            for version in versions:
                all_entries.append({
                    "timestamp": version["timestamp"],
                    "modified": version["modified"],
                    "file_type": file_type,
                    "filename": file_path,
                    "hash": version.get("hash", ""),
                    "size": version["size"],
                })

        add_file_versions(original_filename, "original")
        add_file_versions(caption_filename, "caption")
        add_file_versions(preview_filename, "preview")

        print(f"\nAll entries collected: {len(all_entries)}")
        for entry in all_entries:
            print(f"  - {entry['timestamp']} [{entry['file_type']}] {entry['filename']}")

        # Sort by modified timestamp (newest first)
        all_entries.sort(key=lambda x: x["modified"], reverse=True)

        # Group entries by timestamp (within 1 second)
        grouped = []
        current_group = None

        for entry in all_entries:
            file_signature = (entry["filename"], entry["file_type"], entry["size"])

            if current_group is None:
                current_group = {
                    "timestamp": entry["timestamp"],
                    "modified": entry["modified"],
                    "files": [
                        {
                            "filename": entry["filename"],
                            "type": entry["file_type"],
                            "hash": entry["hash"],
                            "size": entry["size"],
                        }
                    ],
                    "_file_signatures": {file_signature},
                }
                if entry["file_type"] == "preview":
                    current_group["files"][0]["path"] = entry["filename"]
            else:
                time_diff = abs(current_group["modified"] - entry["modified"])
                if time_diff <= 1.0:
                    if file_signature not in current_group["_file_signatures"]:
                        file_info = {
                            "filename": entry["filename"],
                            "type": entry["file_type"],
                            "hash": entry["hash"],
                            "size": entry["size"],
                        }
                        if entry["file_type"] == "preview":
                            file_info["path"] = entry["filename"]
                        current_group["files"].append(file_info)
                        current_group["_file_signatures"].add(file_signature)
                else:
                    del current_group["_file_signatures"]
                    grouped.append(current_group)
                    current_group = {
                        "timestamp": entry["timestamp"],
                        "modified": entry["modified"],
                        "files": [
                            {
                                "filename": entry["filename"],
                                "type": entry["file_type"],
                                "hash": entry["hash"],
                                "size": entry["size"],
                            }
                        ],
                        "_file_signatures": {file_signature},
                    }
                    if entry["file_type"] == "preview":
                        current_group["files"][0]["path"] = entry["filename"]

        if current_group:
            del current_group["_file_signatures"]
            grouped.append(current_group)

        # Determine operation type for each group
        for group in grouped:
            file_types = {f["type"] for f in group["files"]}

            if len(file_types) > 1:
                group["operation"] = "multiple"
            elif "caption" in file_types:
                group["operation"] = "caption_edit"
            elif "preview" in file_types:
                group["operation"] = "preview_generate"
            elif "original" in file_types:
                group["operation"] = "original_upload"
            else:
                group["operation"] = "unknown"

        # Remove the modified field from response
        for group in grouped:
            del group["modified"]

        print(f"\nGrouped history ({len(grouped)} groups):")
        for i, group in enumerate(grouped):
            print(f"\n  Group {i+1}: {group['timestamp']} - {group['operation']}")
            for f in group['files']:
                preview_info = f" [path: {f.get('path', 'N/A')}]" if f.get('path') else ""
                print(f"    - {f['type']}: {f['filename']}{preview_info}")

        print("\n" + "=" * 80)
        print("ANALYSIS:")
        print("=" * 80)
        print(f"Expected: 4 separate history entries (1 original + 2 captions + 1 preview)")
        print(f"Actual:   {len(grouped)} grouped entries")

        # Count file types
        all_file_types = []
        for group in grouped:
            for f in group['files']:
                all_file_types.append(f['type'])

        from collections import Counter
        type_counts = Counter(all_file_types)

        print(f"\nFile type counts:")
        for ftype, count in type_counts.items():
            print(f"  - {ftype}: {count}")

        if 'preview' in all_file_types:
            print(f"\n✓ Preview files ARE included in the history")
        else:
            print(f"\n✗ Preview files are NOT included in the history")


if __name__ == "__main__":
    main()
