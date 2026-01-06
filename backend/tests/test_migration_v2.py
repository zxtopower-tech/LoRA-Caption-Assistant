import pytest
import shutil
import uuid
import json
import sys
from pathlib import Path

# Adjust path to import backend modules
# backend/tests/test_migration_v2.py -> parents[0]=tests, parents[1]=backend
# We want 'backend' in sys.path to import 'storage'
# Actually, if we want 'from storage...', we need 'backend' in path?
# Or do we run from root?
# Existing tests do:
ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

from storage.project_manager import ProjectManager
from storage.history_manager import HistoryManager

@pytest.fixture
def project_manager(tmp_path):
    projects_dir = tmp_path / "projects"
    projects_dir.mkdir()
    history_manager = HistoryManager(projects_dir)
    return ProjectManager(projects_dir, history_manager)

@pytest.mark.asyncio
async def test_standard_migration_v2(project_manager):
    """
    Test migrating a legacy project (filename-based) to ID-based.
    """
    project_id = str(uuid.uuid4())
    project_root = await project_manager.ensure_project_dir(project_id)
    
    # Setup Legacy Project
    # 1. Manifest (V2 structure but files on disk are named by base_name)
    item_id = str(uuid.uuid4())
    manifest = {
        "version": 2,
        "items": [
            {
                "id": item_id,
                "base_name": "legacy_image",
                "extensions": {"original": ".jpg", "preview": ".png"},
                "created_at": "2024-01-01T00:00:00",
                "last_modified": "2024-01-01T00:00:00"
            }
        ]
    }
    await project_manager._save_manifest(project_id, manifest)
    
    # 2. Files on Disk (Legacy naming)
    (project_root / "legacy_image.jpg").write_text("original_content")
    (project_root / "previews").mkdir(exist_ok=True)
    (project_root / "previews" / "legacy_image.png").write_text("preview_content")
    
    # Action: Trigger Migration by loading manifest (Auto-Migration)
    # The 'ensure_manifest' or 'load_manifest' call should trigger it.
    await project_manager.load_manifest(project_id)
    
    # Validation
    # 0. Check format flag
    manifest = await project_manager.load_manifest(project_id)
    assert manifest.get("storage_format") == "id_v1"
    # 1. Old files gone
    assert not (project_root / "legacy_image.jpg").exists()
    assert not (project_root / "previews" / "legacy_image.png").exists()
    
    # 2. New files exist (UUID based)
    assert (project_root / f"{item_id}.jpg").exists()
    assert (project_root / "previews" / f"{item_id}.png").exists()
    
    # 3. Content valid
    assert (project_root / f"{item_id}.jpg").read_text() == "original_content"
    assert (project_root / "previews" / f"{item_id}.png").read_text() == "preview_content"

@pytest.mark.asyncio
async def test_partial_migration_recovery(project_manager):
    """
    Test recovery when migration was partially done (some files moved, some not).
    """
    project_id = str(uuid.uuid4())
    project_root = await project_manager.ensure_project_dir(project_id)
    
    item1_id = str(uuid.uuid4())
    item2_id = str(uuid.uuid4())
    
    manifest = {
        "version": 2,
        "items": [
            {"id": item1_id, "base_name": "file1", "extensions": {"original": ".jpg"}},
            {"id": item2_id, "base_name": "file2", "extensions": {"original": ".jpg"}}
        ]
    }
    await project_manager._save_manifest(project_id, manifest)
    
    # Setup corrupted state:
    # Item1 is already migrated (UUID)
    (project_root / f"{item1_id}.jpg").write_text("content1")
    # Item2 is still legacy (Filename)
    (project_root / "file2.jpg").write_text("content2")
    
    # Run Migration
    await project_manager.migrate_project_structure(project_id)
    
    # Validation
    assert (project_root / f"{item1_id}.jpg").exists()
    assert (project_root / f"{item2_id}.jpg").exists()
    assert not (project_root / "file2.jpg").exists()
    
    assert (project_root / f"{item1_id}.jpg").read_text() == "content1"
    assert (project_root / f"{item2_id}.jpg").read_text() == "content2"

@pytest.mark.asyncio
async def test_history_migration(project_manager):
    """
    Test that history directories are renamed from base_name to UUID.
    """
    project_id = str(uuid.uuid4())
    project_root = await project_manager.ensure_project_dir(project_id)
    
    item_id = str(uuid.uuid4())
    manifest = {
        "version": 2,
        "items": [
            {"id": item_id, "base_name": "my_photo", "extensions": {"original": ".jpg"}}
        ]
    }
    await project_manager._save_manifest(project_id, manifest)
    
    # Structure: .history/my_photo/2024...jpg
    history_root = project_root / ".history"
    legacy_hist_dir = history_root / "my_photo" / "original"
    legacy_hist_dir.mkdir(parents=True)
    (legacy_hist_dir / "20240101.jpg").write_text("hist_content")
    
    # Simulate main file also existing (needed for migration logic usually)
    (project_root / "my_photo.jpg").write_text("current")
    
    # Run Migration
    await project_manager.migrate_project_structure(project_id)
    
    # Validation
    # Should be moved to .history/{uuid}/original
    new_hist_dir = history_root / item_id / "original"
    assert new_hist_dir.exists()
    assert (new_hist_dir / "20240101.jpg").exists()
    assert not legacy_hist_dir.exists()
