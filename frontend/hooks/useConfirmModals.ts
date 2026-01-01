import { useState, useCallback } from 'react';
import type { MediaFile } from '../types';

/**
 * Conflict information for file upload confirmation modal
 */
export interface ConflictInfo {
  conflictingFiles: string[];
  confirmCallback: () => void;
  cancelCallback: () => void;
}

/**
 * Pending project change information
 */
export interface PendingProjectChange {
  projectId: string;
  projectName: string;
}

/**
 * Parameters for useConfirmModals hook
 */
export interface UseConfirmModalsParams {
  onDeleteSelected: () => void;
  onDeleteOne: (id: string) => void;
  onProfileUpload: (file: File) => void;
  onProfileDownload: (includeApiKeys: boolean) => void;
  onPreviewAll: (regenerateAll?: boolean) => void;
  mediaFiles: MediaFile[];
  onSelectProject: (projectId: string, onLoadCallback?: (files: MediaFile[]) => Promise<void>) => Promise<void>;
  onSetMediaFiles: (files: MediaFile[]) => void;
  onDeleteProject: (projectId: string) => Promise<void>;
  selectedProjectId: string | null;
}

/**
 * Return type for useConfirmModals hook
 */
export interface ConfirmModalsReturn {
  // Modal states
  isConfirmModalOpen: boolean;
  isDeleteConfirmOpen: boolean;
  isProjectDeleteConfirmOpen: boolean;
  isUploadConfirmOpen: boolean;
  isDownloadConfirmOpen: boolean;
  isPreviewConfirmOpen: boolean;
  isProjectChangeConfirmOpen: boolean;

  // Modal data states
  conflictInfo: ConflictInfo | null;
  deleteItemId: string | null;
  pendingUploadFile: File | null;
  includeApiKeys: boolean;
  existingPreviewCount: number;
  totalPreviewCount: number;
  pendingProjectChange: PendingProjectChange | null;
  isProjectChanging: boolean;

  // Modal handlers
  showConflictModal: (conflict: ConflictInfo) => void;
  hideConflictModal: () => void;
  showDeleteConfirm: () => void;
  confirmDelete: () => void;
  hideDeleteConfirm: () => void;
  showDeleteItemConfirm: (id: string) => void;
  showUploadConfirm: (file: File) => void;
  confirmUpload: () => void;
  hideUploadConfirm: () => void;
  showDownloadConfirm: () => void;
  confirmDownload: () => void;
  hideDownloadConfirm: () => void;
  showPreviewConfirm: (existingCount: number, totalCount: number) => void;
  confirmPreviewRegenerateAll: () => void;
  confirmPreviewSkipExisting: () => void;
  hidePreviewConfirm: () => void;
  showProjectDeleteConfirm: (projectId: string) => void;
  confirmProjectDelete: () => void;
  hideProjectDeleteConfirm: () => void;
  showProjectChangeConfirm: (projectId: string, projectName: string) => void;
  confirmProjectChange: () => void;
  hideProjectChangeConfirm: () => void;
  setIncludeApiKeys: (value: boolean) => void;
}

/**
 * Hook for managing all confirmation modals in the application
 *
 * This hook encapsulates the state and handlers for:
 * - File conflict confirmation
 * - Delete confirmation (single and batch)
 * - Project deletion confirmation
 * - Profile upload/download confirmation
 * - Preview generation confirmation
 * - Project change confirmation
 */
export const useConfirmModals = (params: UseConfirmModalsParams): ConfirmModalsReturn => {
  const {
    onDeleteSelected,
    onDeleteOne,
    onProfileUpload,
    onProfileDownload,
    onPreviewAll,
    mediaFiles,
    onSelectProject,
    onSetMediaFiles,
    onDeleteProject,
    selectedProjectId,
  } = params;

  // Modal states
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isProjectDeleteConfirmOpen, setIsProjectDeleteConfirmOpen] = useState(false);
  const [isUploadConfirmOpen, setIsUploadConfirmOpen] = useState(false);
  const [isDownloadConfirmOpen, setIsDownloadConfirmOpen] = useState(false);
  const [isPreviewConfirmOpen, setIsPreviewConfirmOpen] = useState(false);
  const [isProjectChangeConfirmOpen, setIsProjectChangeConfirmOpen] = useState(false);

  // Modal data states
  const [conflictInfo, setConflictInfo] = useState<ConflictInfo | null>(null);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [pendingDeleteProjectId, setPendingDeleteProjectId] = useState<string | null>(null);
  const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);
  const [includeApiKeys, setIncludeApiKeys] = useState(false);
  const [existingPreviewCount, setExistingPreviewCount] = useState(0);
  const [totalPreviewCount, setTotalPreviewCount] = useState(0);
  const [pendingProjectChange, setPendingProjectChange] = useState<PendingProjectChange | null>(null);
  const [isProjectChanging, setIsProjectChanging] = useState(false);

  // File conflict modal handlers
  const showConflictModal = useCallback((conflict: ConflictInfo) => {
    setConflictInfo(conflict);
    setIsConfirmModalOpen(true);
  }, []);

  const hideConflictModal = useCallback(() => {
    setIsConfirmModalOpen(false);
  }, []);

  // Delete confirmation handlers
  const showDeleteConfirm = useCallback(() => {
    setDeleteItemId(null);
    setIsDeleteConfirmOpen(true);
  }, []);

  const confirmDelete = useCallback(() => {
    if (deleteItemId) {
      onDeleteOne(deleteItemId);
    } else {
      onDeleteSelected();
    }
    setIsDeleteConfirmOpen(false);
    setDeleteItemId(null);
  }, [deleteItemId, onDeleteOne, onDeleteSelected]);

  const hideDeleteConfirm = useCallback(() => {
    setIsDeleteConfirmOpen(false);
    setDeleteItemId(null);
  }, []);

  const showDeleteItemConfirm = useCallback((id: string) => {
    setDeleteItemId(id);
    setIsDeleteConfirmOpen(true);
  }, []);

  // Upload confirmation handlers
  const showUploadConfirm = useCallback((file: File) => {
    setPendingUploadFile(file);
    setIsUploadConfirmOpen(true);
  }, []);

  const confirmUpload = useCallback(() => {
    if (pendingUploadFile) {
      onProfileUpload(pendingUploadFile);
    }
    setIsUploadConfirmOpen(false);
    setPendingUploadFile(null);
  }, [pendingUploadFile, onProfileUpload]);

  const hideUploadConfirm = useCallback(() => {
    setIsUploadConfirmOpen(false);
    setPendingUploadFile(null);
  }, []);

  // Download confirmation handlers
  const showDownloadConfirm = useCallback(() => {
    setIsDownloadConfirmOpen(true);
  }, []);

  const confirmDownload = useCallback(() => {
    onProfileDownload(includeApiKeys);
    setIsDownloadConfirmOpen(false);
  }, [includeApiKeys, onProfileDownload]);

  const hideDownloadConfirm = useCallback(() => {
    setIsDownloadConfirmOpen(false);
  }, []);

  // Preview confirmation handlers
  const showPreviewConfirm = useCallback((existingCount: number, totalCount: number) => {
    setExistingPreviewCount(existingCount);
    setTotalPreviewCount(totalCount);
    setIsPreviewConfirmOpen(true);
  }, []);

  const confirmPreviewRegenerateAll = useCallback(() => {
    setIsPreviewConfirmOpen(false);
    onPreviewAll(true); // regenerate all
  }, [onPreviewAll]);

  const confirmPreviewSkipExisting = useCallback(() => {
    setIsPreviewConfirmOpen(false);
    onPreviewAll(false); // skip existing
  }, [onPreviewAll]);

  const hidePreviewConfirm = useCallback(() => {
    setIsPreviewConfirmOpen(false);
  }, []);

  // Project delete confirmation handlers
  const showProjectDeleteConfirm = useCallback((projectId: string) => {
    setPendingDeleteProjectId(projectId);
    setIsProjectDeleteConfirmOpen(true);
  }, []);

  const confirmProjectDelete = useCallback(async () => {
    const projectIdToDelete = pendingDeleteProjectId || selectedProjectId;
    if (!projectIdToDelete) return;
    await onDeleteProject(projectIdToDelete);
    // If deleted project was selected, clear media files
    if (selectedProjectId === projectIdToDelete) {
      onSetMediaFiles([]);
    }
    setIsProjectDeleteConfirmOpen(false);
    setPendingDeleteProjectId(null);
  }, [pendingDeleteProjectId, selectedProjectId, onDeleteProject, onSetMediaFiles]);

  const hideProjectDeleteConfirm = useCallback(() => {
    setIsProjectDeleteConfirmOpen(false);
    setPendingDeleteProjectId(null);
  }, []);

  // Project change confirmation handlers
  const showProjectChangeConfirm = useCallback((projectId: string, projectName: string) => {
    setPendingProjectChange({ projectId, projectName });
    setIsProjectChangeConfirmOpen(true);
  }, []);

  const confirmProjectChange = useCallback(async () => {
    if (pendingProjectChange) {
      setIsProjectChanging(true);
      try {
        // Clear the media files grid before loading the new project
        // This prevents files from different projects from mixing
        onSetMediaFiles([]);

        // Now select and load the new project
        await onSelectProject(pendingProjectChange.projectId, async (loadedMediaFiles: MediaFile[]) => {
          // Use metadata from backend, no need to extract in browser
          const filesWithMetadata = loadedMediaFiles.map((mediaFile) => {
            // Backend provides width/height/durationSec, just add sizeBytes
            const hasMetadata = mediaFile.metadata && (
              (mediaFile.metadata.width && mediaFile.metadata.height) ||
              mediaFile.metadata.durationSec
            );

            return {
              ...mediaFile,
              metadata: {
                ...mediaFile.metadata,
                sizeBytes: mediaFile.size,
              },
              metadataStatus: hasMetadata ? 'done' as const : mediaFile.metadataStatus,
            };
          });

          onSetMediaFiles(filesWithMetadata);
        });
      } finally {
        setIsProjectChanging(false);
      }
    }
    setIsProjectChangeConfirmOpen(false);
    setPendingProjectChange(null);
  }, [pendingProjectChange, onSelectProject, onSetMediaFiles]);

  const hideProjectChangeConfirm = useCallback(() => {
    setIsProjectChangeConfirmOpen(false);
    setPendingProjectChange(null);
  }, []);

  return {
    // Modal states
    isConfirmModalOpen,
    isDeleteConfirmOpen,
    isProjectDeleteConfirmOpen,
    isUploadConfirmOpen,
    isDownloadConfirmOpen,
    isPreviewConfirmOpen,
    isProjectChangeConfirmOpen,

    // Modal data states
    conflictInfo,
    deleteItemId,
    pendingUploadFile,
    includeApiKeys,
    existingPreviewCount,
    totalPreviewCount,
    pendingProjectChange,
    isProjectChanging,

    // Modal handlers
    showConflictModal,
    hideConflictModal,
    showDeleteConfirm,
    confirmDelete,
    hideDeleteConfirm,
    showDeleteItemConfirm,
    showUploadConfirm,
    confirmUpload,
    hideUploadConfirm,
    showDownloadConfirm,
    confirmDownload,
    hideDownloadConfirm,
    showPreviewConfirm,
    confirmPreviewRegenerateAll,
    confirmPreviewSkipExisting,
    hidePreviewConfirm,
    showProjectDeleteConfirm,
    confirmProjectDelete,
    hideProjectDeleteConfirm,
    showProjectChangeConfirm,
    confirmProjectChange,
    hideProjectChangeConfirm,
    setIncludeApiKeys: setIncludeApiKeys,
  };
};
