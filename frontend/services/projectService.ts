import { BASE_URL } from './apiConfig';
import type { FileHistoryEntry } from '../types';
import type { MediaItemHistoryEntry } from '../types';
import type { ProjectMetadata } from '../types';
import type { MediaMetadata } from '../types';

export type { ProjectMetadata };

const normalizeBaseUrl = (baseUrl: string) => baseUrl.replace(/\/+$/, '');
const buildProjectUrl = (baseUrl: string, path: string) => `${normalizeBaseUrl(baseUrl)}${path}`;

// ===== Caption Auto-Save =====

/**
 * Update captions for a project (auto-save)
 * PUT /api/projects/{id}/captions
 */
export const updateCaptions = async (
  projectId: string,
  captions: Record<string, string>,
  signal?: AbortSignal
): Promise<void> => {
  const response = await fetch(buildProjectUrl(BASE_URL, `/api/projects/${encodeURIComponent(projectId)}/captions`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ captions }),
    signal,
  });
  if (!response.ok) throw new Error(`Failed to update captions: ${response.statusText}`);
};


/**
 * Delete a media item by ID.
 * DELETE /api/projects/{id}/items/{itemId}
 */
export const deleteMediaItem = async (
  projectId: string,
  itemId: string,
  signal?: AbortSignal
): Promise<void> => {
  const response = await fetch(buildProjectUrl(BASE_URL, `/api/projects/${encodeURIComponent(projectId)}/items/${encodeURIComponent(itemId)}`), {
    method: 'DELETE',
    signal,
  });
  if (!response.ok) throw new Error(`Failed to delete media item: ${response.statusText}`);

};

/**
 * Rename a media item.
 * PUT /api/projects/{id}/items/{itemId}/rename
 */
export const renameMediaItem = async (
  projectId: string,
  itemId: string,
  newBaseName: string,
  signal?: AbortSignal
): Promise<{ status: string; new_base_name: string }> => {
  const response = await fetch(buildProjectUrl(BASE_URL, `/api/projects/${encodeURIComponent(projectId)}/items/${encodeURIComponent(itemId)}/rename`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ new_base_name: newBaseName }),
    signal,
  });
  if (!response.ok) throw new Error(`Failed to rename media item: ${response.statusText}`);
  return await response.json();
};

/**
 * Upload a single media file to a project
 * POST /api/projects/{id}/media
 */
/**
 * Upload a single media file to a project
 * POST /api/projects/{id}/items
 */
export const uploadMedia = async (
  projectId: string,
  file: File,
  preview?: File,
  caption?: string,
  signal?: AbortSignal
): Promise<{ id: string; status: string }> => {
  const formData = new FormData();
  formData.append('file', file);
  if (preview) {
    formData.append('preview', preview);
  }
  if (caption) {
    formData.append('caption', caption);
  }
  const response = await fetch(buildProjectUrl(BASE_URL, `/api/projects/${encodeURIComponent(projectId)}/items`), {
    method: 'POST',
    body: formData,
    signal,
  });
  if (!response.ok) throw new Error(`Failed to upload media: ${response.statusText}`);
  return await response.json();
};

/**
 * Save ComfyUI preview for a media file
 * POST /api/projects/{id}/comfy-preview
 *
 * @param projectId - Project ID
 * @param previewFile - ComfyUI downloaded preview file
 * @param originalFilename - Original media filename (e.g., "item_image01.jpg")
 * @param signal - Optional abort signal
 * @returns Response with status, preview_path, and backup_result
 */
/**
 * Save ComfyUI preview for a media file
 * POST /api/projects/{id}/comfy-preview
 *
 * @param projectId - Project ID
 * @param previewFile - ComfyUI downloaded preview file
 * @param originalFilename - Original media filename (e.g., "item_image01.jpg")
 * @param signal - Optional abort signal
 * @returns Response with status, preview_path, and backup_result
 */
export const saveComfyPreview = async (
  projectId: string,
  previewFile: File,
  originalFilename: string,
  signal?: AbortSignal
): Promise<{
  status: 'saved' | 'skipped' | 'error';
}> => {
  const formData = new FormData();
  formData.append('file', previewFile);
  formData.append('original_filename', originalFilename);

  const response = await fetch(
    buildProjectUrl(BASE_URL, `/api/projects/${encodeURIComponent(projectId)}/comfy-preview`),
    {
      method: 'POST',
      body: formData,
      signal,
    }
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(`Failed to save ComfyUI preview: ${errorText}`);
  }

  const result = await response.json();
  return result;
};

/**
 * Sync project manifest (reorder/rename)
 * POST /api/projects/{id}/manifest
 */
export const syncProjectManifest = async (
  projectId: string,
  files: { id: string; filename: string }[],
  signal?: AbortSignal
): Promise<void> => {
  const response = await fetch(buildProjectUrl(BASE_URL, `/api/projects/${encodeURIComponent(projectId)}/manifest`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files }),
    signal,
  });
  if (!response.ok) throw new Error(`Failed to sync manifest: ${response.statusText}`);
};

// ===== File History Operations =====

/**
 * Get history for a specific file
 * GET /api/projects/{id}/files/{filename}/history
 *
 * Returns array of file versions wrapped in { "versions": [...] }
 */
/**
 * Get history for a specific file (Item)
 * GET /api/projects/{id}/items/{itemId}/history
 */
export const getFileHistory = async (
  projectId: string,
  itemId: string,
  signal?: AbortSignal
): Promise<FileHistoryEntry[]> => {
  const url = buildProjectUrl(BASE_URL, `/api/projects/${encodeURIComponent(projectId)}/items/${encodeURIComponent(itemId)}/history`);
  const response = await fetch(
    url,
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal,
    }
  );
  if (!response.ok) throw new Error(`Failed to get file history: ${response.statusText}`);
  const data = await response.json();
  // Backend returns { item_id, history: [...] }. Frontend expects array of versions?
  // Old API returned { versions: [...] } or array? 
  // Old function returned `data.versions`.
  // Backend V2 returns `data.history`.
  return data.history;
};

/**
 * Get integrated history for a media item (original + caption + preview)
 * GET /api/projects/{id}/media/{filename}/history
 *
 * Returns array of history entries showing all related file changes
 *
 * @param projectId - Project ID
 * @param filename - Original filename (e.g., "item_image01.jpg")
 * @returns Array of integrated history entries
 */
/**
 * Get integrated history for a media item (Item)
 * GET /api/projects/{id}/items/{itemId}/history
 */
export const getMediaItemHistory = async (
  projectId: string,
  itemId: string,
  signal?: AbortSignal
): Promise<MediaItemHistoryEntry[]> => {
  const url = buildProjectUrl(BASE_URL, `/api/projects/${encodeURIComponent(projectId)}/items/${encodeURIComponent(itemId)}/history?_t=${Date.now()}`);
  const response = await fetch(
    url,
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal,
    }
  );
  if (!response.ok) throw new Error(`Failed to get media item history: ${response.statusText}`);
  const data = await response.json();
  return data.history;
};


/**
 * Get content of a specific version of a file
 * GET /api/projects/{id}/files/{filename}/version?timestamp={timestamp}&type={fileType}
 *
 * @param projectId - Project ID
 * @param filename - File name
 * @param timestamp - Version timestamp
 * @param fileType - Optional file type ('original' | 'caption' | 'preview')
 * @param signal - Optional abort signal
 */
export const getVersionContent = async (
  projectId: string,
  filename: string,
  timestamp: string,
  fileType?: 'original' | 'caption' | 'preview',
  signal?: AbortSignal
): Promise<string> => {
  const url = buildProjectUrl(BASE_URL, `/api/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(filename)}/version`);
  const apiUrl = fileType
    ? `${url}?type=${fileType}&timestamp=${encodeURIComponent(timestamp)}`
    : `${url}?timestamp=${encodeURIComponent(timestamp)}`;

  const response = await fetch(apiUrl, { signal });
  if (!response.ok) throw new Error(`Failed to get version content: ${response.statusText}`);
  const data = await response.json();
  return data.content;
};

/**
 * Download a specific version of a file
 * GET /api/projects/{id}/files/{filename}/version/download?timestamp={timestamp}&type={fileType}
 *
 * @param projectId - Project ID
 * @param filename - File name
 * @param timestamp - Version timestamp
 * @param fileType - File type ('original' | 'caption' | 'preview')
 * @param signal - Optional abort signal
 */
export const downloadVersionFile = async (
  projectId: string,
  filename: string,
  timestamp: string,
  fileType: 'original' | 'caption' | 'preview',
  signal?: AbortSignal
): Promise<void> => {
  const url = buildProjectUrl(BASE_URL, `/api/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(filename)}/version/download`);
  const apiUrl = `${url}?type=${fileType}&timestamp=${encodeURIComponent(timestamp)}`;

  const response = await fetch(apiUrl, { signal });
  if (!response.ok) throw new Error(`Failed to download version file: ${response.statusText}`);

  // Extract filename from Content-Disposition header
  const contentDisposition = response.headers.get('Content-Disposition');
  let downloadFilename = `${timestamp}`;
  if (contentDisposition) {
    const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    if (filenameMatch && filenameMatch[1]) {
      downloadFilename = filenameMatch[1].replace(/['"]/g, '');
    }
  }

  const blob = await response.blob();
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = downloadFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(downloadUrl);
};

/**
 * Create an empty project without uploading a ZIP file
 * POST /api/projects (without file parameter)
 */
export const createEmptyProject = async (
  name: string,
  signal?: AbortSignal
): Promise<ProjectMetadata> => {
  const formData = new FormData();
  formData.append('name', name);
  const response = await fetch(buildProjectUrl(BASE_URL, '/api/projects'), {
    method: 'POST',
    headers: { 'Accept': 'application/json' },
    body: formData,
    signal,
  });
  if (!response.ok) throw new Error(`Failed to create project: ${response.statusText}`);
  return (await response.json()) as ProjectMetadata;
};

export const createProject = async (name: string, zipFile: File, signal?: AbortSignal): Promise<ProjectMetadata> => {
  const formData = new FormData();
  formData.append('file', zipFile);
  formData.append('name', name);
  const response = await fetch(buildProjectUrl(BASE_URL, '/api/projects'), {
    method: 'POST', body: formData, signal,
  });
  if (!response.ok) throw new Error(`Failed to create project: ${response.statusText}`);
  return (await response.json()) as ProjectMetadata;
};

export const listProjects = async (signal?: AbortSignal): Promise<ProjectMetadata[]> => {
  const response = await fetch(buildProjectUrl(BASE_URL, '/api/projects'), {
    method: 'GET', headers: { Accept: 'application/json' }, signal,
  });
  if (!response.ok) throw new Error(`Failed to list projects: ${response.statusText}`);
  const data = await response.json();
  return data.projects;
};

export const updateProject = async (projectId: string, zipFile: File, name?: string, signal?: AbortSignal): Promise<ProjectMetadata> => {
  const formData = new FormData();
  formData.append('file', zipFile);
  if (name) formData.append('name', name);
  const response = await fetch(buildProjectUrl(BASE_URL, `/api/projects/${encodeURIComponent(projectId)}`), {
    method: 'PUT', body: formData, signal,
  });
  if (!response.ok) throw new Error(`Failed to update project: ${response.statusText}`);
  return (await response.json()) as ProjectMetadata;
};

export const deleteProject = async (projectId: string, signal?: AbortSignal): Promise<void> => {
  const response = await fetch(buildProjectUrl(BASE_URL, `/api/projects/${encodeURIComponent(projectId)}`), {
    method: 'DELETE', signal,
  });
  if (!response.ok) throw new Error(`Failed to delete project: ${response.statusText}`);
};

export const downloadProjectZip = async (projectId: string, signal?: AbortSignal): Promise<Blob> => {
  const response = await fetch(buildProjectUrl(BASE_URL, `/api/projects/${encodeURIComponent(projectId)}/download`), {
    method: 'GET', signal,
  });
  if (!response.ok) throw new Error(`Failed to download project: ${response.statusText}`);
  return await response.blob();
};

export const downloadProjectBrowser = async (projectId: string, projectName: string, signal?: AbortSignal): Promise<void> => {
  const blob = await downloadProjectZip(projectId, signal);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${projectName.replace(/[\\/*?:"<>|]/g, '_')}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// ===== Granular Project Load Functions =====

export interface PreviewInfo {
  name: string;
  type: string;
  size: number;
}

export interface ProjectFileInfo {
  id: string;
  name: string;
  type: string;
  size: number;
  preview: PreviewInfo | null;
  caption: string;
  metadata?: Partial<MediaMetadata>;
}

/**
 * List project files with metadata
 * GET /api/projects/{id}/files
 */
/**
 * List project items with metadata
 * GET /api/projects/{id}/items
 */
export const listProjectFiles = async (
  projectId: string,
  signal?: AbortSignal
): Promise<ProjectFileInfo[]> => {
  const response = await fetch(
    buildProjectUrl(BASE_URL, `/api/projects/${encodeURIComponent(projectId)}/items`),
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal,
    }
  );
  if (!response.ok) throw new Error(`Failed to list files: ${response.statusText}`);
  const data = await response.json();

  // Map items to ProjectFileInfo
  return data.items.map((item: any) => {
    // Reconstruct name from base_name and original extension
    const originalExt = item.extensions.original || '';
    const name = `${item.base_name}${originalExt}`;

    // Construct preview info if available
    let previewInfo: PreviewInfo | null = null;
    if (item.extensions.preview) {
      const previewExt = item.extensions.preview;
      previewInfo = {
        name: `${item.base_name}${previewExt}`,
        type: previewExt === '.png' ? 'image/png' : 'image/jpeg', // Guess
        size: 0 // Unknown
      };
    }

    return {
      id: item.id,
      name: name,
      type: originalExt === '.mp4' ? 'video/mp4' : 'image/jpeg', // Simple guess
      size: item.size || 0,
      preview: previewInfo,
      caption: item.caption_content || '',
      metadata: item.metadata
    };
  });
};

/**
 * Download individual file as File object
 * GET /api/projects/{id}/files/{filename}
 */
/**
 * Download individual file as File object
 * Use static URL construction.
 */
export const downloadFile = async (
  projectId: string,
  filename: string, // actually we might need id if we wanted to be strict, but static files are by filename
  signal?: AbortSignal
): Promise<File> => {
  const url = buildProjectUrl(BASE_URL, `/static/projects/${encodeURIComponent(projectId)}/${encodeURIComponent(filename)}`);
  const response = await fetch(
    url,
    {
      method: 'GET',
      signal,
    }
  );
  if (!response.ok) throw new Error(`Failed to download file: ${response.statusText}`);
  const blob = await response.blob();
  return new File([blob], filename, { type: blob.type });
};

/**
 * Download preview file as File object
 * GET /api/projects/{id}/preview/{filename}
 */
/**
 * Download preview file as File object
 * Use static URL construction.
 */
export const downloadPreview = async (
  projectId: string,
  filename: string,
  signal?: AbortSignal
): Promise<File | undefined> => {
  try {
    const url = buildProjectUrl(BASE_URL, `/static/projects/${encodeURIComponent(projectId)}/previews/${encodeURIComponent(filename)}`);
    const response = await fetch(
      url,
      {
        method: 'GET',
        signal,
      }
    );
    if (!response.ok) return undefined;
    const blob = await response.blob();
    return new File([blob], filename, { type: blob.type });
  } catch {
    return undefined;
  }
};
