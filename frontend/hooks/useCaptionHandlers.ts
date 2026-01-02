import { useCallback } from 'react';
import type { MediaFile, SegmentedAnalysisConfig, ConfirmMode } from '../types';
import { GenerationStatus, CONFIRM_MODES } from '../types';
import { useToast } from './useToast';

interface UseCaptionHandlersParams {
  mediaFiles: MediaFile[];
  selectedFiles: MediaFile[];
  bulkGenerationInstructions: string;
  bulkInstructions: string;
  isQueueEnabled: boolean;
  segmentedAnalysisConfig: SegmentedAnalysisConfig;
  _generateCaption: (id: string, customInstructions?: string) => Promise<void>;
  enqueueGenerateRequest: (id: string, customInstructions?: string) => void;
  enqueueSegmentedAnalysisRequest: (id: string) => void;
  showGenerateAllConfirm?: (callback: (mode: ConfirmMode) => void) => void;
}

export const useCaptionHandlers = ({
  mediaFiles,
  selectedFiles,
  bulkGenerationInstructions,
  bulkInstructions,
  isQueueEnabled,
  segmentedAnalysisConfig,
  _generateCaption,
  enqueueGenerateRequest,
  enqueueSegmentedAnalysisRequest,
  showGenerateAllConfirm,
}: UseCaptionHandlersParams) => {
  const { warning: toastWarning } = useToast();

  const queueGenerate = useCallback((id: string, customInstructions?: string) => {
    // Status update removed - let the processor handle it at processing time
    enqueueGenerateRequest(id, customInstructions);
  }, [enqueueGenerateRequest]);

  const handleGenerateCaption = useCallback((id: string, itemCustomInstructions?: string) => {
    // Check if segmented analysis is enabled
    if (segmentedAnalysisConfig.enabled) {
      if (isQueueEnabled) {
        enqueueSegmentedAnalysisRequest(id);
      } else {
        // For direct execution, we'd need to call the segmented analysis hook
        // For now, queue it anyway to maintain consistency
        enqueueSegmentedAnalysisRequest(id);
      }
      return;
    }

    // Merge Bulk Instructions with Item Specific Instructions
    const bulk = bulkGenerationInstructions.trim();
    const item = itemCustomInstructions?.trim() || '';
    let combinedInstructions = item;
    if (bulk) {
        combinedInstructions = item ? `${bulk}\n\n${item}` : bulk;
    }

    if (isQueueEnabled) {
        queueGenerate(id, combinedInstructions);
    } else {
        _generateCaption(id, combinedInstructions);
    }
  }, [segmentedAnalysisConfig.enabled, isQueueEnabled, enqueueSegmentedAnalysisRequest, _generateCaption, bulkGenerationInstructions, queueGenerate]);

  const handleGenerateAll = useCallback((mode?: ConfirmMode) => {
    // If mode is provided, execute directly
    if (mode) {
      let filesToGenerate = mediaFiles.filter(mf =>
        mf.status !== GenerationStatus.GENERATING && mf.status !== GenerationStatus.CHECKING
      );
      if (filesToGenerate.length === 0) return;

      // Skip Existing mode: filter out items with captions
      if (mode === CONFIRM_MODES.SKIP_EXISTING) {
        filesToGenerate = filesToGenerate.filter(mf => !mf.caption.trim());
      }

      // Merge Bulk Instructions with Item Specific Instructions
      const bulk = bulkGenerationInstructions.trim();

      filesToGenerate.forEach(file => {
          const item = file.customInstructions?.trim() || '';
          let combined = item;
          if (bulk) {
              combined = item ? `${bulk}\n\n${item}` : bulk;
          }

          if (isQueueEnabled) {
              queueGenerate(file.id, combined);
          } else {
              _generateCaption(file.id, combined);
          }
      });
      return;
    }

    // No mode provided - check if confirmation is needed
    const hasAnyCaption = mediaFiles.some(mf => mf.caption.trim() !== '');
    if (hasAnyCaption && showGenerateAllConfirm) {
      showGenerateAllConfirm((selectedMode) => {
        handleGenerateAll(selectedMode);
      });
      return;
    }

    // No confirmation needed - proceed with all
    let filesToGenerate = mediaFiles.filter(mf =>
      mf.status !== GenerationStatus.GENERATING && mf.status !== GenerationStatus.CHECKING
    );
    if (filesToGenerate.length === 0) return;

    // Merge Bulk Instructions with Item Specific Instructions
    const bulk = bulkGenerationInstructions.trim();

    filesToGenerate.forEach(file => {
        const item = file.customInstructions?.trim() || '';
        let combined = item;
        if (bulk) {
            combined = item ? `${bulk}\n\n${item}` : bulk;
        }

        if (isQueueEnabled) {
            queueGenerate(file.id, combined);
        } else {
            _generateCaption(file.id, combined);
        }
    });

  }, [mediaFiles, bulkGenerationInstructions, isQueueEnabled, _generateCaption, queueGenerate, showGenerateAllConfirm]);

  const handleGenerateSelected = useCallback(() => {
    const filesToGenerate = selectedFiles.filter(mf => mf.status === GenerationStatus.IDLE || mf.status === GenerationStatus.ERROR);
    if (filesToGenerate.length === 0) {
        toastWarning("Please select items that haven't been generated yet.");
        return;
    }

    // Merge Bulk Instructions with Item Specific Instructions
    const bulk = bulkGenerationInstructions.trim();

    filesToGenerate.forEach(file => {
        const item = file.customInstructions?.trim() || '';
        let combined = item;
        if (bulk) {
            combined = item ? `${bulk}\n\n${item}` : bulk;
        }

        if (isQueueEnabled) {
             queueGenerate(file.id, combined);
        } else {
            _generateCaption(file.id, combined);
        }
    });

  }, [selectedFiles, bulkGenerationInstructions, isQueueEnabled, _generateCaption, queueGenerate, toastWarning]);

  const handleRefineSelected = useCallback(() => {
    if (!bulkInstructions.trim()) {
      toastWarning('Please enter instructions for bulk refinement.');
      return;
    }
    selectedFiles.forEach(file => {
      handleGenerateCaption(file.id, bulkInstructions);
    });
  }, [selectedFiles, bulkInstructions, handleGenerateCaption, toastWarning]);

  return {
    queueGenerate,
    handleGenerateCaption,
    handleGenerateAll,
    handleGenerateSelected,
    handleRefineSelected,
  };
};
