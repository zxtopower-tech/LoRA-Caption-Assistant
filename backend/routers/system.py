from fastapi import APIRouter
import httpx
import logging
from typing import Dict, Any, Optional
from packaging import version
from config import get_config
from async_lru import alru_cache
import aiofiles

router = APIRouter()
config = get_config()
logger = logging.getLogger(__name__)

from pydantic import BaseModel

class SystemVersionResponse(BaseModel):
    current_version: str
    latest_version: str
    has_update: bool
    repo_url: str
    release_notes: str = ""
    error: Optional[str] = None

@alru_cache(maxsize=1, ttl=3600)
async def fetch_github_release(user_agent_version: str = "1.0") -> Optional[Dict[str, Any]]:
    """
    Fetch latest release from GitHub with caching (1 hour TTL).
    """
    headers = {
        "User-Agent": f"LoRA-Caption-Assistant/{user_agent_version}",
        "Accept": "application/vnd.github+json"
    }
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(config.github_api_url, headers=headers)
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"GitHub API returned {response.status_code}")
                return None
    except Exception as e:
        logger.error(f"GitHub API Request Failed: {e}")
        return None

@router.get("/api/system/version", response_model=SystemVersionResponse)
async def get_system_version() -> SystemVersionResponse:
    """
    Check for updates by comparing local VERSION with GitHub Latest Release.
    """
    # 1. Get Local Version (Async)
    local_version_str = "0.0.0"
    if config.version_file.exists():
        try:
            async with aiofiles.open(config.version_file, mode='r', encoding='utf-8') as f:
                 content = await f.read()
                 local_version_str = content.strip()
        except Exception as e:
            logger.error(f"Failed to read VERSION file: {e}")
    
    # 2. Get Remote Version
    latest_version_str = local_version_str
    has_update = False
    release_notes = ""
    error_msg = None
    
    # Pass local version to fetch function for User-Agent
    data = await fetch_github_release(user_agent_version=local_version_str)
    
    if data:
        remote_tag = data.get("tag_name", "").strip()
        release_notes = data.get("body", "")
        
        # Compare versions
        v_local = local_version_str.lstrip("v")
        v_remote = remote_tag.lstrip("v")
        
        if v_remote and v_local:
            latest_version_str = remote_tag
            try:
                if version.parse(v_remote) > version.parse(v_local):
                    has_update = True
            except Exception:
                logger.warning(f"Version parsing failed for {v_local} vs {v_remote}")
                if v_remote != v_local:
                     # Fallback logic if needed, but for now we stick to parsing safety
                     pass
    else:
        # Only set error message if data fetch failed AND we can't determine update status
        # But we still return the current version info
        error_msg = "Failed to fetch update information from GitHub."

    return SystemVersionResponse(
        current_version=local_version_str,
        latest_version=latest_version_str,
        has_update=has_update,
        repo_url=config.github_repo_url,
        release_notes=release_notes,
        error=error_msg
    )
