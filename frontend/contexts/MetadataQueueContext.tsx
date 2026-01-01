import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

export interface MetadataQueueContextValue {
  // State
  metadataQueue: string[];
  metadataActiveId: string | null;
  metadataCompletedCount: number;

  // Computed
  metadataTotalCount: number;
  metadataProgress: number;
  isMetadataQueueActive: boolean;

  // Actions
  setMetadataQueue: React.Dispatch<React.SetStateAction<string[]>>;
  setMetadataActiveId: (id: string | null) => void;
  setMetadataCompletedCount: (count: number) => void;
  enqueueMetadataRequest: (id: string) => void;
}

const MetadataQueueContext = createContext<MetadataQueueContextValue | null>(null);

export const MetadataQueueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [metadataQueue, setMetadataQueue] = useState<string[]>([]);
  const [metadataActiveId, setMetadataActiveId] = useState<string | null>(null);
  const [metadataCompletedCount, setMetadataCompletedCount] = useState<number>(0);

  const enqueueMetadataRequest = useCallback((id: string) => {
    setMetadataQueue(prev => [...prev, id]);
  }, []);

  const metadataTotalCount = metadataCompletedCount + metadataQueue.length + (metadataActiveId ? 1 : 0);
  const metadataProgress = metadataTotalCount > 0 ? (metadataCompletedCount / metadataTotalCount) * 100 : 0;
  const isMetadataQueueActive = metadataTotalCount > 0;

  const value = useMemo<MetadataQueueContextValue>(
    () => ({
      metadataQueue,
      metadataActiveId,
      metadataCompletedCount,
      metadataTotalCount,
      metadataProgress,
      isMetadataQueueActive,
      setMetadataQueue,
      setMetadataActiveId,
      setMetadataCompletedCount,
      enqueueMetadataRequest,
    }),
    [
      metadataQueue,
      metadataActiveId,
      metadataCompletedCount,
      metadataTotalCount,
      metadataProgress,
      isMetadataQueueActive,
      enqueueMetadataRequest,
    ]
  );

  return <MetadataQueueContext.Provider value={value}>{children}</MetadataQueueContext.Provider>;
};

export const useMetadataQueue = () => {
  const context = useContext(MetadataQueueContext);
  if (!context) {
    throw new Error('useMetadataQueue must be used within MetadataQueueProvider');
  }
  return context;
};
