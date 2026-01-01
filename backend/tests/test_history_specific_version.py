"""
Test: Retrieve specific history version

When multiple versions exist:
1. Retrieve all versions using list_versions
2. Select a specific timestamp and restore using restore_version
3. Verify that we can retrieve a specific version, not just the latest
"""

import tempfile
from pathlib import Path
import sys
import time

sys.path.insert(0, str(Path(__file__).parent))

from storage.history_manager import HistoryManager
from storage.project_manager import ProjectManager


def main():
    """Run all tests"""
    print("\n")
    print("╔" + "=" * 78 + "╗")
    print("║" + " " * 15 + "Specific History Retrieval Test" + " " * 31 + "║")
    print("╚" + "=" * 78 + "╝")
    print()

    results = []

    results.append(("Restore specific version from many", test_list_and_restore_specific_version()))
    results.append(("Restore first version from 10", test_restore_first_version_from_many()))
    results.append(("Restore middle version from 10", test_restore_middle_version_from_many()))
    results.append(("Restore different versions multiple times", test_multiple_restore_different_versions()))
    results.append(("list_versions -> User selection -> Restore", test_get_timestamp_and_restore()))

    # Summary
    print("=" * 80)
    print("Test Summary")
    print("=" * 80)
    for name, passed in results:
        status = "PASS \u2713" if passed else "FAIL \u2717"
        print(f"  {status}  {name}")

    total = len(results)
    passed_count = sum(1 for _, p in results if p)
    print()
    print(f"Total: {passed_count}/{total} Passed")
    print("=" * 80)
    print()

    return passed_count == total


if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
