import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import { DEFAULT_BULK_INSTRUCTIONS, DEFAULT_SEGMENTED_ANALYSIS_CONFIG } from '../constants';
import type { SegmentedAnalysisConfig, SegmentStep, PostProcessStep } from '../types';

export interface SettingsContextValue {
  // State
  triggerWord: string;
  datasetPrefix: string;
  isCharacterTaggingEnabled: boolean;
  characterShowName: string;
  bulkGenerationInstructions: string;
  bulkInstructions: string;
  autofitTextareas: boolean;
  segmentedAnalysisConfig: SegmentedAnalysisConfig;
  comfyServerUrl: string;
  comfyWorkflowId: string;
  comfySeed: number;
  comfySteps: number;
  comfyStepsMin: number;
  comfyStepsMax: number;
  comfySeedLow: number;
  comfySeedHigh: number;

  // Actions
  setTriggerWord: (word: string) => void;
  setDatasetPrefix: (prefix: string) => void;
  setIsCharacterTaggingEnabled: (enabled: boolean) => void;
  setCharacterShowName: (name: string) => void;
  setBulkGenerationInstructions: (instructions: string) => void;
  setBulkInstructions: (instructions: string) => void;
  setAutofitTextareas: (enabled: boolean) => void;
  setSegmentedAnalysisConfig: (config: SegmentedAnalysisConfig) => void;
  setSegmentedAnalysisEnabled: (enabled: boolean) => void;
  setSegmentEnabled: (segment: SegmentStep, enabled: boolean) => void;
  setPostProcessingEnabled: (step: PostProcessStep, enabled: boolean) => void;
  setSegmentPrompt: (segment: SegmentStep, systemPrompt: string) => void;
  setSegmentTemperature: (segment: SegmentStep, temperature: number) => void;
  setPostProcessPrompt: (step: PostProcessStep, prompt: string) => void;
  setSegmentExpanded: (segment: SegmentStep, expanded: boolean) => void;
  setPostProcessExpanded: (step: PostProcessStep, expanded: boolean) => void;
  setComfyServerUrl: (url: string) => void;
  setComfyWorkflowId: (id: string) => void;
  setComfySeed: (seed: number) => void;
  setComfySteps: (steps: number) => void;
  setComfyStepsMin: (min: number) => void;
  setComfyStepsMax: (max: number) => void;
  setComfySeedLow: (low: number) => void;
  setComfySeedHigh: (high: number) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [triggerWord, setTriggerWord] = useState<string>('MyStyle');
  const [datasetPrefix, setDatasetPrefix] = useState<string>('item');
  const [isCharacterTaggingEnabled, setIsCharacterTaggingEnabled] = useState<boolean>(false);
  const [characterShowName, setCharacterShowName] = useState<string>('');
  const [bulkGenerationInstructions, setBulkGenerationInstructions] = useState<string>(DEFAULT_BULK_INSTRUCTIONS);
  const [bulkInstructions, setBulkInstructions] = useState<string>('');
  const [autofitTextareas, setAutofitTextareas] = useState<boolean>(false);
  const [segmentedAnalysisConfig, setSegmentedAnalysisConfig] = useState<SegmentedAnalysisConfig>(DEFAULT_SEGMENTED_ANALYSIS_CONFIG);
  const [comfyServerUrl, setComfyServerUrl] = useState<string>('');
  const [comfyWorkflowId, setComfyWorkflowId] = useState<string>('');
  const [comfySeed, setComfySeed] = useState<number>(42);
  const [comfySteps, setComfySteps] = useState<number>(4);
  const [comfyStepsMin, setComfyStepsMin] = useState<number>(3);
  const [comfyStepsMax, setComfyStepsMax] = useState<number>(8);
  const [comfySeedLow, setComfySeedLow] = useState<number>(42);
  const [comfySeedHigh, setComfySeedHigh] = useState<number>(42);

  const setSegmentedAnalysisEnabled = useCallback((enabled: boolean) => {
    setSegmentedAnalysisConfig(prev => ({ ...prev, enabled }));
  }, []);

  const setSegmentEnabled = useCallback((segment: SegmentStep, enabled: boolean) => {
    setSegmentedAnalysisConfig(prev => ({
      ...prev,
      segments: {
        ...prev.segments,
        [segment]: {
          ...prev.segments[segment],
          enabled,
        },
      },
    }));
  }, []);

  const setPostProcessingEnabled = useCallback((step: PostProcessStep, enabled: boolean) => {
    setSegmentedAnalysisConfig(prev => ({
      ...prev,
      postProcessing: {
        ...prev.postProcessing,
        [step]: {
          ...prev.postProcessing[step],
          enabled,
        },
      },
    }));
  }, []);

  const setSegmentPrompt = useCallback((segment: SegmentStep, systemPrompt: string) => {
    setSegmentedAnalysisConfig(prev => ({
      ...prev,
      segments: {
        ...prev.segments,
        [segment]: {
          ...prev.segments[segment],
          systemPrompt,
        },
      },
    }));
  }, []);

  const setSegmentTemperature = useCallback((segment: SegmentStep, temperature: number) => {
    setSegmentedAnalysisConfig(prev => ({
      ...prev,
      segments: {
        ...prev.segments,
        [segment]: {
          ...prev.segments[segment],
          temperature,
        },
      },
    }));
  }, []);

  const setPostProcessPrompt = useCallback((step: PostProcessStep, prompt: string) => {
    setSegmentedAnalysisConfig(prev => ({
      ...prev,
      postProcessing: {
        ...prev.postProcessing,
        [step]: {
          ...prev.postProcessing[step],
          prompt,
        },
      },
    }));
  }, []);

  const setSegmentExpanded = useCallback((segment: SegmentStep, expanded: boolean) => {
    setSegmentedAnalysisConfig(prev => ({
      ...prev,
      segments: {
        ...prev.segments,
        [segment]: {
          ...prev.segments[segment],
          expanded,
        },
      },
    }));
  }, []);

  const setPostProcessExpanded = useCallback((step: PostProcessStep, expanded: boolean) => {
    setSegmentedAnalysisConfig(prev => ({
      ...prev,
      postProcessing: {
        ...prev.postProcessing,
        [step]: {
          ...prev.postProcessing[step],
          expanded,
        },
      },
    }));
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({
      triggerWord,
      datasetPrefix,
      isCharacterTaggingEnabled,
      characterShowName,
      bulkGenerationInstructions,
      bulkInstructions,
      autofitTextareas,
      segmentedAnalysisConfig,
      comfyServerUrl,
      comfyWorkflowId,
      comfySeed,
      comfySteps,
      comfyStepsMin,
      comfyStepsMax,
      comfySeedLow,
      comfySeedHigh,
      setTriggerWord,
      setDatasetPrefix,
      setIsCharacterTaggingEnabled,
      setCharacterShowName,
      setBulkGenerationInstructions,
      setBulkInstructions,
      setAutofitTextareas,
      setSegmentedAnalysisConfig,
      setSegmentedAnalysisEnabled,
      setSegmentEnabled,
      setPostProcessingEnabled,
      setSegmentPrompt,
      setSegmentTemperature,
      setPostProcessPrompt,
      setSegmentExpanded,
      setPostProcessExpanded,
      setComfyServerUrl,
      setComfyWorkflowId,
      setComfySeed,
      setComfySteps,
      setComfyStepsMin,
      setComfyStepsMax,
      setComfySeedLow,
      setComfySeedHigh,
    }),
    [
      triggerWord,
      datasetPrefix,
      isCharacterTaggingEnabled,
      characterShowName,
      bulkGenerationInstructions,
      bulkInstructions,
      autofitTextareas,
      segmentedAnalysisConfig,
      comfyServerUrl,
      comfyWorkflowId,
      comfySeed,
      comfySteps,
      comfyStepsMin,
      comfyStepsMax,
      comfySeedLow,
      comfySeedHigh,
      setSegmentedAnalysisEnabled,
      setSegmentEnabled,
      setPostProcessingEnabled,
      setSegmentPrompt,
      setSegmentTemperature,
      setPostProcessPrompt,
      setSegmentExpanded,
      setPostProcessExpanded,
    ]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
};
