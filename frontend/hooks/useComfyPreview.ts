import { useCallback, useEffect, useRef } from 'react';
import type { MediaFile, ComfyPreviewParams } from '../types';
import { useToast } from './useToast';
import { getWorkflow } from '../services/workflowService';
import {
  findNodesByMetaTitle,
  updateNodesByMetaTitle,
  updateTextInWorkflow,
  updateSeedInWorkflow,
  updateStepsInWorkflow,
  updateDimensionsInWorkflow,
} from '../lib/workflowNodeParser';
import {
  submitComfyWorkflow,
  generateRandomSeed,
  getComfyHistory,
  downloadComfyImage,
} from '../services/comfyService';
import { saveComfyPreview } from '../services/projectService';

interface UseComfyPreviewParams {
  comfyServerUrl: string;
  comfyWorkflowId: string;
  comfySeed: number;
  comfySteps: number;
  comfyStepsMin?: number;
  comfyStepsMax?: number;
  comfySeedLow?: number;
  comfySeedHigh?: number;
  updateFile: (id: string, updates: Partial<MediaFile>) => void;
  projectId: string | null | undefined;
}

export const useComfyPreview = ({
  comfyServerUrl,
  comfyWorkflowId,
  comfySeed,
  comfySteps,
  comfyStepsMin,
  comfyStepsMax,
  comfySeedLow,
  comfySeedHigh,
  updateFile,
  projectId,
}: UseComfyPreviewParams) => {
  const { error: toastError } = useToast();

  // Use ref for projectId to avoid stale closures in timeouts
  const projectIdRef = useRef(projectId);
  useEffect(() => {
    projectIdRef.current = projectId;
  }, [projectId]);

  const pollingIntervalsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const globalTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const activePollingCountRef = useRef<number>(0);

  // Global timeout: 30 minutes since last completion
  const GLOBAL_TIMEOUT_MS = 30 * 60 * 1000;

  // Reset global timeout
  const resetGlobalTimeout = useCallback(() => {
    if (globalTimeoutRef.current) {
      clearTimeout(globalTimeoutRef.current);
    }
    globalTimeoutRef.current = setTimeout(() => {
      // Cancel all polling
      pollingIntervalsRef.current.forEach((interval) => {
        clearInterval(interval);
      });
      pollingIntervalsRef.current.clear();
      activePollingCountRef.current = 0;
    }, GLOBAL_TIMEOUT_MS);
  }, []);

  /**
   * Start ComfyUI Preview generation
   */
  const startPreview = useCallback(
    async (mediaItem: MediaFile, caption: string, params?: ComfyPreviewParams) => {
      const id = mediaItem.id;

      // ===== 1. Parameter Validation =====
      if (!comfyServerUrl || !comfyWorkflowId) {
        const errorMsg = 'ComfyUI not configured. Please set server URL and workflow.';
        updateFile(id, {
          comfyPreviewStatus: 'error',
          comfyPreviewError: errorMsg,
        });
        toastError(errorMsg);
        return;
      }

      if (!caption || caption.trim() === '') {
        const errorMsg = 'Caption is required for preview generation.';
        updateFile(id, {
          comfyPreviewStatus: 'error',
          comfyPreviewError: errorMsg,
        });
        toastError(errorMsg);
        return;
      }

      try {
        // Update status to generating
        updateFile(id, { comfyPreviewStatus: 'generating', comfyPreviewError: undefined });

        // ===== 2. Parameter Preparation =====

        // Use provided params if available, otherwise use values from hook
        const effectiveSeed = params?.seed ?? comfySeed;
        const effectiveSteps = params?.steps ?? comfySteps;
        const effectiveStepsMin = params?.stepsMin ?? comfyStepsMin;
        const effectiveStepsMax = params?.stepsMax ?? comfyStepsMax;
        const effectiveSeedLow = params?.seedLow ?? comfySeedLow;
        const effectiveSeedHigh = params?.seedHigh ?? comfySeedHigh;

        // Generate seed (if -1, generate random)
        const actualSeed = effectiveSeed === -1 ? generateRandomSeed() : effectiveSeed;
        const actualSeedLow = effectiveSeedLow === -1 ? generateRandomSeed() : effectiveSeedLow;
        const actualSeedHigh = effectiveSeedHigh === -1 ? generateRandomSeed() : effectiveSeedHigh;

        // Load workflow
        let workflowJson = await getWorkflow(comfyWorkflowId);

        // Detect mode
        const stepsMinNodes = findNodesByMetaTitle(workflowJson as any, 'steps_min');
        const stepsMaxNodes = findNodesByMetaTitle(workflowJson as any, 'steps_max');
        const ksamplerLowNodes = findNodesByMetaTitle(workflowJson as any, 'KSampler Low');
        const ksamplerHighNodes = findNodesByMetaTitle(workflowJson as any, 'KSampler High');

        const hasStepsRange = stepsMinNodes.length > 0 && stepsMaxNodes.length > 0;
        const hasKSamplerPair = ksamplerLowNodes.length > 0 && ksamplerHighNodes.length > 0;

        // ===== 3. Apply Parameters =====

        // Apply text (caption) - common to all modes
        workflowJson = updateTextInWorkflow(workflowJson as any, caption);

        // Apply dimensions - common to all modes
        const width = mediaItem.metadata?.width ?? 1024;
        const height = mediaItem.metadata?.height ?? 1024;
        workflowJson = updateDimensionsInWorkflow(workflowJson as any, width, height);

        // Apply mode-specific seed/steps
        if (hasStepsRange && hasKSamplerPair && effectiveSeedLow !== undefined && effectiveSeedHigh !== undefined) {
          // Full multi mode
          workflowJson = updateNodesByMetaTitle(workflowJson as any, 'KSampler Low', 'noise_seed', actualSeedLow);
          workflowJson = updateNodesByMetaTitle(workflowJson as any, 'KSampler High', 'noise_seed', actualSeedHigh);
          workflowJson = updateNodesByMetaTitle(workflowJson as any, 'steps_min', 'int', effectiveStepsMin ?? 3);
          workflowJson = updateNodesByMetaTitle(workflowJson as any, 'steps_max', 'int', effectiveStepsMax ?? 8);
        } else if (hasStepsRange && effectiveStepsMin !== undefined && effectiveStepsMax !== undefined) {
          // Multi steps mode
          workflowJson = updateNodesByMetaTitle(workflowJson as any, 'steps_min', 'int', effectiveStepsMin);
          workflowJson = updateNodesByMetaTitle(workflowJson as any, 'steps_max', 'int', effectiveStepsMax);
          // Apply single seed (if no KSampler, find and replace seed/noise_seed globally)
          workflowJson = updateSeedInWorkflow(workflowJson as any, actualSeed);
        } else {
          // Single mode
          workflowJson = updateSeedInWorkflow(workflowJson as any, actualSeed);
          workflowJson = updateStepsInWorkflow(workflowJson as any, effectiveSteps);
        }

        // ===== 4. API Call =====
        const promptId = await submitComfyWorkflow(
          { baseUrl: comfyServerUrl },
          workflowJson,
        );

        // Store promptId and status - don't set previewResult during generation
        updateFile(id, {
          comfyPreviewStatus: 'generating',
          comfyPreviewError: undefined,
          comfyGeneratingPromptId: promptId,  // New field: track generating promptId
        });

        // Start global timeout on first request
        if (activePollingCountRef.current === 0) {
          resetGlobalTimeout();
        }

        // Start polling for completion
        pollForCompletion(id, promptId, mediaItem);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to start preview';
        updateFile(id, {
          comfyPreviewStatus: 'error',
          comfyPreviewError: errorMsg,
        });
        toastError(`Failed to generate ComfyUI preview: ${errorMsg}`);
      }
    },
    [comfyServerUrl, comfyWorkflowId, comfySeed, comfySteps, comfyStepsMin, comfyStepsMax, comfySeedLow, comfySeedHigh, updateFile, resetGlobalTimeout, toastError],
  );

  /**
   * Poll for ComfyUI job completion
   */
  const pollForCompletion = useCallback(
    (id: string, promptId: string, mediaItem: MediaFile) => {
      // Clear any existing polling for this item
      const existingInterval = pollingIntervalsRef.current.get(id);
      if (existingInterval) {
        clearInterval(existingInterval);
      } else {
        // New polling started, increment count
        activePollingCountRef.current += 1;
      }

      const interval = setInterval(async () => {
        try {
          const history = await getComfyHistory({ baseUrl: comfyServerUrl }, promptId);

          if (!history) {
            // Still processing, continue polling
            return;
          }

          // Job completed - check for outputs
          if (history.outputs) {
            // Find the first output with images
            for (const nodeId of Object.keys(history.outputs)) {
              const output = history.outputs[nodeId];
              if (output.images && output.images.length > 0) {
                const imageData = output.images[0];

                // Download the image
                const blob = await downloadComfyImage(
                  { baseUrl: comfyServerUrl },
                  imageData.filename,
                  imageData.subfolder || '',
                  imageData.type || 'output',
                );

                // Convert Blob to File object
                const file = new File([blob], imageData.filename, { type: blob.type });

                // Save to server (async, non-blocking)
                const currentProjectId = projectIdRef.current;
                if (currentProjectId) {
                  saveComfyPreview(currentProjectId, file, mediaItem.name)
                    .catch(error => {
                      // Continue - preview will still be displayed
                    });
                } else {
                  // No projectId available, skipping server save
                }

                // Update file with completed status and previewFile
                updateFile(id, {
                  comfyPreviewStatus: 'completed',
                  previewFile: file,
                });

                // Clear polling
                clearInterval(interval);
                pollingIntervalsRef.current.delete(id);
                activePollingCountRef.current -= 1;

                // Reset global timeout on completion
                resetGlobalTimeout();
                return;
              }
            }
          }

          // No images found - might be an error
          clearInterval(interval);
          pollingIntervalsRef.current.delete(id);
          activePollingCountRef.current -= 1;

          // Reset global timeout on error (item is done)
          resetGlobalTimeout();
          const errorMsg = 'No images generated by ComfyUI';
          updateFile(id, {
            comfyPreviewStatus: 'error',
            comfyPreviewError: errorMsg,
          });
          toastError(`ComfyUI preview failed: ${errorMsg}`);
        } catch (error) {
          clearInterval(interval);
          pollingIntervalsRef.current.delete(id);
          activePollingCountRef.current -= 1;

          // Reset global timeout on error (item is done)
          resetGlobalTimeout();
          const errorMsg = error instanceof Error ? error.message : 'Failed to check preview status';
          updateFile(id, {
            comfyPreviewStatus: 'error',
            comfyPreviewError: errorMsg,
          });
          toastError(`Failed to check ComfyUI preview: ${errorMsg}`);
        }
      }, 2000); // Poll every 2 seconds

      pollingIntervalsRef.current.set(id, interval);
    },
    [comfyServerUrl, updateFile, resetGlobalTimeout, toastError],
  );

  /**
   * Cancel preview generation for a specific item
   */
  const cancelPreview = useCallback((id: string) => {
    const interval = pollingIntervalsRef.current.get(id);
    if (interval) {
      clearInterval(interval);
      pollingIntervalsRef.current.delete(id);
      activePollingCountRef.current -= 1;

      // Reset global timeout when item is cancelled
      if (activePollingCountRef.current === 0) {
        if (globalTimeoutRef.current) {
          clearTimeout(globalTimeoutRef.current);
          globalTimeoutRef.current = null;
        }
      }
    }

    updateFile(id, {
      comfyPreviewStatus: 'idle',
      previewFile: undefined,
    });
  }, [updateFile]);

  /**
   * Cleanup all polling intervals
   */
  const cleanup = useCallback(() => {
    // Clear all polling intervals
    pollingIntervalsRef.current.forEach((interval) => {
      clearInterval(interval);
    });
    pollingIntervalsRef.current.clear();

    // Clear global timeout
    if (globalTimeoutRef.current) {
      clearTimeout(globalTimeoutRef.current);
      globalTimeoutRef.current = null;
    }
    activePollingCountRef.current = 0;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    startPreview,
    cancelPreview,
    cleanup,
  };
};
