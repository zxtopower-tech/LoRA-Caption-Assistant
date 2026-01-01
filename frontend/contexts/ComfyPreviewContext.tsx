import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { getWorkflow } from '../services/workflowService';
import { findNodesByMetaTitle } from '../lib/workflowNodeParser';

export type ComfyWorkflowMode = 'single' | 'multi_steps' | 'full_multi';

export interface ComfyPreviewContextValue {
  // Workflow mode
  workflowMode: ComfyWorkflowMode;
  detectWorkflowMode: () => Promise<void>;

  // Current parameters (from settings)
  seed: number;
  setSeed: (seed: number) => void;
  steps: number;
  setSteps: (steps: number) => void;
  stepsMin: number;
  setStepsMin: (min: number) => void;
  stepsMax: number;
  setStepsMax: (max: number) => void;
  seedLow: number;
  setSeedLow: (low: number) => void;
  seedHigh: number;
  setSeedHigh: (high: number) => void;

  // Workflow ID for mode detection
  workflowId: string;
  setWorkflowId: (id: string) => void;

  // Get current parameters based on mode (for modal initialization)
  getCurrentParams: () => {
    seed: number;
    steps: number;
    stepsMin: number;
    stepsMax: number;
    seedLow: number;
    seedHigh: number;
  };
}

const ComfyPreviewContext = createContext<ComfyPreviewContextValue | undefined>(undefined);

export const useComfyPreview = () => {
  const context = useContext(ComfyPreviewContext);
  if (!context) {
    throw new Error('useComfyPreview must be used within ComfyPreviewProvider');
  }
  return context;
};

interface ComfyPreviewProviderProps {
  children: React.ReactNode;
  // Initial values from settings
  initialSeed: number;
  initialSteps: number;
  initialStepsMin?: number;
  initialStepsMax?: number;
  initialSeedLow?: number;
  initialSeedHigh?: number;
  initialWorkflowId: string;
  // Callbacks to update settings
  onSeedChange: (seed: number) => void;
  onStepsChange: (steps: number) => void;
  onStepsMinChange?: (min: number) => void;
  onStepsMaxChange?: (max: number) => void;
  onSeedLowChange?: (low: number) => void;
  onSeedHighChange?: (high: number) => void;
  onWorkflowIdChange: (id: string) => void;
}

export const ComfyPreviewProvider: React.FC<ComfyPreviewProviderProps> = ({
  children,
  initialSeed,
  initialSteps,
  initialStepsMin = 3,
  initialStepsMax = 8,
  initialSeedLow = 42,
  initialSeedHigh = 42,
  initialWorkflowId,
  onSeedChange,
  onStepsChange,
  onStepsMinChange,
  onStepsMaxChange,
  onSeedLowChange,
  onSeedHighChange,
  onWorkflowIdChange,
}) => {
  const [workflowMode, setWorkflowMode] = useState<ComfyWorkflowMode>('single');
  const [workflowId, setWorkflowId] = useState(initialWorkflowId);

  // Sync workflowId with initial value
  useEffect(() => {
    if (initialWorkflowId !== workflowId) {
      setWorkflowId(initialWorkflowId);
    }
  }, [initialWorkflowId]);

  const handleWorkflowIdChange = useCallback((id: string) => {
    setWorkflowId(id);
    onWorkflowIdChange(id);
  }, [onWorkflowIdChange]);

  // Detect workflow mode based on workflow file
  const detectWorkflowMode = useCallback(async () => {
    if (!workflowId) {
      setWorkflowMode('single');
      return;
    }

    try {
      const workflowJson = await getWorkflow(workflowId);
      const stepsMinNodes = findNodesByMetaTitle(workflowJson as any, 'steps_min');
      const stepsMaxNodes = findNodesByMetaTitle(workflowJson as any, 'steps_max');
      const ksamplerLowNodes = findNodesByMetaTitle(workflowJson as any, 'KSampler Low');
      const ksamplerHighNodes = findNodesByMetaTitle(workflowJson as any, 'KSampler High');

      const hasStepsRange = stepsMinNodes.length > 0 && stepsMaxNodes.length > 0;
      const hasKSamplerPair = ksamplerLowNodes.length > 0 && ksamplerHighNodes.length > 0;

      if (hasStepsRange && hasKSamplerPair) {
        setWorkflowMode('full_multi');
      } else if (hasStepsRange) {
        setWorkflowMode('multi_steps');
      } else {
        setWorkflowMode('single');
      }
    } catch (err) {
      setWorkflowMode('single');
    }
  }, [workflowId]);

  // Detect mode when workflowId changes
  useEffect(() => {
    detectWorkflowMode();
  }, [detectWorkflowMode]);

  // Keep track of initial values to sync with settings
  const initialValuesRef = useRef({
    seed: initialSeed,
    steps: initialSteps,
    stepsMin: initialStepsMin,
    stepsMax: initialStepsMax,
    seedLow: initialSeedLow,
    seedHigh: initialSeedHigh,
  });

  // Update ref when initial values change
  useEffect(() => {
    initialValuesRef.current = {
      seed: initialSeed,
      steps: initialSteps,
      stepsMin: initialStepsMin ?? 3,
      stepsMax: initialStepsMax ?? 8,
      seedLow: initialSeedLow ?? 42,
      seedHigh: initialSeedHigh ?? 42,
    };
  }, [initialSeed, initialSteps, initialStepsMin, initialStepsMax, initialSeedLow, initialSeedHigh]);

  // Get current parameters based on workflow mode
  const getCurrentParams = useCallback(() => {
    return {
      seed: initialValuesRef.current.seed,
      steps: initialValuesRef.current.steps,
      stepsMin: initialValuesRef.current.stepsMin,
      stepsMax: initialValuesRef.current.stepsMax,
      seedLow: initialValuesRef.current.seedLow,
      seedHigh: initialValuesRef.current.seedHigh,
    };
  }, []);

  const value: ComfyPreviewContextValue = {
    workflowMode,
    detectWorkflowMode,
    seed: initialSeed,
    setSeed: onSeedChange,
    steps: initialSteps,
    setSteps: onStepsChange,
    stepsMin: initialStepsMin ?? 3,
    setStepsMin: onStepsMinChange || (() => {}),
    stepsMax: initialStepsMax ?? 8,
    setStepsMax: onStepsMaxChange || (() => {}),
    seedLow: initialSeedLow ?? 42,
    setSeedLow: onSeedLowChange || (() => {}),
    seedHigh: initialSeedHigh ?? 42,
    setSeedHigh: onSeedHighChange || (() => {}),
    workflowId,
    setWorkflowId: handleWorkflowIdChange,
    getCurrentParams,
  };

  return (
    <ComfyPreviewContext.Provider value={value}>
      {children}
    </ComfyPreviewContext.Provider>
  );
};
