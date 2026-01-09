import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from backend.app import app 

@pytest.fixture
def client():
    # Clear cache to ensure fresh execution
    from routers.system import fetch_github_release
    fetch_github_release.cache_clear()
    return TestClient(app)

def test_user_agent_header_compliance(client):
    """
    Scenario: Verify that the GitHub API request includes the correct User-Agent header.
    Should be format: LoRA-Caption-Assistant/{version}
    """
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"tag_name": "v9.9.9"}

    with patch("httpx.AsyncClient.get", return_value=mock_resp) as mock_get:
        client.get("/api/system/version")
        
        assert mock_get.call_count == 1
        # Check arguments passed to client.get
        # call_args[1] is kwargs
        headers = mock_get.call_args[1].get("headers", {})
        user_agent = headers.get("User-Agent", "")
        
        assert "LoRA-Caption-Assistant/" in user_agent, f"User-Agent '{user_agent}' does not match expected format."
        # We expect at least some version number
        assert user_agent != "LoRA-Caption-Assistant/", "User-Agent should include version number."

def test_response_schema_validation(client):
    """
    Scenario: Verify response matches Expected Schema (SystemVersionResponse).
    We can't easily check internal Pydantic usage from outside, 
    but we can verify exact field presence and types.
    """
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"tag_name": "v0.0.1"}

    with patch("httpx.AsyncClient.get", return_value=mock_resp):
        response = client.get("/api/system/version")
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields for SystemVersionResponse
        required_fields = ["current_version", "latest_version", "has_update", "repo_url", "release_notes"]
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        
        # Check optional error field (should be null or string if present)
        if "error" in data:
            assert data["error"] is None or isinstance(data["error"], str)
