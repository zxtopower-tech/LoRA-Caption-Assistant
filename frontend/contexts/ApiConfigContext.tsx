import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import type { ApiProvider } from '../types';
import { DEFAULT_OPENAI_COMPATIBLE_MODEL } from '../constants';
import { useToast } from '../hooks/useToast';

// FIX: Explicitly declare process to prevent 'Cannot find name process' error during build
declare const process: {
  env: {
    API_KEY?: string;
    [key: string]: string | undefined;
  }
};

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    aistudio?: AIStudio;
  }
}

export interface ApiConfigContextValue {
  // State
  apiProvider: ApiProvider;
  envApiKey: string;
  manualApiKey: string;
  isAiStudioKey: boolean;
  openaiCompatibleEndpoint: string;
  openaiCompatibleApiKey: string;
  openaiCompatibleModel: string;
  openaiCompatibleVideoFrameCount: number;
  isHttps: boolean;

  // Computed
  hasValidConfig: boolean;
  activeGeminiKey: string;
  activeOpenAICompatibleModel: string;

  // Actions
  setApiProvider: (provider: ApiProvider) => void;
  setManualApiKey: (key: string) => void;
  setIsAiStudioKey: (value: boolean) => void;
  setOpenaiCompatibleEndpoint: (endpoint: string) => void;
  setOpenaiCompatibleApiKey: (key: string) => void;
  setOpenaiCompatibleModel: (model: string) => void;
  setOpenaiCompatibleVideoFrameCount: (count: number) => void;
  selectAiStudioKey: () => Promise<void>;
}

const ApiConfigContext = createContext<ApiConfigContextValue | null>(null);

export const ApiConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { info: toastInfo } = useToast();

  // Provider State
  const [apiProvider, setApiProvider] = useState<ApiProvider>('gemini');

  // Gemini State
  const envApiKey = process.env.API_KEY || '';
  const [manualApiKey, setManualApiKey] = useState<string>('');
  const [isAiStudioKey, setIsAiStudioKey] = useState(false);

  // OpenAI Compatible State
  const [openaiCompatibleEndpoint, setOpenaiCompatibleEndpoint] = useState<string>('');
  const [openaiCompatibleApiKey, setOpenaiCompatibleApiKey] = useState<string>('');
  const [openaiCompatibleModel, setOpenaiCompatibleModel] = useState<string>(DEFAULT_OPENAI_COMPATIBLE_MODEL);
  const [openaiCompatibleVideoFrameCount, setOpenaiCompatibleVideoFrameCount] = useState<number>(8);
  const [isHttps, setIsHttps] = useState<boolean>(false);

  // Check protocol on mount
  useEffect(() => {
    const isSecure = window.location.protocol === 'https:';
    setIsHttps(isSecure);

    // Auto-set default endpoint based on protocol
    if (!openaiCompatibleEndpoint) {
      if (isSecure) {
        setOpenaiCompatibleEndpoint(''); // User must provide tunnel URL
      } else {
        setOpenaiCompatibleEndpoint('http://localhost:8000/v1');
      }
    }
  }, []);

  // Check AI Studio key on mount
  useEffect(() => {
    const checkKey = async () => {
      if (envApiKey) return;

      if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
        const keySelected = await window.aistudio.hasSelectedApiKey();
        setIsAiStudioKey(keySelected);
      }
    };
    checkKey();
  }, [envApiKey]);

  const selectAiStudioKey = useCallback(async () => {
    if (envApiKey) {
      toastInfo('API Key is configured via environment variables.');
      return;
    }

    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      try {
        await window.aistudio.openSelectKey();
        setIsAiStudioKey(true);
      } catch (e) {
        // Ignore error
      }
    } else {
      // Focus the manual input if available
      const input = document.getElementById('manual-api-key');
      if (input) input.focus();
    }
  }, [envApiKey, toastInfo]);

  // Computed properties
  const hasValidConfig = useMemo(() => {
    if (apiProvider === 'gemini') {
      if (envApiKey) return true;
      if (manualApiKey) return true;
      if (isAiStudioKey) return true;
      return false;
    }
    if (apiProvider === 'openaiCompatible') {
      return Boolean(openaiCompatibleEndpoint && openaiCompatibleModel.trim());
    }
    return false;
  }, [apiProvider, envApiKey, manualApiKey, isAiStudioKey, openaiCompatibleEndpoint, openaiCompatibleModel]);

  const activeGeminiKey = useMemo(() => {
    if (envApiKey) return envApiKey;
    if (manualApiKey) return manualApiKey;
    return '';
  }, [envApiKey, manualApiKey]);

  const activeOpenAICompatibleModel = openaiCompatibleModel.trim();

  const value = useMemo<ApiConfigContextValue>(
    () => ({
      apiProvider,
      envApiKey,
      manualApiKey,
      isAiStudioKey,
      openaiCompatibleEndpoint,
      openaiCompatibleApiKey,
      openaiCompatibleModel,
      openaiCompatibleVideoFrameCount,
      isHttps,
      hasValidConfig,
      activeGeminiKey,
      activeOpenAICompatibleModel,
      setApiProvider,
      setManualApiKey,
      setIsAiStudioKey,
      setOpenaiCompatibleEndpoint,
      setOpenaiCompatibleApiKey,
      setOpenaiCompatibleModel,
      setOpenaiCompatibleVideoFrameCount,
      selectAiStudioKey,
    }),
    [
      apiProvider,
      envApiKey,
      manualApiKey,
      isAiStudioKey,
      openaiCompatibleEndpoint,
      openaiCompatibleApiKey,
      openaiCompatibleModel,
      openaiCompatibleVideoFrameCount,
      isHttps,
      hasValidConfig,
      activeGeminiKey,
      activeOpenAICompatibleModel,
      selectAiStudioKey,
    ]
  );

  return <ApiConfigContext.Provider value={value}>{children}</ApiConfigContext.Provider>;
};

export const useApiConfig = () => {
  const context = useContext(ApiConfigContext);
  if (!context) {
    throw new Error('useApiConfig must be used within ApiConfigProvider');
  }
  return context;
};
