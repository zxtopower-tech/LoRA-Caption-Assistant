import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { MediaFile } from '../types';
import type { ProjectMetadata } from '../services/projectService';
import { GenerationStatus } from '../types';

// Helper function to fetch a File from a URL
async function fetchFile(url: string): Promise<File> {
  const response = await fetch(url);
  const blob = await response.blob();
  const filename = url.split('/').pop() || 'file';
  return new File([blob], filename, { type: blob.type });
}

export interface ProjectContextValue {
  // State
  projects: ProjectMetadata[];
  selectedProjectId: string | null;
  isSaving: boolean;
  isLoading: boolean;
  isDeleting: boolean;
  isDownloading: boolean;
  error: string;
  saveProgress: { isActive: boolean; progress: number; current: number; total: number };
  deletedItemIds: Set<string>;

  // Actions
  loadProjectList: () => Promise<void>;
  selectProject: (projectId: string | null, onMediaFilesLoaded?: (mediaFiles: MediaFile[]) => void) => Promise<void>;
  createProject: (projectName: string, mediaFiles: MediaFile[], datasetPrefix: string) => Promise<Map<string, string>>; // Returns tempId -> backendId map
  saveProject: (mediaFiles: MediaFile[], datasetPrefix: string, projectName?: string) => Promise<Map<string, string>>; // Returns tempId -> backendId map
  loadProject: (onMediaFilesLoaded: (mediaFiles: MediaFile[]) => void, projectId?: string) => Promise<void>;
  downloadProject: () => void;
  deleteProject: (projectId: string) => Promise<void>;
  clearError: () => void;
  setDeletedItemIds: React.Dispatch<React.SetStateAction<Set<string>>>;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export const ProjectProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [projects, setProjects] = useState<ProjectMetadata[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [saveProgress, setSaveProgress] = useState({ isActive: false, progress: 0, current: 0, total: 0 });
  const [deletedItemIds, setDeletedItemIds] = useState<Set<string>>(new Set());
  const deletedItemIdsRef = useRef(deletedItemIds);

  // Keep ref in sync with state
  useEffect(() => {
    deletedItemIdsRef.current = deletedItemIds;
  }, [deletedItemIds]);

  // Load project list on mount
  useEffect(() => {
    loadProjectList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadProjectList = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      // Dynamic import to avoid circular dependencies
      const { listProjects } = await import('../services/projectService');
      const projectList = await listProjects(new AbortController().signal);
      setProjects(projectList);
      setError('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load project list.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createProject = useCallback(async (
    projectName: string,
    mediaFiles: MediaFile[],
    datasetPrefix: string
  ): Promise<Map<string, string>> => { // Returns tempId -> backendId map
    if (!projectName || !projectName.trim()) {
      setError('Project name is required.');
      return new Map();
    }

    setIsSaving(true);
    setSaveProgress({ isActive: true, progress: 0, current: 0, total: mediaFiles.length });
    setError('');

    try {
      // Dynamic import to avoid circular dependencies
      const { createEmptyProject, uploadMedia } = await import('../services/projectService');

      // Filename generator helper (matches ZIP naming convention)
      const generateFileName = (index: number, type: 'image' | 'video') => {
        return `${datasetPrefix}_${type}${String(index + 1).padStart(2, '0')}`;
      };

      // Create empty project
      const result = await createEmptyProject(projectName.trim(), new AbortController().signal);
      const projectId = result.id;
      setSelectedProjectId(projectId);

      // Sequential upload to show progress
      // Track backend IDs
      const uploadedFileIds: Map<string, string> = new Map();

      for (let index = 0; index < mediaFiles.length; index++) {
        const mediaFile = mediaFiles[index];
        const isVideo = mediaFile.type.startsWith('video');
        const fileName = generateFileName(index, isVideo ? 'video' : 'image');

        // Get File object from mediaFile
        const file = mediaFile.file || await fetchFile(mediaFile.url);

        // Get preview file if exists
        let previewFile: File | undefined = undefined;
        if (mediaFile.previewFile) {
          // Rename previewFile to match original filename with correct extension
          const extension = mediaFile.previewFile.type.includes('png') ? '.png' : '.jpg';
          previewFile = new File([mediaFile.previewFile], `${fileName}${extension}`, { type: mediaFile.previewFile.type });
        }

        // Create renamed file to match generated sequence name
        // This ensures media and preview share the same baseName for backend association
        const fileExt = file.name.split('.').pop() || '';
        const renamedFile = new File([file], `${fileName}.${fileExt}`, { type: file.type });

        // Upload media file with caption and get backend ID
        const uploadResult = await uploadMedia(projectId, renamedFile, previewFile, mediaFile.caption || '', new AbortController().signal);
        uploadedFileIds.set(mediaFile.id, uploadResult.id);

        // Update progress
        const progress = ((index + 1) / mediaFiles.length) * 100;
        setSaveProgress({ isActive: true, progress, current: index + 1, total: mediaFiles.length });
      }

      // Batch update captions - REMOVED (Handled atomically via uploadMedia)
      // await updateCaptions(projectId, captions, new AbortController().signal);

      // Refresh the project list
      await loadProjectList();

      setError('');

      // Return uploaded file IDs
      return uploadedFileIds;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create project.';
      setError(message);
      throw err;
    } finally {
      setIsSaving(false);
      setSaveProgress({ isActive: false, progress: 100, current: mediaFiles.length, total: mediaFiles.length });
    }
  }, [loadProjectList]);

  const saveProject = useCallback(async (
    mediaFiles: MediaFile[],
    datasetPrefix: string,
    projectName?: string
  ): Promise<Map<string, string>> => {
    console.log('[saveProject] Start. deletedItemIds:', Array.from(deletedItemIdsRef.current));

    setIsSaving(true);
    setSaveProgress({ isActive: true, progress: 0, current: 0, total: mediaFiles.length });
    setError('');

    try {
      const { createEmptyProject, uploadMedia, syncProjectManifest } = await import('../services/projectService');

      // Filename generator helper
      const generateFileName = (index: number, type: 'image' | 'video') => {
        return `${datasetPrefix}_${type}${String(index + 1).padStart(2, '0')}`;
      };

      const isNewProject = !selectedProjectId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selectedProjectId);
      const finalProjectName = projectName || (isNewProject ? selectedProjectId : undefined);

      let projectId: string;

      if (isNewProject) {
        // ... (New project logic remains similar, but we should probably use sync after creation if needed, 
        // OR just upload. For new projects, strict order upload gives IDs.
        // Actually, uploadMedia returns IDs. We should update our mediaFiles with them.

        if (!finalProjectName) throw new Error('Project name is required for new projects.');

        const result = await createEmptyProject(finalProjectName, new AbortController().signal);
        projectId = result.id;
        setSelectedProjectId(projectId);

        // Upload loop - track backend IDs
        const uploadedFileIds: Map<string, string> = new Map();

        for (let index = 0; index < mediaFiles.length; index++) {
          const mediaFile = mediaFiles[index];
          const isVideo = mediaFile.type.startsWith('video');
          const fileName = generateFileName(index, isVideo ? 'video' : 'image');

          const file = mediaFile.file || await fetchFile(mediaFile.url);

          let previewFile: File | undefined = undefined;
          if (mediaFile.previewFile) {
            const extension = mediaFile.previewFile.type.includes('png') ? '.png' : '.jpg';
            previewFile = new File([mediaFile.previewFile], `${fileName}${extension}`, { type: mediaFile.previewFile.type });
          }

          const fileExt = file.name.split('.').pop() || '';
          const renamedFile = new File([file], `${fileName}.${fileExt}`, { type: file.type });

          // Upload and get ID
          const uploadResult = await uploadMedia(projectId, renamedFile, previewFile, mediaFile.caption || '', new AbortController().signal);
          uploadedFileIds.set(mediaFile.id, uploadResult.id);

          // Progress
          const progress = ((index + 1) / mediaFiles.length) * 100;
          setSaveProgress({ isActive: true, progress, current: index + 1, total: mediaFiles.length });
        }
        await loadProjectList();

        // Return uploaded file IDs
        return uploadedFileIds;

      } else {
        // Existing Project - ID-based Sync
        projectId = selectedProjectId!;

        // Import updateCaptions for caption-only changes
        const { updateCaptions } = await import('../services/projectService');

        // 1. Prepare Manifest Sync Request
        // Map current items to target filenames
        const manifestFiles = mediaFiles.map((file, index) => {
          const isVideo = file.type.startsWith('video');
          const targetNameBase = generateFileName(index, isVideo ? 'video' : 'image');

          // We need extension. 
          // If file has name, use it. If not, guess? 
          // Existing files have names. New files have user filenames.
          const ext = file.name.split('.').pop() || (isVideo ? 'mp4' : 'jpg');
          const targetName = `${targetNameBase}.${ext}`;

          return {
            id: file.id, // ID is stable (either from backend or temp)
            filename: targetName,
            // We'll attach other info for upload loop later
            _original: file,
            _targetName: targetName
          };
        });

        // Filter out temp IDs (files not yet on backend) for the Sync call?
        // NO. Sync expects valid backend IDs.
        // If we send a temp ID, the backend will reject it!
        // So we must ONLY sync files that HAVE backend IDs.
        // New files (temp IDs) are appended/inserted after sync?
        // Wait, if I reorder a new file to index 0, I want it at index 0.
        // But backend doesn't know it yet.

        // Strategy:
        // 1. Upload NEW files first? 
        //    If I upload new file, it gets an ID and a Name.
        //    But what name? If I give it target name '01.jpg', it might conflict with existing '01.jpg' (before sync renames it).
        //    Catch-22!

        // Solution with Manifest:
        // 1. Sync EXISTING files to their target positions/names.
        //    For slots occupied by NEW files, we skip them in manifest sync?
        //    No, that leaves gaps or shifts.

        //    Actually, "Safe Shuffle" in backend handles collisions.
        //    If I have Existing A, Existing B, New C.
        //    Order: C, A, B. Suggests names: 01 (C), 02 (A), 03 (B).
        //    Request to Sync: A->02, B->03.
        //    Backend executes. Now we have 02, 03. 01 is free (or was free/temp/deleted).
        //    Then we upload C as 01.

        //    So:
        //    1. Filter `manifestFiles` to only include those with valid Backend IDs (UUID format?).
        //       (Assuming temp IDs look different or we track `isNew`).
        //       Our `useFileUpload` temp IDs are `name-timestamp-random`. Backend IDs are UUIDs.
        //       Let's assume UUID regex validation.

        //    2. Call `syncProjectManifest(projectId, validManifestEntries)`.

        //    3. Iterate ALL files.
        //       If file was in sync (Existing): Check dirty state. If dirty, upload (overwrite).
        //       If file was NOT in sync (New): Upload as new.

        //    This works!

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const validSyncEntries = manifestFiles
          .filter(f => uuidRegex.test(f.id))
          .map(f => ({ id: f.id, filename: f.filename }));

        // Filter deleted item IDs to only include backend IDs (not temp IDs)
        const currentDeletedItemIds = deletedItemIdsRef.current;
        const validDeletedItemIds = Array.from(currentDeletedItemIds).filter(id => uuidRegex.test(id));

        console.log('[ProjectContext] syncProjectManifest request:', {
          validSyncEntries,
          validDeletedItemIds,
          deletedItemIds: Array.from(currentDeletedItemIds)
        });

        if (validSyncEntries.length > 0 || validDeletedItemIds.length > 0) {
          await syncProjectManifest(
            projectId,
            { files: validSyncEntries, deleted_items: validDeletedItemIds },
            new AbortController().signal
          );
        }

        // 2. Upload / Update Loop
        // Track uploaded files to update their IDs after upload
        const uploadedFileIds: Map<string, string> = new Map(); // tempId -> backendId

        for (let index = 0; index < manifestFiles.length; index++) {
          const item = manifestFiles[index];
          const mediaFile = item._original;
          const targetName = item._targetName;

          const isBackendId = uuidRegex.test(mediaFile.id);


          // Upload only NEW files (not yet on backend)
          if (!isBackendId) {
            // Upload
            const file = mediaFile.file || await fetchFile(mediaFile.url);

            let previewFile: File | undefined = undefined;
            if (mediaFile.previewFile) {
              const extension = mediaFile.previewFile.type.includes('png') ? '.png' : '.jpg';
              // Check if targetName already has extension? targetName comes from generateFileName + guessed ext
              // But for the preview filename in uploadMedia, we usually want baseName dependent?
              // `uploadMedia` endpoint takes `preview` file. Backend handles naming?
              // The backend `save_media_file` for preview uses `proxied_name` or similar.
              // Just providing the file object with correct name is good practice.
              // Logic in line 329 was: `${targetName.split('.')[0]}${extension}`
              const previewName = `${targetName.split('.')[0]}${extension}`;
              previewFile = new File([mediaFile.previewFile], previewName, { type: mediaFile.previewFile.type });
            }

            // Rename main file to target
            const renamedFile = new File([file], targetName, { type: file.type });

            // Get backend ID from upload response
            // Note: For existing files, this effectively acts as an upsert/update
            const uploadResult = await uploadMedia(projectId, renamedFile, previewFile, mediaFile.caption || '', new AbortController().signal);
            uploadedFileIds.set(mediaFile.id, uploadResult.id);
          }

          const progress = ((index + 1) / mediaFiles.length) * 100;
          setSaveProgress({ isActive: true, progress, current: index + 1, total: mediaFiles.length });
        }

        // 3. Update captions for existing files with caption changes only
        // Skip files that were just uploaded (as their captions were updated via uploadMedia)
        const changedCaptions: Record<string, string> = {};
        for (const file of mediaFiles) {
          const isBackendId = uuidRegex.test(file.id);
          if (isBackendId && file.caption !== file.initialCaption && !uploadedFileIds.has(file.id)) {
            changedCaptions[file.id] = file.caption;
          }
        }

        if (Object.keys(changedCaptions).length > 0) {
          await updateCaptions(projectId, changedCaptions, new AbortController().signal);
        }

        setDeletedItemIds(new Set());
        await loadProjectList();

        // Return uploaded file IDs
        return uploadedFileIds;
      }

      setError('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save project.';
      setError(message);
      throw err;
    } finally {
      setIsSaving(false);
      setSaveProgress({ isActive: false, progress: 100, current: mediaFiles.length, total: mediaFiles.length });
    }
  }, [selectedProjectId, loadProjectList]);

  const loadProject = useCallback(async (onMediaFilesLoaded: (mediaFiles: MediaFile[]) => void, projectId?: string) => {
    // Use provided projectId parameter or fall back to state
    const targetProjectId = projectId || selectedProjectId;

    if (!targetProjectId) {
      setError('No project selected.');
      return;
    }

    setIsLoading(true);
    setSaveProgress({ isActive: true, progress: 0, current: 0, total: 0 });
    setError('');

    try {
      const { listProjectFiles, downloadFile, downloadPreview } = await import('../services/projectService');

      const fileList = await listProjectFiles(targetProjectId, new AbortController().signal);
      const totalFiles = fileList.length;
      const mediaFiles: MediaFile[] = [];

      for (let i = 0; i < fileList.length; i++) {
        const fileInfo = fileList[i];

        try {
          // Use UUID-based URL (provided by API)
          const originalUrl = fileInfo.files?.original;
          if (!originalUrl) {
            console.error(`UUID URL not found for ${fileInfo.name}`);
            continue;
          }

          const file = await downloadFile(originalUrl, fileInfo.name, new AbortController().signal);

          // Download preview if exists
          let previewFile: File | undefined = undefined;
          let previewUrl = '';
          if (fileInfo.preview && fileInfo.files?.preview) {
            previewFile = await downloadPreview(fileInfo.files.preview, fileInfo.preview.name, new AbortController().signal);
            if (previewFile) {
              previewUrl = URL.createObjectURL(previewFile);
            }
          }

          // Create MediaFile directly
          const mediaFile: MediaFile = {
            id: fileInfo.id,
            url: '', // Will be set when needed
            name: fileInfo.name,
            type: file.type,
            size: file.size,
            file,
            originalUrl: URL.createObjectURL(file),
            previewUrl: previewUrl || URL.createObjectURL(file),
            previewFile,
            files: fileInfo.files,  // Store UUID-based URL
            caption: fileInfo.caption || '',
            initialCaption: fileInfo.caption || '',
            status: GenerationStatus.IDLE,
            isSelected: false,
            customInstructions: '',
            metadataStatus: 'idle',
            metadata: fileInfo.metadata || {},
          };

          mediaFiles.push(mediaFile);

          const progress = ((i + 1) / totalFiles) * 100;
          setSaveProgress({ isActive: true, progress, current: i + 1, total: totalFiles });
        } catch (err) {
          console.error(`Failed to download ${fileInfo.name}:`, err);
        }
      }

      setError('');
      onMediaFilesLoaded(mediaFiles);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load project.';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
      setSaveProgress({ isActive: false, progress: 100, current: 0, total: 0 });
    }
  }, [selectedProjectId]);

  const selectProject = useCallback(async (projectId: string | null, onMediaFilesLoaded?: (mediaFiles: MediaFile[]) => void) => {
    setSelectedProjectId(projectId);
    setDeletedItemIds(new Set());

    // Auto-load project when projectId is provided and onMediaFilesLoaded callback is given
    if (projectId && onMediaFilesLoaded) {
      // Pass projectId directly to avoid timing issues with state updates
      await loadProject(onMediaFilesLoaded, projectId);
    }
  }, [loadProject]);

  const downloadProject = useCallback(async () => {
    if (!selectedProjectId) {
      setError('No project selected.');
      return;
    }

    setIsDownloading(true);
    setError('');

    try {
      // Dynamic import to avoid circular dependencies
      const { downloadProjectBrowser } = await import('../services/projectService');

      const project = projects.find(p => p.id === selectedProjectId);
      if (!project) {
        throw new Error('Project not found in list.');
      }

      await downloadProjectBrowser(selectedProjectId, project.name, new AbortController().signal);
      setError('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to download project.';
      setError(message);
    } finally {
      setIsDownloading(false);
    }
  }, [selectedProjectId, projects]);

  const deleteProject = useCallback(async (projectId: string) => {
    setError('');
    setIsDeleting(true);

    try {
      // Dynamic import to avoid circular dependencies
      const { deleteProject: deleteProjectService } = await import('../services/projectService');

      await deleteProjectService(projectId, new AbortController().signal);

      // Clear selection if deleted project was selected
      if (selectedProjectId === projectId) {
        setSelectedProjectId(null);
      }

      // Refresh the project list
      await loadProjectList();

      setError('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete project.';
      setError(message);
      throw err;
    } finally {
      setIsDeleting(false);
    }
  }, [selectedProjectId, loadProjectList]);

  const clearError = useCallback(() => {
    setError('');
  }, []);

  const value = useMemo<ProjectContextValue>(
    () => ({
      projects,
      selectedProjectId,
      isSaving,
      isLoading,
      isDeleting,
      isDownloading,
      error,
      saveProgress,
      deletedItemIds,
      loadProjectList,
      selectProject,
      createProject,
      saveProject,
      loadProject,
      downloadProject,
      deleteProject,
      clearError,
      setDeletedItemIds,
    }),
    [
      projects,
      selectedProjectId,
      isSaving,
      isLoading,
      isDeleting,
      isDownloading,
      error,
      saveProgress,
      deletedItemIds,
      loadProjectList,
      selectProject,
      createProject,
      saveProject,
      loadProject,
      downloadProject,
      deleteProject,
      clearError,
      setDeletedItemIds,
    ]
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
};

export const useProjectContext = () => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProjectContext must be used within ProjectProvider');
  }
  return context;
};
