import { useEffect, useCallback } from 'react';
import type { MediaFile } from '../types';
import { fetchMediaMetadata, mergeMetadata } from '../services/mediaMetadataService';
import type { MediaMetadata } from '../types';
import { useToast } from './useToast';

interface UseMetadataQueueProps {
  metadataQueue: string[];
  metadataActiveId: string | null;
  metadataCompletedCount: number;
  setMetadataQueue: React.Dispatch<React.SetStateAction<string[]>>;
  setMetadataActiveId: (id: string | null) => void;
  setMetadataCompletedCount: React.Dispatch<React.SetStateAction<number>>;
  mediaFiles: MediaFile[];
  updateFile: (id: string, updates: Partial<MediaFile>) => void;
  projectId: string | null;
}

export const useMetadataQueue = ({
  metadataQueue,
  metadataActiveId,
  metadataCompletedCount,
  setMetadataQueue,
  setMetadataActiveId,
  setMetadataCompletedCount,
  mediaFiles,
  updateFile,
  projectId,
}: UseMetadataQueueProps) => {
  const { error: toastError } = useToast();

  const enqueueMetadataRequest = useCallback((id: string) => {
    setMetadataQueue((prev: string[]) => [...prev, id]);
  }, []);

  // Process metadata queue
  useEffect(() => {
    if (metadataActiveId || metadataQueue.length === 0) return;

    const nextId = metadataQueue[0];
    setMetadataActiveId(nextId);
    setMetadataQueue((prev: string[]) => prev.slice(1));

    const processMetadata = async () => {
      const item = mediaFiles.find(mf => mf.id === nextId);
      if (!item) {
        return;
      }

      // For now, file is required for metadata fetching
      // In Phase 2, this will be updated to fetch the file when needed
      if (!item.file) {
        return;
      }

      // Skip server metadata request if no project is selected
      // Browser-based metadata extraction should be sufficient in this case
      if (!projectId) {
        return;
      }

      updateFile(nextId, { metadataStatus: 'loading', metadataError: undefined });

      try {
        const response = await fetchMediaMetadata(item.file);
        const baseMetadata: MediaMetadata = item.metadata ?? {
          width: response.width,
          height: response.height,
          sizeBytes: item.size,
        };
        updateFile(nextId, {
          metadata: mergeMetadata(baseMetadata, response),
          metadataStatus: 'done',
          metadataError: undefined,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch media metadata.';
        updateFile(nextId, {
          metadataStatus: 'error',
          metadataError: message,
        });
        toastError(`Failed to fetch metadata for ${item.name}: ${message}`);
      }
    };

    processMetadata().finally(() => {
      setMetadataActiveId(null);
      setMetadataCompletedCount((prev) => prev + 1);
    });
  }, [metadataActiveId, metadataQueue, mediaFiles, updateFile, setMetadataQueue, setMetadataActiveId, setMetadataCompletedCount, toastError, projectId]);

  // Reset completed count when queue is empty
  useEffect(() => {
    if (!metadataActiveId && metadataQueue.length === 0 && metadataCompletedCount > 0) {
      setMetadataCompletedCount(0);
    }
  }, [metadataActiveId, metadataQueue.length, metadataCompletedCount]);

  const metadataTotalCount = metadataCompletedCount + metadataQueue.length + (metadataActiveId ? 1 : 0);
  const metadataProgress = metadataTotalCount > 0 ? (metadataCompletedCount / metadataTotalCount) * 100 : 0;
  const isMetadataQueueActive = metadataTotalCount > 0;

  return {
    enqueueMetadataRequest,
    metadataTotalCount,
    metadataProgress,
    isMetadataQueueActive,
  };
};
