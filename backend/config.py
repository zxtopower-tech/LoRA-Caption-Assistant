"""
Configuration module for backend application.

Centralizes all path configurations using backend folder as the base reference.
"""
import os
from pathlib import Path
from typing import Optional


class AppConfig:
    """Application configuration with centralized path management."""

    def __init__(self):
        # Backend directory as the base reference (absolute path)
        self.backend_dir = Path(__file__).parent.absolute()

        # Data directory (backend/data)
        self.data_dir = self.backend_dir / "data"

        # Individual directory paths
        self.profiles_dir = self._get_path(
            "PROFILE_STORAGE_DIR",
            self.data_dir / "profiles"
        )
        self.workflows_dir = self._get_path(
            "WORKFLOWS_DIR",
            self.data_dir / "workflows"
        )
        self.projects_dir = self._get_path(
            "PROJECTS_DIR",
            self.data_dir / "projects"
        )
        self.thumbnails_dir = self._get_path(
            "THUMBNAILS_DIR",
            self.data_dir / "thumbnails"
        )

        # Other settings
        self.api_token = os.getenv("PROFILE_API_TOKEN", "")
        self.cors_origins = self._parse_cors_origins(os.getenv("CORS_ORIGINS", "*"))

        # Root directory (Parent of backend)
        self.root_dir = self.backend_dir.parent
        self.version_file = self.root_dir / "VERSION"

        # GitHub Update Settings
        self.github_repo_url = "https://github.com/zxtopower-tech/LoRA-Caption-Assistant"
        self.github_api_url = "https://api.github.com/repos/zxtopower-tech/LoRA-Caption-Assistant/releases/latest"

    def _get_path(self, env_var: str, default: Path) -> Path:
        """Get path from environment variable or use default.

        If environment variable provides an absolute path, use it directly.
        If relative path, resolve from backend directory.
        """
        env_path = os.getenv(env_var)
        if env_path:
            path = Path(env_path)
            if path.is_absolute():
                return path
            # Relative path: resolve from backend directory
            return self.backend_dir / env_path
        return default

    def _parse_cors_origins(self, cors_str: str) -> list[str]:
        """Parse CORS origins string."""
        if cors_str.strip() == "*":
            return ["*"]
        return [origin.strip() for origin in cors_str.split(",") if origin.strip()]

    def ensure_directories(self) -> None:
        """Create necessary directories if they don't exist."""
        self.profiles_dir.mkdir(parents=True, exist_ok=True)
        self.workflows_dir.mkdir(parents=True, exist_ok=True)
        self.projects_dir.mkdir(parents=True, exist_ok=True)
        self.thumbnails_dir.mkdir(parents=True, exist_ok=True)


# Global config instance
_config: Optional[AppConfig] = None


def get_config() -> AppConfig:
    """Get or create global config instance."""
    global _config
    if _config is None:
        _config = AppConfig()
        _config.ensure_directories()
    return _config
