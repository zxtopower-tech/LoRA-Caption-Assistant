# LCTaz Custom Backend

Backend service for LCTaz Custom, providing granular file management and version control for media projects.

## Architecture (Manifest V2.1 - ID-Based Storage)

The backend uses a strict **ID-centric storage** architecture to decouple logical naming from physical persistence.

- **Item**: A logical grouping of files (Original, Caption, Preview) sharing a UUID.
- **Physical Storage**: Files are stored on disk using their **UUID** (e.g., `uuid.jbp`, `uuid.txt`).
  - Original: `/projects/{id}/{item_id}.{ext}`
  - Preview: `/projects/{id}/previews/{item_id}.{ext}`
  - History: `/projects/{id}/.history/{item_id}/...`
- **Metadata**: User-facing filenames (`base_name`) are stored ONLY in `manifest.json`.
- **Migration**: Projects created with previous versions (Filename-based) are automatically migrated to ID-based storage on first load.
- **Extension Replacement**: Validates that only one file exists per component type for an Item. If an extension changes (e.g., `.jpg` to `.png`), the old file is physically replaced.


## API Endpoints

### System & Utilities
- **GET** `/healthz`
    - Health check. Returns `{"status": "ok"}`.
- **POST** `/api/media/metadata`
    - Probe media file metadata.
    - **Header**: None (Public)
    - **Body**: Multipart form data.
        - `file`: Media file (image/video).

### Profiles
- **GET** `/api/profiles/{profile_id}`
    - Get profile data.
    - **Header**: `Authorization: Bearer <token>`
- **PUT** `/api/profiles/{profile_id}`
    - Save profile data.
    - **Header**: `Authorization: Bearer <token>`
    - **Body**: JSON profile data.

### Workflows (ComfyUI)
- **GET** `/api/workflows`
    - List all available workflow files.
- **POST** `/api/workflows`
    - Upload a new workflow file (.json).
    - **Body**: Multipart form data.
        - `file`: JSON file.
- **GET** `/api/workflows/{filename}`
    - Get content of a specific workflow.
- **DELETE** `/api/workflows/{filename}`
    - Delete a workflow file.

### Projects
- **GET** `/api/projects`
    - List all projects with metadata.
- **POST** `/api/projects`
    - Create a new project.
    - **Body**: Multipart form data.
        - `name`: Project name (required).
        - `file`: Optional ZIP file to initialize project from.
- **GET** `/api/projects/{id}`
    - Get project details/metadata.
- **PUT** `/api/projects/{id}`
    - Update project name (renaming) or upload ZIP (Legacy ingest).
    - **Body**: Multipart form data.
        - `name`: New project name (optional).
        - `file`: ZIP file (optional).
- **DELETE** `/api/projects/{id}`
    - Delete a project and all its files.
- **GET** `/api/projects/{id}/download`
    - Download project as a ZIP archive.
    - **Content**: Includes `manifest.json`, original media, captions, and previews.
    - **Note**: Files inside the ZIP are renamed back to their original user-facing filenames (`base_name`) for portability.

### Project Items (Granular Management)
- **GET** `/api/projects/{id}/items`
    - List all items in the project with metadata and file URLs.
- **POST** `/api/projects/{id}/items`
    - Upload a new media file (Creates a new Item) OR update an existing item (Upsert).
    - **Body**: Multipart form data.
        - `file`: Original media file (required).
        - `preview`: Preview image file (optional).
        - `caption`: Caption text (optional).
- **POST** `/api/projects/{id}/items/{item_id}/caption`
    - Update caption for an item.
    - **Body**: Form data.
        - `caption`: New caption text.
- **PUT** `/api/projects/{id}/captions`
    - Bulk update captions for multiple items.
    - **Body**: JSON.
        - `captions`: Dictionary mapping Item ID to caption text (`{ "uuid": "text" }`).
- **POST** `/api/projects/{id}/items/{item_id}/preview`
    - Update preview image for an item.
    - **Body**: Multipart form data.
        - `file`: Preview image file.
- **PUT** `/api/projects/{id}/items/{item_id}/rename`
    - Rename an item (Base name change).
    - **Body**: JSON.
        - `new_base_name`: New base string (e.g., "my_image_01").
- **DELETE** `/api/projects/{id}/items/{item_id}`
    - Delete an item and all associated files/history.
- **GET** `/api/projects/{id}/items/{item_id}/history`
    - Get history for an item (includes Original, Caption, and Preview versions).
    - **Response**:
        ```json
        {
          "item_id": "uuid",
          "history": [
            {
               "timestamp": "20240101_120000_123456",
               "extension": "jpg",       // No dot
               "size": 12345,
               "modified": 167888.0,
               "subtype": "original",    // "original", "caption", "preview"
               "is_available": true,     // File exists and readable
               "thumbnail_url": "/api/...", // Present if subtype is original/preview and available
               "content_preview": "..."  // Present if subtype is caption (full content)
            }
          ]
        }
        ```
- **GET** `/api/projects/{id}/thumbnails/{item_id}`
    - Get a generated thumbnail (WebP).
    - **Query Parameters**:
        - `history_timestamp`: (Optional) Get thumbnail for a specific history version.
        - `subtype`: (Optional, default="original") Source file type ("original" or "preview").
    - If `history_timestamp` is provided, it generates/retrieves a cached thumbnail for that version directly from the history archive.
    - If omitted, it returns the thumbnail for the current (latest) version, preferring Original but falling back to Preview.
- **POST** `/api/projects/{id}/comfy-preview`
    - Upload a preview generated by ComfyUI and associate it with an existing item.
    - **Body**: Multipart form data.
        - `file`: Preview image file.
        - `original_filename`: Filename of the original media to associate with (e.g., "img_01.jpg").
- **POST** `/api/projects/{id}/manifest`
    - Sync manifest ordering and filenames.
    - Handles **Bulk Reordering**, **Renaming**, and **Safe Shuffle** (2-Phase cycle resolution).
    - **Validates**: Input list must match existing inventory exactly (Integrity Check).
    - **Body**: JSON.
        - `files`: List of objects `{ "id": "uuid", "filename": "new_name.ext" }`.

## Setup

1. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```
2. **Run Server**:
   ```bash
   python main.py
   ```

## Testing

Run unit tests:
```bash
pytest
```