import pytest
import respx
from httpx import Response
from fastapi.testclient import TestClient
from backend.app import app 
# We need to verify caching, so we might need to access the underlying function or mock carefully.
# If we simply use respx, we can check hit count on the mock.

GITHUB_API_URL = "https://api.github.com/repos/zxtopower-tech/LoRA-Caption-Assistant/releases/latest"

@pytest.fixture
def client():
    from routers.system import fetch_github_release
    fetch_github_release.cache_clear()
    return TestClient(app)

import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from backend.app import app 

@pytest.fixture
def client():
    from routers.system import fetch_github_release
    fetch_github_release.cache_clear()
    return TestClient(app)

def test_api_caching(client):
    """
    Scenario: Call API multiple times. Mock should only be hit ONCE.
    """
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"tag_name": "v1.0.0"}

    with patch("httpx.AsyncClient.get", return_value=mock_resp) as mock_get:
        # First Call
        client.get("/api/system/version")
        
        # Second Call
        client.get("/api/system/version")
        
        # Third Call
        client.get("/api/system/version")

        # Verify call count
        assert mock_get.call_count == 1, f"Expected 1 call, got {mock_get.call_count}"

def test_error_details(client):
    """
    Scenario: GitHub API failure.
    """
    mock_resp = MagicMock()
    mock_resp.status_code = 500

    with patch("httpx.AsyncClient.get", return_value=mock_resp):
        response = client.get("/api/system/version")
        data = response.json()
    
        assert response.status_code == 200
        assert data["has_update"] is False
        assert "error" in data, "Response should contain error field"

