from pathlib import Path
import sys

import pytest
from fastapi.testclient import TestClient

ROOT_DIR = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT_DIR / "backend"
sys.path.append(str(BACKEND_DIR))

import app as app_module


ASSETS_DIR = Path(__file__).parent / "assets"
IMAGE_FILE = ASSETS_DIR / "test-image.png"
VIDEO_FILE = ASSETS_DIR / "test-video.mp4"


@pytest.fixture(scope="session")
def client():
    return TestClient(app_module.app)


@pytest.fixture(scope="session")
def ffprobe_available():
    path = app_module.resolve_ffprobe()
    if not path:
        pytest.fail("ffprobe not available (static-ffmpeg failed to initialize)")
    return path


def post_media(client: TestClient, path: Path, content_type: str):
    return client.post(
        "/api/media/metadata",
        files={"file": (path.name, path.read_bytes(), content_type)},
    )


def test_image_metadata(client: TestClient, ffprobe_available):
    response = post_media(client, IMAGE_FILE, "image/png")
    assert response.status_code == 200
    payload = response.json()
    assert payload["width"] == 320
    assert payload["height"] == 240


def test_video_metadata(client: TestClient, ffprobe_available):
    response = post_media(client, VIDEO_FILE, "video/mp4")
    assert response.status_code == 200
    payload = response.json()
    assert payload["width"] == 320
    assert payload["height"] == 240
    assert pytest.approx(2.0, abs=0.05) == payload.get("durationSec")
    assert pytest.approx(30.0, abs=0.1) == payload.get("fps")
    assert payload.get("frameCount") == 60


def test_rejects_non_media(client: TestClient, ffprobe_available):
    response = client.post(
        "/api/media/metadata",
        files={"file": ("note.txt", b"hello", "text/plain")},
    )
    assert response.status_code == 400


def test_ffprobe_missing_returns_500(monkeypatch):
    monkeypatch.setattr(app_module, "resolve_ffprobe", lambda: None)
    client = TestClient(app_module.app)
    response = client.post(
        "/api/media/metadata",
        files={"file": (IMAGE_FILE.name, IMAGE_FILE.read_bytes(), "image/png")},
    )
    assert response.status_code == 500
