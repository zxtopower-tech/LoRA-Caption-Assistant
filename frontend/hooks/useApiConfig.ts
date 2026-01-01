import { useState, useMemo, useCallback, useEffect } from 'react';
import type { ApiProvider } from '../types';
import { DEFAULT_OPENAI_COMPATIBLE_MODEL } from '../constants';
import { useToast } from './useToast';

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

export const useApiConfig = () => {
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

  return {
    apiProvider,
    setApiProvider,
    envApiKey,
    manualApiKey,
    setManualApiKey,
    isAiStudioKey,
    setIsAiStudioKey,
    openaiCompatibleEndpoint,
    setOpenaiCompatibleEndpoint,
    openaiCompatibleApiKey,
    setOpenaiCompatibleApiKey,
    openaiCompatibleModel,
    setOpenaiCompatibleModel,
    openaiCompatibleVideoFrameCount,
    setOpenaiCompatibleVideoFrameCount,
    isHttps,
    hasValidConfig,
    activeGeminiKey,
    activeOpenAICompatibleModel,
    selectAiStudioKey,
  };
};
