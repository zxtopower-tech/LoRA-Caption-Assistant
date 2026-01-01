# LoRA Caption AssistantLoRA Caption Assistant

![Project Preview](assets/preview.png)

# Description :
LoRA Caption Assistant is a specialized workspace designed for creators to meticulously curate datasets and seamlessly generate AI captions. By bridging the gap between dataset management and creative generation, it empowers you to build higher-quality models with greater ease and precision.

# Features :
-   **Effortless Dataset Curation**:
    -   **Strict Versioning**: Every change—metadata updates, file replacements—is tracked. Revert to any previous state with confidence.
    -   **Preserved Integrity**: Original files are always safe, while you freely experiment with captions and previews.
    -   **Intuitive Organization**: Drag, drop, and rename files naturally, just like on your desktop.

-   **Seamless Creative Flow**:
    -   **Unified Workspace**: execute complex ComfyUI workflows directly within your project.
    -   **Real-time Preview**: See your generated results instantly synced to your project items.
    -   **Workflow Library**: Build and manage your own library of reusable generation templates.

-   **Smart Captioning Assistant**:
    -   **Multi-Model Intelligence**: Leverage Google Gemini or local LLMs to generate detailed, context-aware captions.
# Requirements :
-   **Docker & Docker Compose**: For containerized deployment.
-   **Development**:
    -   Node.js v18+ (Frontend)
    -   Python 3.10+ (Backend)

# Installation & Quick Start :

First, **clone the repository**:
```bash
git clone https://github.com/zxtopower-tech/LoRA-Caption-Assistant.git
cd LoRA-Caption-Assistant
```

### 🪟 Windows
1. Double-click `run.bat`
2. Wait for the launcher to install dependencies and start servers.
- **Access**: `http://localhost:7680` (Automatically opens)

### 🐧 Linux / macOS
1. Open terminal and run:
   ```bash
   ./run.sh
   ```
- **Access**: `http://localhost:7860` (Automatically opens)

### 🐳 Docker Compose (Recommended)
```bash
docker-compose up -d
```
- **Access**: `http://localhost:8080`

# Usage :
-   **Web Interface**:
    -   Navigate to the URL provided by your chosen launch method.
    -   Create a project and start uploading media.
-   **Local Development**:
    -   **Backend**: `uvicorn app:app --reload --port 8001` (in `backend/` directory).
    -   **Frontend**: `npm run dev` (in `frontend/` directory).

# Configuration :
-   **Docker Volumes**:
    -   `loracaptioner-backend`: Persists `/app/backend` containing:
        -   `data/projects`: Project media and metadata.
        -   `data/workflows`: ComfyUI workflows.
        -   `data/profiles`: User settings.

# License :
MIT

# Reference :
- [Original Documentation](assets/README.original.md)
