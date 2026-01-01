import { useCallback, useRef, useEffect } from 'react';
import { GenerationStatus } from '../types';
import { generateCaption, checkCaptionQuality } from '../services/geminiService';
import { generateCaptionOpenAICompatible, checkQualityOpenAICompatible } from '../services/openaiCompatibleService';

interface UseCaptionGenerationProps {
  mediaFiles: any[];
  triggerWord: string;
  isCharacterTaggingEnabled: boolean;
  characterShowName: string;
  apiProvider: 'gemini' | 'openaiCompatible';
  activeGeminiKey: string;
  openaiCompatibleApiKey: string;
  openaiCompatibleEndpoint: string;
  activeOpenAICompatibleModel: string;
  hasValidConfig: boolean;
  openaiCompatibleVideoFrameCount: number;
  updateFile: (id: string, updates: Partial<any>) => void;
  onCaptionGenerated?: (id: string, caption: string) => void;
}

export const useCaptionGeneration = ({
  mediaFiles,
  triggerWord,
  isCharacterTaggingEnabled,
  characterShowName,
  apiProvider,
  activeGeminiKey,
  openaiCompatibleApiKey,
  openaiCompatibleEndpoint,
  activeOpenAICompatibleModel,
  hasValidConfig,
  openaiCompatibleVideoFrameCount,
  updateFile,
  onCaptionGenerated,
}: UseCaptionGenerationProps) => {
  const _generateCaption = useCallback(async (id: string, customInstructions?: string) => {
    const fileToProcess = mediaFiles.find(mf => mf.id === id);

    if (!hasValidConfig) {
      updateFile(id, { status: GenerationStatus.ERROR, errorMessage: 'Provider configuration incomplete. Check settings.' });
      return;
    }

    if (!fileToProcess || !triggerWord) {
      if (!triggerWord) {
        updateFile(id, { status: GenerationStatus.ERROR, errorMessage: 'Trigger word cannot be empty.' });
      }
      return;
    }

    updateFile(id, { status: GenerationStatus.GENERATING, errorMessage: undefined, qualityScore: undefined });

    try {
      let caption = '';

      if (apiProvider === 'gemini') {
        if (!activeGeminiKey) throw new Error('Gemini API Key missing');
        caption = await generateCaption(
          activeGeminiKey,
          fileToProcess.file,
          triggerWord,
          customInstructions,
          isCharacterTaggingEnabled,
          characterShowName
        );
      } else if (apiProvider === 'openaiCompatible') {
        const modelToUse = activeOpenAICompatibleModel;
        if (!modelToUse) throw new Error('No model selected');

        caption = await generateCaptionOpenAICompatible(
          openaiCompatibleApiKey,
          openaiCompatibleEndpoint,
          modelToUse,
          fileToProcess.file,
          triggerWord,
          customInstructions,
          isCharacterTaggingEnabled,
          characterShowName,
          openaiCompatibleVideoFrameCount
        );
      }

      updateFile(id, { caption, status: GenerationStatus.SUCCESS, initialCaption: caption });

      // Trigger history save callback
      if (onCaptionGenerated) {
        onCaptionGenerated(id, caption);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      updateFile(id, { status: GenerationStatus.ERROR, errorMessage });
    }
  }, [
    mediaFiles,
    triggerWord,
    isCharacterTaggingEnabled,
    characterShowName,
    apiProvider,
    activeGeminiKey,
    openaiCompatibleApiKey,
    openaiCompatibleEndpoint,
    activeOpenAICompatibleModel,
    hasValidConfig,
    openaiCompatibleVideoFrameCount,
    updateFile,
    onCaptionGenerated,
  ]);

  const _checkQuality = useCallback(async (id: string) => {
    const fileToCheck = mediaFiles.find(mf => mf.id === id);

    if (!hasValidConfig) {
      updateFile(id, { status: GenerationStatus.ERROR, errorMessage: 'Provider configuration incomplete.' });
      return;
    }

    if (!fileToCheck || !fileToCheck.caption.trim()) return;

    updateFile(id, { status: GenerationStatus.CHECKING, errorMessage: undefined });
    try {
      let score = 0;

      if (apiProvider === 'gemini') {
        if (!activeGeminiKey) throw new Error('Gemini API Key missing');
        score = await checkCaptionQuality(activeGeminiKey, fileToCheck.file, fileToCheck.caption);
      } else if (apiProvider === 'openaiCompatible') {
        const modelToUse = activeOpenAICompatibleModel;
        if (!modelToUse) throw new Error('No model selected');

        score = await checkQualityOpenAICompatible(
          openaiCompatibleApiKey,
          openaiCompatibleEndpoint,
          modelToUse,
          fileToCheck.file,
          fileToCheck.caption,
          openaiCompatibleVideoFrameCount
        );
      }

      updateFile(id, { status: GenerationStatus.SUCCESS, qualityScore: score });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred during quality check.';
      updateFile(id, {
        status: GenerationStatus.ERROR,
        errorMessage,
        qualityScore: undefined,
      });
    }
  }, [
    mediaFiles,
    updateFile,
    apiProvider,
    activeGeminiKey,
    openaiCompatibleApiKey,
    openaiCompatibleEndpoint,
    activeOpenAICompatibleModel,
    hasValidConfig,
    openaiCompatibleVideoFrameCount,
  ]);

  // Use a ref to hold the latest handlers to avoid stale closures in the queue processor.
  // The type is made flexible to allow adding _executeSegmentedAnalysis from App.tsx
  const handlersRef = useRef<any>({ _generateCaption, _checkQuality });
  useEffect(() => {
    handlersRef.current = { _generateCaption, _checkQuality };
  }, [_generateCaption, _checkQuality]);

  return {
    _generateCaption,
    _checkQuality,
    handlersRef,
  };
};
