import { useState, useEffect } from 'react';
import type { QueueRequest } from '../types';

interface UseQueueProps {
  handlersRef: React.MutableRefObject<{
    _generateCaption: (id: string, customInstructions?: string) => Promise<void>;
    _checkQuality: (id: string) => Promise<void>;
  }>;
}

export const useQueue = ({ handlersRef }: UseQueueProps) => {
  // These will be managed by the context
  const [isQueueEnabled, setIsQueueEnabled] = useState(false);
  const [localRequestQueue, setLocalRequestQueue] = useState<QueueRequest[]>([]);
  const [isProcessingQueueItem, setIsProcessingQueueItem] = useState(false);
  const [completedQueueCount, setCompletedQueueCount] = useState(0);
  const [rpmLimit, setRpmLimit] = useState(150);
  const [batchSize, setBatchSize] = useState(1);

  const enqueueGenerateRequest = (id: string, customInstructions?: string) => {
    setLocalRequestQueue(prev => [...prev, { type: 'generate', id, customInstructions }]);
  };

  const enqueueQualityRequest = (id: string) => {
    setLocalRequestQueue(prev => [...prev, { type: 'quality', id }]);
  };

  const clearQueue = () => {
    setLocalRequestQueue([]);
    setCompletedQueueCount(0);
  };

  // Effect to process the request queue in concurrent batches
  useEffect(() => {
    if (isQueueEnabled && !isProcessingQueueItem && localRequestQueue.length > 0) {
      setIsProcessingQueueItem(true);

      const batch = localRequestQueue.slice(0, batchSize);

      const processBatch = async () => {
        const promises = batch.map(request => {
          if (request.type === 'generate') {
            return handlersRef.current._generateCaption(request.id, request.customInstructions);
          } else if (request.type === 'quality') {
            return handlersRef.current._checkQuality(request.id);
          }
          return Promise.resolve();
        });
        await Promise.allSettled(promises);
      };

      const delay = rpmLimit > 0 ? Math.ceil((batch.length * 60 * 1000) / rpmLimit) : 1000;

      processBatch().finally(() => {
        // Wait for the calculated delay before processing the next batch
        setTimeout(() => {
          setCompletedQueueCount(prev => prev + batch.length);
          setLocalRequestQueue(prev => prev.slice(batch.length));
          setIsProcessingQueueItem(false);
        }, delay);
      });
    } else if (!isProcessingQueueItem && localRequestQueue.length === 0 && completedQueueCount > 0) {
      // After the queue is empty, reset the completed count for the next run
      setCompletedQueueCount(0);
    }
  }, [isQueueEnabled, isProcessingQueueItem, localRequestQueue, rpmLimit, completedQueueCount, batchSize, handlersRef]);

  const totalQueueItems = completedQueueCount + localRequestQueue.length;
  const queueProgress = totalQueueItems > 0 ? (completedQueueCount / totalQueueItems) * 100 : 0;

  return {
    isQueueEnabled,
    setIsQueueEnabled,
    requestQueue: localRequestQueue,
    setRequestQueue: setLocalRequestQueue,
    isProcessingQueueItem,
    setIsProcessingQueueItem,
    completedQueueCount,
    setCompletedQueueCount,
    rpmLimit,
    setRpmLimit,
    batchSize,
    setBatchSize,
    enqueueGenerateRequest,
    enqueueQualityRequest,
    clearQueue,
    totalQueueItems,
    queueProgress,
  };
};
