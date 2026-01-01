"""
Tests for file history management through ProjectManager.

This tests the integration layer between ProjectManager and HistoryManager,
ensuring file backup, version listing, restore, and deletion work correctly.
"""

import sys
from pathlib import Path

import pytest

ROOT_DIR = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT_DIR / "backend"
sys.path.append(str(BACKEND_DIR))

from storage.history_manager import HistoryManager


@pytest.fixture
def temp_projects_dir(tmp_path):
    """Create a temporary projects directory."""
    projects_dir = tmp_path / "projects"
    projects_dir.mkdir()
    yield projects_dir


@pytest.fixture
def history_manager(temp_projects_dir):
    """Create a HistoryManager with temporary directory."""
    return HistoryManager(temp_projects_dir)


@pytest.fixture
def sample_project_id():
    """Sample project UUID."""
    return "12345678-1234-1234-1234-123456789abc"


@pytest.mark.asyncio
class TestFileHistory:
    """Test file history management through HistoryManager."""

    async def test_backup_file_creates_history_entry(self, history_manager, temp_projects_dir, sample_project_id):
        """Test that backing up a file creates a history entry."""
        project_dir = temp_projects_dir / sample_project_id
        project_dir.mkdir()
        test_file = project_dir / "test.txt"
        test_file.write_text("original content")

        result = await history_manager.backup_file(sample_project_id, "test.txt", source_path=test_file)

        assert result.status == "backed_up"
        assert result.timestamp is not None

        # Verify history was created
        history_dir = project_dir / ".history"
        assert history_dir.exists()

    async def test_list_versions_returns_all_versions(self, history_manager, temp_projects_dir, sample_project_id):
        """Test that list_versions returns all versions across hash directories."""
        project_dir = temp_projects_dir / sample_project_id
        project_dir.mkdir()
        test_file = project_dir / "test.txt"

        # Create 3 backups with different content
        for i in range(3):
            test_file.write_text(f"version {i}")
            await history_manager.backup_file(sample_project_id, "test.txt", source_path=test_file)

        versions = await history_manager.list_versions(sample_project_id, "test.txt")

        assert len(versions) == 3
        # Should be sorted newest first
        assert versions[0]["modified"] >= versions[1]["modified"]
        assert versions[1]["modified"] >= versions[2]["modified"]

    async def test_delete_version_removes_backup(self, history_manager, temp_projects_dir, sample_project_id):
        """Test that deleting a version removes the backup file."""
        project_dir = temp_projects_dir / sample_project_id
        project_dir.mkdir()
        test_file = project_dir / "test.txt"
        test_file.write_text("content")

        # Create backup
        result = await history_manager.backup_file(sample_project_id, "test.txt", source_path=test_file)
        timestamp = result.timestamp

        # Delete version
        success = await history_manager.delete_version(sample_project_id, "test.txt", timestamp)

        assert success

        # Verify backup was deleted
        versions = await history_manager.list_versions(sample_project_id, "test.txt")
        assert len(versions) == 0
