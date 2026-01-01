import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { BASE_URL } from '../services/apiConfig';

export type ConnectionState = 'connected' | 'disconnected' | 'checking';

interface HealthCheckResponse {
  status: string;
}

const HEALTH_CHECK_TIMEOUT = 10000; // 10 seconds

export interface ConnectionContextValue {
  connectionState: ConnectionState;
  isConnected: boolean;
  isChecking: boolean;
  isDisconnected: boolean;
  checkConnection: () => Promise<void>;
  setConnected: () => void;
  setDisconnected: () => void;
}

const ConnectionContext = createContext<ConnectionContextValue | null>(null);

export const ConnectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [connectionState, setConnectionState] = useState<ConnectionState>('checking');

  const checkConnection = useCallback(async () => {
    setConnectionState('checking');

    // Validate BASE_URL
    if (!BASE_URL || BASE_URL === 'undefined') {
      setConnectionState('disconnected');
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);

    try {
      const response = await fetch(`${BASE_URL}/healthz`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Health check failed: ${response.statusText}`);
      }

      const data = await response.json() as HealthCheckResponse;

      // Strict validation of response format
      if (data && typeof data.status === 'string' && data.status === 'ok') {
        setConnectionState('connected');
      } else {
        setConnectionState('disconnected');
      }
    } catch (error) {
      setConnectionState('disconnected');
    }
  }, []);

  const setConnected = useCallback(() => {
    setConnectionState('connected');
  }, []);

  const setDisconnected = useCallback(() => {
    setConnectionState('disconnected');
  }, []);

  const isConnected = useMemo(() => connectionState === 'connected', [connectionState]);
  const isChecking = useMemo(() => connectionState === 'checking', [connectionState]);
  const isDisconnected = useMemo(() => connectionState === 'disconnected', [connectionState]);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  const value = useMemo<ConnectionContextValue>(
    () => ({
      connectionState,
      isConnected,
      isChecking,
      isDisconnected,
      checkConnection,
      setConnected,
      setDisconnected,
    }),
    [connectionState, checkConnection, setConnected, setDisconnected]
  );

  return <ConnectionContext.Provider value={value}>{children}</ConnectionContext.Provider>;
};

export const useConnection = () => {
  const context = useContext(ConnectionContext);
  if (!context) {
    throw new Error('useConnection must be used within ConnectionProvider');
  }
  return context;
};
