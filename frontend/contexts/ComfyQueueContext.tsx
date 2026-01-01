import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { ComfyQueueStatus } from '../types';
import { getComfyQueueStatus, clearComfyQueue } from '../services/comfyService';

export interface ComfyQueueContextValue {
  // State
  isEnabled: boolean;
  serverUrl: string;
  queueStatus: ComfyQueueStatus | null;
  isLoadingQueue: boolean;
  pollingInterval: number;

  // Computed
  isQueueActive: boolean;

  // Actions
  setIsEnabled: (enabled: boolean) => void;
  setServerUrl: (url: string) => void;
  setPollingInterval: (interval: number) => void;
  refreshQueueStatus: () => Promise<void>;
  clearQueue: () => Promise<void>;
}

const ComfyQueueContext = createContext<ComfyQueueContextValue | null>(null);

export const ComfyQueueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isEnabled, setIsEnabled] = useState<boolean>(false);
  const [serverUrl, setServerUrl] = useState<string>('');
  const [queueStatus, setQueueStatus] = useState<ComfyQueueStatus | null>(null);
  const [isLoadingQueue, setIsLoadingQueue] = useState<boolean>(false);
  const [pollingInterval, setPollingInterval] = useState<number>(2000); // 2 seconds default

  // Use ref to track the latest polling interval without triggering re-renders
  const pollingIntervalRef = useRef<number>(pollingInterval);
  useEffect(() => {
    pollingIntervalRef.current = pollingInterval;
  }, [pollingInterval]);

  const refreshQueueStatus = useCallback(async () => {
    if (!isEnabled || !serverUrl) {
      setQueueStatus(null);
      return;
    }

    setIsLoadingQueue(true);
    try {
      const status = await getComfyQueueStatus({ baseUrl: serverUrl });
      setQueueStatus(status);
    } catch (error) {
      console.error('Failed to fetch ComfyUI queue status:', error);
      // Clear status on error to show inactive state
      setQueueStatus(null);
    } finally {
      setIsLoadingQueue(false);
    }
  }, [isEnabled, serverUrl]);

  const clearQueue = useCallback(async () => {
    if (!isEnabled || !serverUrl) {
      return;
    }

    try {
      await clearComfyQueue({ baseUrl: serverUrl });
      // Refresh status after clearing
      await refreshQueueStatus();
    } catch (error) {
      console.error('Failed to clear ComfyUI queue:', error);
      throw error;
    }
  }, [isEnabled, serverUrl, refreshQueueStatus]);

  const isQueueActive = useMemo(() => {
    if (!queueStatus) return false;
    return queueStatus.queue_running.length > 0 || queueStatus.queue_pending.length > 0;
  }, [queueStatus]);

  // Set up polling only when queue is active
  useEffect(() => {
    if (!isEnabled || !serverUrl) {
      setQueueStatus(null);
      return;
    }

    // Only poll if queue is active
    if (!isQueueActive) {
      return;
    }

    // Initial fetch when queue becomes active
    refreshQueueStatus();

    // Set up polling interval
    const intervalId = setInterval(() => {
      refreshQueueStatus();
    }, pollingIntervalRef.current);

    return () => {
      clearInterval(intervalId);
    };
  }, [isEnabled, serverUrl, isQueueActive, refreshQueueStatus]);

  const value = useMemo<ComfyQueueContextValue>(
    () => ({
      isEnabled,
      serverUrl,
      queueStatus,
      isLoadingQueue,
      pollingInterval,
      isQueueActive,
      setIsEnabled,
      setServerUrl,
      setPollingInterval,
      refreshQueueStatus,
      clearQueue,
    }),
    [
      isEnabled,
      serverUrl,
      queueStatus,
      isLoadingQueue,
      pollingInterval,
      isQueueActive,
      refreshQueueStatus,
      clearQueue,
    ]
  );

  return <ComfyQueueContext.Provider value={value}>{children}</ComfyQueueContext.Provider>;
};

export const useComfyQueue = () => {
  const context = useContext(ComfyQueueContext);
  if (!context) {
    throw new Error('useComfyQueue must be used within ComfyQueueProvider');
  }
  return context;
};
