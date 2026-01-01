import { useState, useCallback } from 'react';
import type { MediaFile, MediaMetadata, MetadataStatus } from '../types';
import { GenerationStatus } from '../types';

const readImageMetadata = (file: File): Promise<Pick<MediaMetadata, 'width' | 'height'>> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to read image metadata.'));
    };
    img.src = url;
  });

const readVideoMetadata = (file: File): Promise<Pick<MediaMetadata, 'width' | 'height' | 'durationSec'>> =>
  new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    video.preload = 'metadata';

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve({
        width: video.videoWidth,
        height: video.videoHeight,
        durationSec: Number.isFinite(video.duration) ? video.duration : undefined,
      });
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to read video metadata.'));
    };

    video.src = url;
    video.load();
  });

export const useMediaFiles = () => {
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);

  const updateFile = useCallback((id: string, updates: Partial<MediaFile>) => {
    setMediaFiles(prev =>
      prev.map(mf => (mf.id === id ? { ...mf, ...updates } : mf))
    );
  }, []);

  const deleteSelected = useCallback(() => {
    setMediaFiles(prev => prev.filter(mf => !mf.isSelected));
  }, []);

  const selectAll = useCallback((isChecked: boolean) => {
    setMediaFiles(prev => prev.map(mf => ({ ...mf, isSelected: isChecked })));
  }, []);

  const updateCaption = useCallback((id: string, caption: string) => {
    setMediaFiles(prev =>
      prev.map(mf => (mf.id === id ? { ...mf, caption, qualityScore: undefined } : mf))
    );
  }, []);

  const updateCustomInstructions = useCallback((id: string, instructions: string) => {
    setMediaFiles(prev =>
      prev.map(mf => (mf.id === id ? { ...mf, customInstructions: instructions } : mf))
    );
  }, []);

  const updateSelection = useCallback((id: string, isSelected: boolean) => {
    setMediaFiles(prev =>
      prev.map(mf => (mf.id === id ? { ...mf, isSelected } : mf))
    );
  }, []);

  const convertIdsToTemp = useCallback((mediaFiles: MediaFile[]) => {
    return mediaFiles.map(file => {
      // Generate temporary ID using fallback pattern
      const tempId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      return { ...file, id: tempId };
    });
  }, []);

  const handleFilesAdded = useCallback(async (files: File[], enqueueMetadataRequest: (id: string) => void) => {
    const mediaUploads = files.filter(file => file.type.startsWith('image/') || file.type.startsWith('video/'));
    const captionUploads = files.filter(file => file.name.toLowerCase().endsWith('.txt'));

    const captionMap = new Map<string, File>();
    captionUploads.forEach(file => {
      const baseName = file.name.substring(0, file.name.lastIndexOf('.'));
      captionMap.set(baseName.toLowerCase(), file);
    });

    const newMediaFilesPromises = mediaUploads.map(async (file): Promise<MediaFile> => {
      const id = `${file.name}-${file.lastModified}-${Math.random()}`;
      let caption = '';
      let status = GenerationStatus.IDLE;
      let errorMessage: string | undefined = undefined;
      let metadata: MediaMetadata | undefined = undefined;
      let metadataStatus: MetadataStatus = 'idle';
      let metadataError: string | undefined = undefined;

      const baseName = file.name.substring(0, file.name.lastIndexOf('.'));
      if (captionMap.has(baseName.toLowerCase())) {
        const captionFile = captionMap.get(baseName.toLowerCase())!;
        try {
          caption = await captionFile.text();
          status = GenerationStatus.SUCCESS;
        } catch (e) {
          console.error('Error reading caption file:', e);
          status = GenerationStatus.ERROR;
          errorMessage = 'Failed to read caption file.';
        }
      }

      if (file.type.startsWith('image/')) {
        try {
          const imageMeta = await readImageMetadata(file);
          metadata = {
            ...imageMeta,
            sizeBytes: file.size,
          };
          metadataStatus = 'done';
        } catch (e) {
          console.error('Error reading image metadata:', e);
          metadataStatus = 'error';
          metadataError = 'Failed to read image metadata.';
        }
      } else if (file.type.startsWith('video/')) {
        try {
          const videoMeta = await readVideoMetadata(file);
          metadata = {
            ...videoMeta,
            sizeBytes: file.size,
          };
          metadataStatus = 'loading';
        } catch (e) {
          console.error('Error reading video metadata:', e);
          metadataStatus = 'error';
          metadataError = 'Failed to read video metadata.';
        }
      }

      return {
        id,
        url: '', // Will be set by backend after upload
        name: file.name,
        type: file.type,
        size: file.size,
        file, // Keep file object for now (will be optional in Phase 2)
        previewUrl: URL.createObjectURL(file),
        caption,
        initialCaption: caption, // Initialize with current caption value
        status,
        isSelected: false,
        customInstructions: '',
        errorMessage,
        metadata,
        metadataStatus,
        metadataError,
      };
    });

    const newMediaFiles = await Promise.all(newMediaFilesPromises);
    setMediaFiles(prev => [...prev, ...newMediaFiles]);

    const newMetadataIds = newMediaFiles
      .filter(item => item.type.startsWith('video/') && item.metadataStatus !== 'error')
      .map(item => item.id);
    if (newMetadataIds.length > 0) {
      newMetadataIds.forEach(id => enqueueMetadataRequest(id));
    }
  }, []);

  const selectedFiles = mediaFiles.filter(mf => mf.isSelected);

  return {
    mediaFiles,
    setMediaFiles,
    selectedFiles,
    updateFile,
    deleteSelected,
    selectAll,
    updateCaption,
    updateCustomInstructions,
    updateSelection,
    handleFilesAdded,
    convertIdsToTemp,
  };
};
