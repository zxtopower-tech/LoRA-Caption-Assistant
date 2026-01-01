import { useCallback, useMemo } from 'react';
import type { MediaFile } from '../types';

export interface UseComfyHandlersParams {
  mediaFiles: MediaFile[];
  showPreviewConfirm: (existingCount: number, totalCount: number) => void;
  handleComfyPreview: (id: string, caption?: string, params?: import('../types').ComfyPreviewParams) => void;
}

export interface UseComfyHandlersReturn {
  handlePreviewAll: (regenerateAll?: boolean) => void;
  comfyGeneratingItems: number;
  comfyCompletedItems: number;
  comfyTotalRequested: number;
  isComfyProcessing: boolean;
  comfyProgress: number;
}

export const useComfyHandlers = ({
  mediaFiles,
  showPreviewConfirm,
  handleComfyPreview,
}: UseComfyHandlersParams): UseComfyHandlersReturn => {
  const handlePreviewAll = useCallback(
    (regenerateAll?: boolean) => {
      const itemsWithCaption = mediaFiles.filter((f) => f.caption.trim());

      if (regenerateAll === true) {
        itemsWithCaption.forEach((item) => {
          handleComfyPreview(item.id);
        });
      } else if (regenerateAll === false) {
        const itemsWithoutPreview = itemsWithCaption.filter((f) => !f.previewFile);
        itemsWithoutPreview.forEach((item) => {
          handleComfyPreview(item.id);
        });
      } else {
        const itemsWithPreview = itemsWithCaption.filter((f) => f.previewFile);
        if (itemsWithPreview.length > 0) {
          showPreviewConfirm(itemsWithPreview.length, itemsWithCaption.length);
        } else {
          itemsWithCaption.forEach((item) => {
            handleComfyPreview(item.id);
          });
        }
      }
    },
    [mediaFiles, handleComfyPreview, showPreviewConfirm]
  );

  const comfyStats = useMemo(() => {
    const generatingItems = mediaFiles.filter(
      (f) => f.comfyPreviewStatus === 'generating'
    ).length;
    const completedItems = mediaFiles.filter(
      (f) => f.comfyPreviewStatus === 'completed'
    ).length;
    const totalRequested = mediaFiles.filter(
      (f) =>
        f.comfyPreviewStatus === 'generating' ||
        f.comfyPreviewStatus === 'completed' ||
        f.comfyPreviewStatus === 'pending'
    ).length;
    const isProcessing = generatingItems > 0;
    const progress = totalRequested > 0 ? (completedItems / totalRequested) * 100 : 0;

    return {
      generatingItems,
      completedItems,
      totalRequested,
      isProcessing,
      progress,
    };
  }, [mediaFiles]);

  return {
    handlePreviewAll,
    comfyGeneratingItems: comfyStats.generatingItems,
    comfyCompletedItems: comfyStats.completedItems,
    comfyTotalRequested: comfyStats.totalRequested,
    isComfyProcessing: comfyStats.isProcessing,
    comfyProgress: comfyStats.progress,
  };
};
