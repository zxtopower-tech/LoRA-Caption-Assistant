import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { QueueRequest, ProcessingBatch, MediaFile } from '../types';
import { GenerationStatus } from '../types';

export interface QueueContextValue {
  // State
  isQueueEnabled: boolean;
  requestQueue: QueueRequest[];
  isProcessingQueueItem: boolean;
  completedQueueCount: number;
  rpmLimit: number;
  batchSize: number;
  currentBatch: ProcessingBatch | null;

  // Computed
  totalQueueItems: number;
  queueProgress: number;

  // Actions
  setIsQueueEnabled: (enabled: boolean) => void;
  setRpmLimit: (limit: number) => void;
  setBatchSize: (size: number) => void;
  setIsProcessingQueueItem: (processing: boolean) => void;
  setRequestQueue: React.Dispatch<React.SetStateAction<QueueRequest[]>>;
  setCompletedQueueCount: (count: number) => void;
  setCurrentBatch: React.Dispatch<React.SetStateAction<ProcessingBatch | null>>;
  enqueueGenerateRequest: (id: string, customInstructions?: string) => void;
  enqueueQualityRequest: (id: string) => void;
  enqueueSegmentedAnalysisRequest: (id: string) => void;
  clearQueue: (updateFile?: (id: string, updates: Partial<MediaFile>) => void) => void;
  removeQueueItem: (index: number, updateFile?: (id: string, updates: Partial<MediaFile>) => void) => void;
  removeQueueItems: (indices: number[], updateFile?: (id: string, updates: Partial<MediaFile>) => void) => void;
  clearWaitingQueue: (updateFile?: (id: string, updates: Partial<MediaFile>) => void) => void;
  isItemProcessing: (id: string) => boolean;
}

const QueueContext = createContext<QueueContextValue | null>(null);

export const QueueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isQueueEnabled, setIsQueueEnabled] = useState<boolean>(false);
  const [requestQueue, setRequestQueue] = useState<QueueRequest[]>([]);
  const [isProcessingQueueItem, setIsProcessingQueueItem] = useState<boolean>(false);
  const [completedQueueCount, setCompletedQueueCount] = useState<number>(0);
  const [rpmLimit, setRpmLimit] = useState<number>(150);
  const [batchSize, setBatchSize] = useState<number>(1);
  const [currentBatch, setCurrentBatch] = useState<ProcessingBatch | null>(null);

  const enqueueGenerateRequest = useCallback((id: string, customInstructions?: string) => {
    setRequestQueue(prev => [...prev, { type: 'generate', id, customInstructions }]);
  }, []);

  const enqueueQualityRequest = useCallback((id: string) => {
    setRequestQueue(prev => [...prev, { type: 'quality', id }]);
  }, []);

  const enqueueSegmentedAnalysisRequest = useCallback((id: string) => {
    setRequestQueue(prev => [...prev, { type: 'segmentedAnalysis', id }]);
  }, []);

  const isItemProcessing = useCallback((id: string): boolean => {
    return currentBatch?.requestIds.has(id) ?? false;
  }, [currentBatch]);

  const clearQueue = useCallback((updateFile?: (id: string, updates: Partial<MediaFile>) => void) => {
    // Restore waiting items to IDLE
    if (updateFile) {
      requestQueue.forEach(item => {
        if (!isItemProcessing(item.id)) {
          updateFile(item.id, { status: GenerationStatus.IDLE });
        }
      });
    }
    setRequestQueue([]);
    setCompletedQueueCount(0);
  }, [requestQueue, isItemProcessing]);

  const removeQueueItem = useCallback((
    index: number,
    updateFile?: (id: string, updates: Partial<MediaFile>) => void
  ) => {
    setRequestQueue(prev => {
      const itemToRemove = prev[index];
      if (itemToRemove && updateFile) {
        // Restore status if not processing
        if (!isItemProcessing(itemToRemove.id)) {
          updateFile(itemToRemove.id, { status: GenerationStatus.IDLE });
        }
      }
      // Return new array without the item
      return prev.filter((_, i) => i !== index);
    });
  }, [isItemProcessing]);

  const removeQueueItems = useCallback((
    indices: number[],
    updateFile?: (id: string, updates: Partial<MediaFile>) => void
  ) => {
    const indicesSet = new Set(indices);
    setRequestQueue(prev => {
      // Collect items to be removed
      const itemsToRemove = prev.filter((_, i) => indicesSet.has(i));

      // Restore statuses
      if (updateFile) {
        itemsToRemove.forEach(item => {
          if (!isItemProcessing(item.id)) {
            updateFile(item.id, { status: GenerationStatus.IDLE });
          }
        });
      }

      // Return filtered array
      return prev.filter((_, i) => !indicesSet.has(i));
    });
  }, [isItemProcessing]);

  const clearWaitingQueue = useCallback((
    updateFile?: (id: string, updates: Partial<MediaFile>) => void
  ) => {
    setRequestQueue(prev => {
      // Restore all waiting items to IDLE
      if (updateFile) {
        prev.forEach(item => {
          if (!isItemProcessing(item.id)) {
            updateFile(item.id, { status: GenerationStatus.IDLE });
          }
        });
      }
      return [];
    });
    // Note: completedQueueCount is NOT reset
  }, [isItemProcessing]);

  const totalQueueItems = completedQueueCount + requestQueue.length;
  const queueProgress = totalQueueItems > 0 ? (completedQueueCount / totalQueueItems) * 100 : 0;

  const value = useMemo<QueueContextValue>(
    () => ({
      isQueueEnabled,
      requestQueue,
      isProcessingQueueItem,
      completedQueueCount,
      rpmLimit,
      batchSize,
      currentBatch,
      totalQueueItems,
      queueProgress,
      setIsQueueEnabled,
      setRpmLimit,
      setBatchSize,
      setIsProcessingQueueItem,
      setRequestQueue,
      setCompletedQueueCount,
      setCurrentBatch,
      enqueueGenerateRequest,
      enqueueQualityRequest,
      enqueueSegmentedAnalysisRequest,
      clearQueue,
      removeQueueItem,
      removeQueueItems,
      clearWaitingQueue,
      isItemProcessing,
    }),
    [
      isQueueEnabled,
      requestQueue,
      isProcessingQueueItem,
      completedQueueCount,
      rpmLimit,
      batchSize,
      currentBatch,
      totalQueueItems,
      queueProgress,
      enqueueGenerateRequest,
      enqueueQualityRequest,
      enqueueSegmentedAnalysisRequest,
      clearQueue,
      removeQueueItem,
      removeQueueItems,
      clearWaitingQueue,
      isItemProcessing,
    ]
  );

  return <QueueContext.Provider value={value}>{children}</QueueContext.Provider>;
};

export const useQueue = () => {
  const context = useContext(QueueContext);
  if (!context) {
    throw new Error('useQueue must be used within QueueProvider');
  }
  return context;
};
