import { useCallback } from 'react';
import { useToast } from './useToast';

export const useApiKeyHandler = (
  envApiKey: string | undefined,
  setIsAiStudioKey: (value: boolean) => void
) => {
  const { info: toastInfo } = useToast();

  const handleSelectKey = useCallback(async () => {
    if (envApiKey) {
      toastInfo("API Key is configured via environment variables.");
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
      const input = document.getElementById('manual-api-key');
      if (input) input.focus();
    }
  }, [envApiKey, setIsAiStudioKey, toastInfo]);

  return { handleSelectKey };
};
