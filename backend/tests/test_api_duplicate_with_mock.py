"""
Test: Reproduce media history API duplicate file issue using Mock

Simulate the exact situation of real API response with mock

Problem situation (Console log shown by user):
{
  "history": [
    {
      "timestamp": "20251226_182507_834761",
      "files": [
        {"filename": "item_image01.txt", "type": "caption", "size": 4},
        {"filename": "item_image01.txt", "type": "caption", "size": 4}  // Exactly identical!
      ],
      "operation": "caption_edit"
    }
  ]
}

Reproduce this duplication scenario with mock data
"""

from typing import List, Dict, Any


def simulate_api_grouping_logic(all_entries: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Implement grouping logic exactly same as routers/projects.py lines 376-444
    """
    # Sort by modified timestamp (newest first)
    all_entries_sorted = sorted(all_entries, key=lambda x: x["modified"], reverse=True)

    # Group entries by timestamp (within 1 second)
    grouped = []
    current_group = None

    for entry in all_entries_sorted:
        # Create file signature for duplicate checking
        file_signature = (entry["filename"], entry["file_type"], entry["size"])

        if current_group is None:
            # Start first group
            current_group = {
                "timestamp": entry["timestamp"],
                "modified": entry["modified"],
                "files": [
                    {
                        "filename": entry["filename"],
                        "type": entry["file_type"],
                        "size": entry["size"],
                    }
                ],
                # Track unique files to prevent duplicates
                "_file_signatures": {file_signature},
            }
            # Add path for preview files
            if entry["file_type"] == "preview":
                current_group["files"][0]["path"] = entry["filename"]
        else:
            # Check if this entry is within 1 second of current group
            time_diff = abs(current_group["modified"] - entry["modified"])
            if time_diff <= 1.0:
                # Check for duplicate before adding
                if file_signature not in current_group["_file_signatures"]:
                    # Add to current group
                    file_info = {
                        "filename": entry["filename"],
                        "type": entry["file_type"],
                        "size": entry["size"],
                    }
                    if entry["file_type"] == "preview":
                        file_info["path"] = entry["filename"]
                    current_group["files"].append(file_info)
                    current_group["_file_signatures"].add(file_signature)
            else:
                # Finalize current group
                # Remove the internal tracking field before adding
                del current_group["_file_signatures"]
                grouped.append(current_group)
                # Start new group
                current_group = {
                    "timestamp": entry["timestamp"],
                    "modified": entry["modified"],
                    "files": [
                        {
                            "filename": entry["filename"],
                            "type": entry["file_type"],
                            "size": entry["size"],
                        }
                    ],
                    # Track unique files to prevent duplicates
                    "_file_signatures": {file_signature},
                }
                if entry["file_type"] == "preview":
                    current_group["files"][0]["path"] = entry["filename"]

    # Don't forget the last group
    if current_group:
        # Remove the internal tracking field before adding
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

    return {"history": grouped}


def test_exact_duplicate_entries():
    """
    Test: Case with 2 exactly identical entries (Problem shown by user)

    Scenario: list_versions() returns entries with same timestamp, size, and filename twice
    """
    print("=" * 80)
    print("Test: Exactly identical entry duplication (Problem shown by user)")
    print("=" * 80)

    # Mock: list_versions() returns duplicate entries
    mock_timestamp = "20251226_182507_834761"
    mock_modified = 1735190707.834761

    all_entries = [
        {
            "timestamp": mock_timestamp,
            "modified": mock_modified,
            "file_type": "caption",
            "filename": "item_image01.txt",
            "size": 4,
        },
        {
            "timestamp": mock_timestamp,
            "modified": mock_modified,
            "file_type": "caption",
            "filename": "item_image01.txt",
            "size": 4,  # Exactly identical!
        },
    ]

    print(f"\nInput (all_entries): {len(all_entries)} items")
    for i, entry in enumerate(all_entries, 1):
        print(f"  {i}. timestamp={entry['timestamp']}, filename={entry['filename']}, size={entry['size']}")

    # Execute grouping logic
    result = simulate_api_grouping_logic(all_entries)

    print(f"\nResult:")
    print(f"  Group count: {len(result['history'])}")

    has_duplicates = False
    for group in result['history']:
        files = group['files']
        print(f"\n  Group - Timestamp: {group['timestamp']}")
        print(f"  File count: {len(files)}")

        for i, f in enumerate(files, 1):
            print(f"    {i}. {f['filename']} ({f['type']}) size={f['size']}")

        # Check duplicates
        file_signatures = [(f['filename'], f['type'], f['size']) for f in files]
        unique_signatures = set(file_signatures)

        if len(file_signatures) != len(unique_signatures):
            has_duplicates = True
            print(f"  \u26a0\ufe0f  Duplicate found! {len(unique_signatures)} unique out of {len(file_signatures)}")

            from collections import Counter
            for sig, count in Counter(file_signatures).items():
                if count > 1:
                    print(f"    - {sig}: {count} times duplicate")
        else:
            print(f"  \u2713 No duplicates")

    print("\n" + "=" * 80)
    if has_duplicates:
        print("Test Failed: Duplicate files found (Current Bug State)")
        print("Expectation: Identical file should be shown only once")
        print("Actual: Identical file shown twice")
    else:
        print("Test Passed: No duplicates (Bug Fixed)")
    print("=" * 80)

    return not has_duplicates


def test_triplicate_entries():
    """
    Test: Case with 3 exactly identical entries
    """
    print("\n" + "=" * 80)
    print("Test: Exactly identical entry 3 duplicates")
    print("=" * 80)

    mock_timestamp = "20251226_182547_387595"
    mock_modified = 1735190747.387595

    all_entries = [
        {
            "timestamp": mock_timestamp,
            "modified": mock_modified,
            "file_type": "caption",
            "filename": "item_image01.txt",
            "size": 13,
        },
        {
            "timestamp": mock_timestamp,
            "modified": mock_modified,
            "file_type": "caption",
            "filename": "item_image01.txt",
            "size": 13,
        },
        {
            "timestamp": mock_timestamp,
            "modified": mock_modified,
            "file_type": "caption",
            "filename": "item_image01.txt",
            "size": 13,
        },
    ]

    print(f"\nInput (all_entries): {len(all_entries)} items (All identical)")

    result = simulate_api_grouping_logic(all_entries)

    print(f"\nResult:")
    files = result['history'][0]['files']
    print(f"  File count: {len(files)} (Expected: 1, Actual: {len(files)})")

    for i, f in enumerate(files, 1):
        print(f"    {i}. {f['filename']} size={f['size']}")

    passed = len(files) == 1

    print("\n" + "=" * 80)
    if passed:
        print("Test Passed")
    else:
        print("Test Failed: Should be 1 file but shown {len(files)}")
    print("=" * 80)

    assert passed


def test_mixed_duplicate_and_unique():
    """
    Test: Mixed case with duplicate + unique entries
    """
    print("\n" + "=" * 80)
    print("Test: Mixed duplicate + unique")
    print("=" * 80)

    base_modified = 1735190700.0

    all_entries = [
        # Duplicate Group 1
        {
            "timestamp": "20251226_182500_000000",
            "modified": base_modified,
            "file_type": "caption",
            "filename": "item_image01.txt",
            "size": 4,
        },
        {
            "timestamp": "20251226_182500_000001",
            "modified": base_modified + 0.5,  # 0.5s diff -> same group
            "file_type": "caption",
            "filename": "item_image01.txt",
            "size": 4,  # same size -> duplicate!
        },
        # Unique (different size)
        {
            "timestamp": "20251226_182500_000002",
            "modified": base_modified + 0.8,  # 0.8s diff -> same group
            "file_type": "caption",
            "filename": "item_image01.txt",
            "size": 13,  # different size -> unique!
        },
        # Different Group (more than 1s diff)
        {
            "timestamp": "20251226_182501_000000",
            "modified": base_modified + 1.5,  # 1.5s diff -> different group
            "file_type": "caption",
            "filename": "item_image01.txt",
            "size": 20,
        },
    ]

    print(f"\nInput (all_entries): {len(all_entries)} items")

    result = simulate_api_grouping_logic(all_entries)

    print(f"\nResult:")
    print(f"  Group count: {len(result['history'])}")

    has_any_duplicates = False
    for i, group in enumerate(result['history'], 1):
        files = group['files']
        print(f"\n  Group {i} - Timestamp: {group['timestamp']}")
        print(f"  File count: {len(files)}")

        file_signatures = [(f['filename'], f['type'], f['size']) for f in files]
        unique_signatures = set(file_signatures)

        if len(file_signatures) != len(unique_signatures):
            has_any_duplicates = True
            print(f"  \u26a0\ufe0f  Duplicate exists")

            from collections import Counter
            for sig, count in Counter(file_signatures).items():
                if count > 1:
                    print(f"    - {sig}: {count} times")
        else:
            print(f"  \u2713 No duplicates")

    print("\n" + "=" * 80)
    if has_any_duplicates:
        print("Test Failed: Duplicates found in some groups")
    else:
        print("Test Passed: No duplicates in any group")
    print("=" * 80)

    return not has_any_duplicates


if __name__ == "__main__":
    print("Media History API Duplicate Issue Test using Mock")
    print("=" * 80)
    print()

    results = []

    # Test 1: 2 Exactly identical entries (User reported)
    results.append(("2 Exactly identical entries", test_exact_duplicate_entries()))

    # Test 2: 3 Exactly identical entries
    results.append(("3 Exactly identical entries", test_triplicate_entries()))

    # Test 3: Mixed duplicate + unique
    results.append(("Mixed duplicate + unique", test_mixed_duplicate_and_unique()))

    # Result Summary
    print("\n" + "=" * 80)
    print("Test Result Summary")
    print("=" * 80)

    passed = sum(1 for _, result in results if result)
    total = len(results)

    for name, result in results:
        status = "\u2713 Passed" if result else "\u2717 Failed"
        print(f"{status}: {name}")

    print(f"\nTotal: {passed}/{total} Passed")

    if passed < total:
        print("\n\u26a0\ufe0f  Current Bug State: Duplicate file issue exists")
        print("Fix required: Duplicate removal in grouping logic at routers/projects.py")

    print("=" * 80)
