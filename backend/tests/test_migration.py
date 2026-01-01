"""
Tests for ZIP migration logic (migration.py).
"""

import json
import sys
import zipfile
from pathlib import Path

import pytest

ROOT_DIR = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT_DIR / "backend"
sys.path.append(str(BACKEND_DIR))

from storage.migration import MigrationManager, MigrationResult


@pytest.fixture
def temp_projects_dir(tmp_path):
    """Create a temporary projects directory."""
    projects_dir = tmp_path / "projects"
    projects_dir.mkdir()
    yield projects_dir


@pytest.fixture
def migration_manager(temp_projects_dir):
    """Create a MigrationManager with temporary directory."""
    return MigrationManager(temp_projects_dir)


@pytest.fixture
def sample_project_id():
    """Sample project UUID."""
    return "12345678-1234-1234-1234-123456789abc"


@pytest.fixture
def sample_zip(temp_projects_dir, sample_project_id):
    """Create a sample ZIP file for testing."""
    zip_path = temp_projects_dir / f"{sample_project_id}.zip"

    with zipfile.ZipFile(zip_path, "w") as zf:
        zf.writestr("file1.txt", "content 1")
        zf.writestr("file2.png", b"png data")
        zf.writestr("previews/preview.png", b"preview data")

    return zip_path


class TestMigrationManager:
    """Test MigrationManager functionality."""

    def test_is_migrated_returns_false_when_no_marker(self, migration_manager, sample_project_id):
        """Test that is_migrated returns False when no marker exists."""
        assert not migration_manager.is_migrated(sample_project_id)

    def test_is_migrated_returns_true_when_marker_exists(self, migration_manager, temp_projects_dir, sample_project_id):
        """Test that is_migrated returns True when marker exists."""
        project_dir = temp_projects_dir / sample_project_id
        project_dir.mkdir()
        (project_dir / ".migrated").write_text("{}")

        assert migration_manager.is_migrated(sample_project_id)

    def test_get_migration_marker_returns_none_when_not_migrated(self, migration_manager, sample_project_id):
        """Test that get_migration_marker returns None when not migrated."""
        assert migration_manager.get_migration_marker(sample_project_id) is None

    def test_get_migration_marker_returns_data(self, migration_manager, temp_projects_dir, sample_project_id):
        """Test that get_migration_marker returns marker data."""
        project_dir = temp_projects_dir / sample_project_id
        project_dir.mkdir()

        marker_data = {"migratedAt": "2024-01-01T00:00:00Z", "filesExtracted": 3}
        (project_dir / ".migrated").write_text(json.dumps(marker_data))

        result = migration_manager.get_migration_marker(sample_project_id)
        assert result == marker_data

    def test_needs_migration_returns_true_for_zip_without_directory(self, migration_manager, temp_projects_dir, sample_project_id):
        """Test that needs_migration returns True when ZIP exists but no directory."""
        (temp_projects_dir / f"{sample_project_id}.zip").write_bytes(b"zip data")

        assert migration_manager.needs_migration(sample_project_id)

    def test_needs_migration_returns_false_for_migrated_project(self, migration_manager, temp_projects_dir, sample_project_id):
        """Test that needs_migration returns False when already migrated."""
        (temp_projects_dir / f"{sample_project_id}.zip").write_bytes(b"zip data")

        project_dir = temp_projects_dir / sample_project_id
        project_dir.mkdir()
        (project_dir / ".migrated").write_text("{}")

        assert not migration_manager.needs_migration(sample_project_id)

    def test_needs_migration_returns_false_when_no_zip(self, migration_manager, sample_project_id):
        """Test that needs_migration returns False when no ZIP exists."""
        assert not migration_manager.needs_migration(sample_project_id)

    def test_migrate_project_extracts_zip(self, migration_manager, temp_projects_dir, sample_project_id, sample_zip):
        """Test that migrate_project extracts ZIP contents."""
        result = migration_manager.migrate_project(sample_project_id)

        assert result.status == "migrated"
        assert result.files_count == 3

        # Check files were extracted
        project_dir = temp_projects_dir / sample_project_id
        assert (project_dir / "file1.txt").exists()
        assert (project_dir / "file2.png").exists()
        assert (project_dir / "previews" / "preview.png").exists()

    def test_migrate_project_creates_marker(self, migration_manager, temp_projects_dir, sample_project_id, sample_zip):
        """Test that migrate_project creates migration marker."""
        result = migration_manager.migrate_project(sample_project_id)

        assert result.status == "migrated"
        assert result.marker_path is not None

        marker_path = temp_projects_dir / sample_project_id / ".migrated"
        assert marker_path.exists()

        marker_data = json.loads(marker_path.read_text())
        assert "migratedAt" in marker_data
        assert "filesExtracted" in marker_data

    def test_migrate_project_creates_history_directory(self, migration_manager, temp_projects_dir, sample_project_id, sample_zip):
        """Test that migrate_project creates .history directory."""
        result = migration_manager.migrate_project(sample_project_id)

        assert result.status == "migrated"

        history_dir = temp_projects_dir / sample_project_id / ".history"
        assert history_dir.exists()
        assert history_dir.is_dir()

    def test_migrate_project_returns_no_zip_when_no_zip(self, migration_manager, sample_project_id):
        """Test that migrate_project returns no_zip status when no ZIP exists."""
        result = migration_manager.migrate_project(sample_project_id)

        assert result.status == "no_zip"

    def test_migrate_project_returns_already_migrated(self, migration_manager, temp_projects_dir, sample_project_id, sample_zip):
        """Test that migrate_project returns already_migrated when already migrated."""
        # First migration
        migration_manager.migrate_project(sample_project_id)

        # Second migration
        result = migration_manager.migrate_project(sample_project_id)

        assert result.status == "already_migrated"

    def test_migrate_project_fails_for_corrupted_zip(self, migration_manager, temp_projects_dir, sample_project_id):
        """Test that migrate_project fails for corrupted ZIP."""
        # Create invalid ZIP file
        zip_path = temp_projects_dir / f"{sample_project_id}.zip"
        zip_path.write_bytes(b"not a valid zip file")

        result = migration_manager.migrate_project(sample_project_id)

        assert result.status == "failed"
        assert "corrupted" in result.error.lower()

    def test_validate_migration_checks_marker(self, migration_manager, sample_project_id):
        """Test that validate_migration checks for marker."""
        assert not migration_manager.validate_migration(sample_project_id)

    def test_validate_migration_checks_project_dir(self, migration_manager, temp_projects_dir, sample_project_id):
        """Test that validate_migration checks for project directory."""
        project_dir = temp_projects_dir / sample_project_id
        project_dir.mkdir()

        assert not migration_manager.validate_migration(sample_project_id)

    def test_validate_migration_checks_history_dir(self, migration_manager, temp_projects_dir, sample_project_id):
        """Test that validate_migration checks for .history directory."""
        project_dir = temp_projects_dir / sample_project_id
        project_dir.mkdir()
        (project_dir / ".migrated").write_text("{}")

        assert not migration_manager.validate_migration(sample_project_id)

    def test_validate_migration_passes_for_valid_migration(self, migration_manager, temp_projects_dir, sample_project_id, sample_zip):
        """Test that validate_migration passes for valid migration."""
        migration_manager.migrate_project(sample_project_id)

        assert migration_manager.validate_migration(sample_project_id)

    def test_cleanup_legacy_zip_deletes_zip(self, migration_manager, temp_projects_dir, sample_project_id, sample_zip):
        """Test that cleanup_legacy_zip deletes the ZIP file."""
        migration_manager.migrate_project(sample_project_id)

        zip_path = temp_projects_dir / f"{sample_project_id}.zip"
        assert zip_path.exists()

        result = migration_manager.cleanup_legacy_zip(sample_project_id)

        assert result is True
        assert not zip_path.exists()

    def test_cleanup_legacy_zip_returns_false_for_invalid_migration(self, migration_manager, sample_project_id):
        """Test that cleanup_legacy_zip returns False for invalid migration."""
        assert not migration_manager.cleanup_legacy_zip(sample_project_id)

    def test_migrate_all_projects_migrates_multiple(self, migration_manager, temp_projects_dir):
        """Test that migrate_all_projects migrates multiple projects."""
        # Create multiple ZIP files
        project1_id = "11111111-1111-1111-1111-111111111111"
        project2_id = "22222222-2222-2222-2222-222222222222"
        project3_id = "33333333-3333-3333-3333-333333333333"

        for pid in [project1_id, project2_id, project3_id]:
            zip_path = temp_projects_dir / f"{pid}.zip"
            with zipfile.ZipFile(zip_path, "w") as zf:
                zf.writestr("test.txt", "content")

        # Migrate one project manually
        migration_manager.migrate_project(project2_id)

        results = migration_manager.migrate_all_projects()

        assert len(results["migrated"]) == 2
        assert len(results["skipped"]) == 1
        assert len(results["failed"]) == 0

    def test_migrate_all_projects_handles_non_uuid_files(self, migration_manager, temp_projects_dir):
        """Test that migrate_all_projects skips non-UUID files."""
        # Create file that's not a UUID
        (temp_projects_dir / "not-a-uuid.zip").write_bytes(b"zip data")

        results = migration_manager.migrate_all_projects()

        assert len(results["migrated"]) == 0
        assert len(results["skipped"]) == 0
        assert len(results["failed"]) == 0

    def test_migrate_all_projects_reports_failures(self, migration_manager, temp_projects_dir):
        """Test that migrate_all_projects reports migration failures."""
        project_id = "11111111-1111-1111-1111-111111111111"

        # Create corrupted ZIP
        (temp_projects_dir / f"{project_id}.zip").write_bytes(b"corrupted")

        results = migration_manager.migrate_all_projects()

        assert len(results["failed"]) == 1
        assert results["failed"][0]["project_id"] == project_id
        assert "error" in results["failed"][0]
