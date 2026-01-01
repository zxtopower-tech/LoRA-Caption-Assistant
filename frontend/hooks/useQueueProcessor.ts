import { useEffect } from 'react';
import { QueueRequest, ProcessingBatch } from '../types';

interface HandlersRef {
  current: {
    _generateCaption: (id: string, customInstructions?: string) => Promise<void>;
    _checkQuality: (id: string) => Promise<void>;
    _executeSegmentedAnalysis?: (id: string) => Promise<void>;
  };
}

interface UseQueueProcessorProps {
  isQueueEnabled: boolean;
  isProcessingQueueItem: boolean;
  requestQueue: QueueRequest[];
  rpmLimit: number;
  completedQueueCount: number;
  batchSize: number;
  setIsProcessingQueueItem: (value: boolean) => void;
  setCompletedQueueCount: (value: number) => void;
  setRequestQueue: (value: QueueRequest[] | ((prev: QueueRequest[]) => QueueRequest[])) => void;
  currentBatch: ProcessingBatch | null;
  setCurrentBatch: React.Dispatch<React.SetStateAction<ProcessingBatch | null>>;
  handlersRef: HandlersRef;
}

export const useQueueProcessor = ({
  isQueueEnabled,
  isProcessingQueueItem,
  requestQueue,
  rpmLimit,
  completedQueueCount,
  batchSize,
  setIsProcessingQueueItem,
  setCompletedQueueCount,
  setRequestQueue,
  currentBatch,
  setCurrentBatch,
  handlersRef,
}: UseQueueProcessorProps) => {
  useEffect(() => {
    if (isQueueEnabled && !isProcessingQueueItem && requestQueue.length > 0) {
      setIsProcessingQueueItem(true);

      const batch = requestQueue.slice(0, batchSize);

      // Set current batch before processing
      const processingBatch: ProcessingBatch = {
        requests: batch,
        startedAt: Date.now(),
        requestIds: new Set(batch.map(r => r.id)),
      };
      setCurrentBatch(processingBatch);

      const processBatch = async () => {
        const promises = batch.map(request => {
          if (request.type === 'generate') {
            return handlersRef.current._generateCaption(request.id, request.customInstructions);
          } else if (request.type === 'quality') {
            return handlersRef.current._checkQuality(request.id);
          } else if (request.type === 'segmentedAnalysis') {
            return handlersRef.current._executeSegmentedAnalysis?.(request.id);
          }
          return Promise.resolve();
        });
        await Promise.allSettled(promises);
      };

      const delay = rpmLimit > 0 ? Math.ceil((batch.length * 60 * 1000) / rpmLimit) : 1000;

      processBatch().finally(() => {
        setTimeout(() => {
          setCompletedQueueCount(completedQueueCount + batch.length);
          setRequestQueue(prev => prev.slice(batch.length));
          // Clear current batch after completion
          setCurrentBatch(null);
          setIsProcessingQueueItem(false);
        }, delay);
      });
    } else if (!isProcessingQueueItem && requestQueue.length === 0 && completedQueueCount > 0) {
      setCompletedQueueCount(0);
    }
  }, [
    isQueueEnabled,
    isProcessingQueueItem,
    requestQueue,
    rpmLimit,
    completedQueueCount,
    batchSize,
    setIsProcessingQueueItem,
    setCompletedQueueCount,
    setRequestQueue,
    currentBatch,
    setCurrentBatch,
    handlersRef,
  ]);
};
