import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from backend.app import app 

# Mock Data
MOCK_LATEST_RELEASE_V2 = {
    "tag_name": "v2.0.0",
    "target_commitish": "main",
    "body": "Major update"
}
MOCK_LATEST_RELEASE_V0 = {
    "tag_name": "v0.0.1",
    "target_commitish": "main", 
    "body": "Initial release"
}

@pytest.fixture
def client():
    from routers.system import fetch_github_release
    fetch_github_release.cache_clear()
    return TestClient(app)

def test_version_check_update_available(client):
    """
    Scenario: Local version is 0.0.1, Remote is v2.0.0 -> Update Available
    """
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = MOCK_LATEST_RELEASE_V2

    with patch("httpx.AsyncClient.get", return_value=mock_resp):
        response = client.get("/api/system/version")
        
        assert response.status_code == 200
        data = response.json()
        assert data["has_update"] is True
        assert data["latest_version"] == "v2.0.0"
        assert "repo_url" in data

def test_version_check_no_update(client):
    """
    Scenario: Local version is 0.0.1 (assumed), Remote is v0.0.1 -> No Update
    """
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = MOCK_LATEST_RELEASE_V0

    with patch("httpx.AsyncClient.get", return_value=mock_resp):
        response = client.get("/api/system/version")

        assert response.status_code == 200
        data = response.json()
        assert data["has_update"] is False
        assert data["latest_version"] == "v0.0.1"

def test_github_api_failure(client):
    """
    Scenario: GitHub API returns 500 or network error -> Handled gracefully
    """
    mock_resp = MagicMock()
    mock_resp.status_code = 500

    with patch("httpx.AsyncClient.get", return_value=mock_resp):
        response = client.get("/api/system/version")

        assert response.status_code == 200 
        data = response.json()
        assert data["has_update"] is False
        assert "error" in data
