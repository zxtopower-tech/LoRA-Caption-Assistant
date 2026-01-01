import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { loadProfile, saveProfile } from '../services/profileService';
import { DEFAULT_SEGMENTED_ANALYSIS_CONFIG } from '../constants';
import { getBackendUrl } from '../services/apiConfig';
import type { ProfileFile, ProfileGlobalSettings, SegmentedAnalysisConfig, SegmentStep, PostProcessStep } from '../types';
import { useToast } from './useToast';

const PROFILE_SCHEMA_VERSION = 1;
const PROFILE_NAME_FALLBACK = 'Default';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getString = (value: unknown): string | null =>
  typeof value === 'string' ? value : null;

const getNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const getBoolean = (value: unknown): boolean | null =>
  typeof value === 'boolean' ? value : null;

const clampNumber = (value: number, min: number, max?: number) => {
  const upper = max ?? Number.POSITIVE_INFINITY;
  return Math.min(Math.max(value, min), upper);
};

const sanitizeFileName = (value: string) =>
  value.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').trim();

const formatTimestamp = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
};

/**
 * Migration helper: Check if a value has the new unified structure
 */
const isNewFormat = (step: unknown): boolean => {
  return isRecord(step) && 'systemPrompt' in step;
};

/**
 * Migration helper: Migrate a single segment step from old to new format
 */
const migrateSegmentStep = (
  oldEnabled: boolean | unknown,
  oldExpanded: boolean | unknown,
  oldPrompt: unknown
): { enabled: boolean; expanded: boolean; systemPrompt: string; temperature: number } => {
  const enabled = getBoolean(oldEnabled) ?? true;
  const expanded = getBoolean(oldExpanded) ?? false;

  if (isRecord(oldPrompt)) {
    return {
      enabled,
      expanded,
      systemPrompt: getString(oldPrompt.systemPrompt) ?? DEFAULT_SEGMENTED_ANALYSIS_CONFIG.segments.background.systemPrompt,
      temperature: getNumber(oldPrompt.temperature) ?? DEFAULT_SEGMENTED_ANALYSIS_CONFIG.segments.background.temperature,
    };
  }

  // Fallback to defaults if prompt data is missing
  return {
    enabled,
    expanded,
    systemPrompt: DEFAULT_SEGMENTED_ANALYSIS_CONFIG.segments.background.systemPrompt,
    temperature: DEFAULT_SEGMENTED_ANALYSIS_CONFIG.segments.background.temperature,
  };
};

/**
 * Migration helper: Migrate a single post-processing step from old to new format
 */
const migratePostProcessStep = (
  oldEnabled: boolean | unknown,
  oldExpanded: boolean | unknown,
  oldPrompt: unknown
): { enabled: boolean; expanded: boolean; prompt: string } => {
  const enabled = getBoolean(oldEnabled) ?? true;
  const expanded = getBoolean(oldExpanded) ?? false;

  if (isRecord(oldPrompt)) {
    return {
      enabled,
      expanded,
      prompt: getString(oldPrompt.prompt) ?? DEFAULT_SEGMENTED_ANALYSIS_CONFIG.postProcessing.integration.prompt,
    };
  }

  // Fallback to defaults if prompt data is missing
  return {
    enabled,
    expanded,
    prompt: DEFAULT_SEGMENTED_ANALYSIS_CONFIG.postProcessing.integration.prompt,
  };
};

/**
 * Migrate old SegmentedAnalysisConfig structure to new unified structure
 *
 * Old structure:
 * {
 *   enabled: boolean,
 *   segments: { background: boolean, ... },           // enabled state only
 *   postProcessing: { integration: boolean, ... },    // enabled state only
 *   prompts: {                                        // prompt data
 *     segments: { background: { systemPrompt, temperature }, ... },
 *     postProcessing: { integration: { prompt }, ... }
 *   },
 *   ui: {                                             // expanded state
 *     segments: { background: boolean, ... },
 *     postProcessing: { integration: boolean, ... }
 *   }
 * }
 *
 * New structure:
 * {
 *   enabled: boolean,
 *   segments: {
 *     background: { enabled, expanded, systemPrompt, temperature },
 *     ...
 *   },
 *   postProcessing: {
 *     integration: { enabled, expanded, prompt },
 *     ...
 *   }
 * }
 */
const migrateSegmentedAnalysisConfig = (rawConfig: unknown): SegmentedAnalysisConfig => {
  if (!isRecord(rawConfig)) {
    return DEFAULT_SEGMENTED_ANALYSIS_CONFIG;
  }

  // Check if already in new format
  if (isRecord(rawConfig.segments) && isRecord(rawConfig.segments.background)) {
    if (isNewFormat(rawConfig.segments.background)) {
      // Already new format - validate and return
      return rawConfig as unknown as SegmentedAnalysisConfig;
    }
  }

  // Old format - migrate to new format
  const enabled = getBoolean(rawConfig.enabled) ?? false;

  // Migrate segments
  const segments: SegmentedAnalysisConfig['segments'] = {
    background: DEFAULT_SEGMENTED_ANALYSIS_CONFIG.segments.background,
    costume: DEFAULT_SEGMENTED_ANALYSIS_CONFIG.segments.costume,
    pose: DEFAULT_SEGMENTED_ANALYSIS_CONFIG.segments.pose,
    bodyType: DEFAULT_SEGMENTED_ANALYSIS_CONFIG.segments.bodyType,
  };

  if (isRecord(rawConfig.segments)) {
    const segmentsRecord = rawConfig.segments as Record<string, unknown>;
    (Object.keys(segments) as SegmentStep[]).forEach((key) => {
      const oldEnabled = segmentsRecord[key];
      const oldExpanded = isRecord(rawConfig.ui) && isRecord(rawConfig.ui.segments)
        ? (rawConfig.ui.segments as Record<string, unknown>)[key]
        : false;
      const oldPrompt = isRecord(rawConfig.prompts) && isRecord(rawConfig.prompts.segments)
        ? (rawConfig.prompts.segments as Record<string, unknown>)[key]
        : null;

      segments[key] = migrateSegmentStep(oldEnabled, oldExpanded, oldPrompt);
    });
  }

  // Migrate postProcessing
  const postProcessing: SegmentedAnalysisConfig['postProcessing'] = {
    integration: DEFAULT_SEGMENTED_ANALYSIS_CONFIG.postProcessing.integration,
    review: DEFAULT_SEGMENTED_ANALYSIS_CONFIG.postProcessing.review,
    refine: DEFAULT_SEGMENTED_ANALYSIS_CONFIG.postProcessing.refine,
  };

  if (isRecord(rawConfig.postProcessing)) {
    const postProcessingRecord = rawConfig.postProcessing as Record<string, unknown>;
    (Object.keys(postProcessing) as PostProcessStep[]).forEach((key) => {
      const oldEnabled = postProcessingRecord[key];
      const oldExpanded = isRecord(rawConfig.ui) && isRecord(rawConfig.ui.postProcessing)
        ? (rawConfig.ui.postProcessing as Record<string, unknown>)[key]
        : false;
      const oldPrompt = isRecord(rawConfig.prompts) && isRecord(rawConfig.prompts.postProcessing)
        ? (rawConfig.prompts.postProcessing as Record<string, unknown>)[key]
        : null;

      postProcessing[key] = migratePostProcessStep(oldEnabled, oldExpanded, oldPrompt);
    });
  }

  return { enabled, segments, postProcessing };
};

const validateProfileFile = (value: unknown): ProfileFile => {
  if (!isRecord(value)) {
    throw new Error('Invalid profile file.');
  }
  const schemaVersion = getNumber(value.schemaVersion);
  if (schemaVersion === null) {
    throw new Error('Invalid profile file.');
  }
  if (schemaVersion !== PROFILE_SCHEMA_VERSION) {
    throw new Error('Unsupported profile file version.');
  }
  if (!isRecord(value.globalSettings)) {
    throw new Error('Invalid profile file.');
  }
  return value as unknown as ProfileFile;
};

// FIX: Explicitly declare process to prevent 'Cannot find name process' error during build
declare const process: {
  env: {
    API_KEY?: string;
    PROFILE_API_URL?: string;
    PROFILE_API_TOKEN?: string;
    [key: string]: string | undefined;
  }
};

interface UseProfileProps {
  // API Configuration
  apiProvider: 'gemini' | 'openaiCompatible';
  manualApiKey: string;
  envApiKey: string;
  openaiCompatibleEndpoint: string;
  openaiCompatibleModel: string;
  openaiCompatibleApiKey: string;
  openaiCompatibleVideoFrameCount: number;
  // Settings
  triggerWord: string;
  datasetPrefix: string;
  isCharacterTaggingEnabled: boolean;
  characterShowName: string;
  bulkGenerationInstructions: string;
  bulkInstructions: string;
  isQueueEnabled: boolean;
  rpmLimit: number;
  batchSize: number;
  autofitTextareas: boolean;
  // ComfyUI Settings
  comfyServerUrl: string;
  setComfyServerUrl: (url: string) => void;
  comfyWorkflowId: string;
  setComfyWorkflowId: (id: string) => void;
  comfySeed: number;
  setComfySeed: (seed: number) => void;
  comfySteps: number;
  setComfySteps: (steps: number) => void;
  comfyStepsMin: number;
  setComfyStepsMin: (min: number) => void;
  comfyStepsMax: number;
  setComfyStepsMax: (max: number) => void;
  comfySeedLow: number;
  setComfySeedLow: (low: number) => void;
  comfySeedHigh: number;
  setComfySeedHigh: (high: number) => void;
  // Setters for state updates when loading profile
  setApiProvider: (provider: 'gemini' | 'openaiCompatible') => void;
  setManualApiKey: (key: string) => void;
  setIsAiStudioKey: (value: boolean) => void;
  setOpenaiCompatibleEndpoint: (endpoint: string) => void;
  setOpenaiCompatibleModel: (model: string) => void;
  setOpenaiCompatibleApiKey: (key: string) => void;
  setOpenaiCompatibleVideoFrameCount: (count: number) => void;
  setTriggerWord: (word: string) => void;
  setDatasetPrefix: (prefix: string) => void;
  setIsCharacterTaggingEnabled: (enabled: boolean) => void;
  setCharacterShowName: (name: string) => void;
  setBulkGenerationInstructions: (instructions: string) => void;
  setBulkInstructions: (instructions: string) => void;
  setIsQueueEnabled: (enabled: boolean) => void;
  setRpmLimit: (limit: number) => void;
  setBatchSize: (size: number) => void;
  setAutofitTextareas: (autofit: boolean) => void;
  segmentedAnalysisConfig: SegmentedAnalysisConfig;
  setSegmentedAnalysisConfig: (config: SegmentedAnalysisConfig) => void;
  // Collapsed sections state
  collapsedSections: {
    userProfile?: boolean;
    globalSettings?: boolean;
    comfyUI?: boolean;
    segmentedAnalysis?: boolean;
  };
  setCollapsedSections: (sections: { userProfile?: boolean; globalSettings?: boolean; comfyUI?: boolean; segmentedAnalysis?: boolean }) => void;
}

export const useProfile = ({
  apiProvider,
  manualApiKey,
  envApiKey,
  openaiCompatibleEndpoint,
  openaiCompatibleModel,
  openaiCompatibleApiKey,
  openaiCompatibleVideoFrameCount,
  triggerWord,
  datasetPrefix,
  isCharacterTaggingEnabled,
  characterShowName,
  bulkGenerationInstructions,
  bulkInstructions,
  isQueueEnabled,
  rpmLimit,
  batchSize,
  autofitTextareas,
  comfyServerUrl,
  setComfyServerUrl,
  comfyWorkflowId,
  setComfyWorkflowId,
  comfySeed,
  setComfySeed,
  comfySteps,
  setComfySteps,
  comfyStepsMin,
  setComfyStepsMin,
  comfyStepsMax,
  setComfyStepsMax,
  comfySeedLow,
  setComfySeedLow,
  comfySeedHigh,
  setComfySeedHigh,
  setApiProvider,
  setManualApiKey,
  setIsAiStudioKey,
  setOpenaiCompatibleEndpoint,
  setOpenaiCompatibleModel,
  setOpenaiCompatibleApiKey,
  setOpenaiCompatibleVideoFrameCount,
  setTriggerWord,
  setDatasetPrefix,
  setIsCharacterTaggingEnabled,
  setCharacterShowName,
  setBulkGenerationInstructions,
  setBulkInstructions,
  setIsQueueEnabled,
  setRpmLimit,
  setBatchSize,
  setAutofitTextareas,
  segmentedAnalysisConfig,
  setSegmentedAnalysisConfig,
  collapsedSections,
  setCollapsedSections,
}: UseProfileProps) => {
  const [profileName, setProfileName] = useState<string>('Default');
  const [projectExtensions, setProjectExtensions] = useState<Record<string, unknown>>({});
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadSuccess, setUploadSuccess] = useState<boolean>(false);
  const [lastSavedAt, setLastSavedAt] = useState<string>('');
  const [profileError, setProfileError] = useState<string>('');
  const savingStartTimeRef = useRef<number>(0);

  const { success: toastSuccess, error: toastError } = useToast();

  const saveAbortControllerRef = useRef<AbortController | null>(null);
  const loadAbortControllerRef = useRef<AbortController | null>(null);
  const saveSequenceRef = useRef<number>(0);
  const hasAutoSavedRef = useRef<boolean>(false);
  const lastAutoSaveSignatureRef = useRef<string>('');
  const suppressAutoSaveRef = useRef<boolean>(false);
  const hasAutoLoadedRef = useRef<boolean>(false);
  const autoSaveTimeoutRef = useRef<number | null>(null);

  // Compute profile service URL and token
  const profileServiceUrl = getBackendUrl();
  const profileServiceToken = (import.meta.env.VITE_PROFILE_API_TOKEN || process.env.PROFILE_API_TOKEN || '').trim();
  const profileServiceConfig = useMemo(
    () => ({
      baseUrl: profileServiceUrl,
      token: profileServiceToken || undefined,
    }),
    [profileServiceUrl, profileServiceToken],
  );

  const profileId = useMemo(
    () => profileName.trim() || PROFILE_NAME_FALLBACK,
    [profileName],
  );

  const buildProfileFile = useCallback((includeApiKeys: boolean = true): ProfileFile => {
    const trimmedName = profileName.trim();
    const resolvedProfileName = trimmedName || PROFILE_NAME_FALLBACK;
    const geminiApiKeyToSave = includeApiKeys ? (manualApiKey || envApiKey) : '';
    const globalSettings: ProfileGlobalSettings = {
      provider: apiProvider,
      gemini: {
        apiKey: geminiApiKeyToSave,
      },
      openaiCompatible: {
        endpoint: openaiCompatibleEndpoint,
        model: openaiCompatibleModel,
        apiKey: includeApiKeys ? openaiCompatibleApiKey : '',
        videoFrameCount: openaiCompatibleVideoFrameCount,
      },
      general: {
        triggerWord,
        datasetPrefix,
        characterTaggingEnabled: isCharacterTaggingEnabled,
        characterShowName,
      },
      instructions: {
        bulkGeneration: bulkGenerationInstructions,
        bulkRefinement: bulkInstructions,
      },
      queue: {
        enabled: isQueueEnabled,
        rpmLimit,
        batchSize,
      },
      ui: {
        autofitTextareas,
        collapsedSections,
      },
      extensions: {
        ...projectExtensions,
        segmentedAnalysis: segmentedAnalysisConfig,
        comfy: {
          serverUrl: comfyServerUrl,
          workflowId: comfyWorkflowId,
          seed: comfySeed,
          steps: comfySteps,
          stepsMin: comfyStepsMin,
          stepsMax: comfyStepsMax,
          seedLow: comfySeedLow,
          seedHigh: comfySeedHigh,
        },
      },
    };

    return {
      schemaVersion: PROFILE_SCHEMA_VERSION,
      savedAt: new Date().toISOString(),
      profileName: resolvedProfileName,
      globalSettings,
    };
  }, [
    profileName,
    apiProvider,
    manualApiKey,
    envApiKey,
    openaiCompatibleEndpoint,
    openaiCompatibleModel,
    openaiCompatibleApiKey,
    openaiCompatibleVideoFrameCount,
    triggerWord,
    datasetPrefix,
    isCharacterTaggingEnabled,
    characterShowName,
    bulkGenerationInstructions,
    bulkInstructions,
    isQueueEnabled,
    rpmLimit,
    batchSize,
    autofitTextareas,
    comfyServerUrl,
    comfyWorkflowId,
    comfySeed,
    comfySteps,
    comfyStepsMin,
    comfyStepsMax,
    comfySeedLow,
    comfySeedHigh,
    projectExtensions,
    segmentedAnalysisConfig,
    collapsedSections,
  ]);

  const saveProfileToService = useCallback(async (payload?: ProfileFile) => {
    saveAbortControllerRef.current?.abort();
    const controller = new AbortController();
    saveAbortControllerRef.current = controller;
    const sequence = ++saveSequenceRef.current;
    setIsSavingProfile(true);
    savingStartTimeRef.current = Date.now();

    try {
      const profileFile = payload ?? buildProfileFile();
      await saveProfile(profileServiceConfig, profileId, profileFile, controller.signal);
      if (sequence === saveSequenceRef.current) {
        setLastSavedAt(new Date().toISOString());
        setProfileError('');
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      if (sequence === saveSequenceRef.current) {
        const message = error instanceof Error ? error.message : 'Failed to save profile.';
        setProfileError(message);
      }
    } finally {
      if (sequence === saveSequenceRef.current) {
        // Ensure minimum 1 second of loading state
        const elapsed = Date.now() - savingStartTimeRef.current;
        const remainingTime = Math.max(0, 1000 - elapsed);
        setTimeout(() => {
          if (sequence === saveSequenceRef.current) {
            setIsSavingProfile(false);
          }
        }, remainingTime);
      }
    }
  }, [profileServiceConfig, profileId, buildProfileFile]);

  const applyProfileFile = useCallback((profileFile: ProfileFile) => {
    const { globalSettings } = profileFile;
    if (globalSettings.provider === 'gemini' || globalSettings.provider === 'openaiCompatible') {
      setApiProvider(globalSettings.provider);
    }

    if (isRecord(globalSettings.gemini)) {
      const geminiApiKey = getString(globalSettings.gemini.apiKey);
      if (geminiApiKey !== null) {
        setManualApiKey(geminiApiKey);
        setIsAiStudioKey(false);
      }
    }

    if (isRecord(globalSettings.openaiCompatible)) {
      const endpoint = getString(globalSettings.openaiCompatible.endpoint);
      if (endpoint !== null) setOpenaiCompatibleEndpoint(endpoint);
      const model = getString(globalSettings.openaiCompatible.model);
      if (model !== null) setOpenaiCompatibleModel(model);
      const apiKey = getString(globalSettings.openaiCompatible.apiKey);
      if (apiKey !== null) setOpenaiCompatibleApiKey(apiKey);
      const videoFrameCount = getNumber(globalSettings.openaiCompatible.videoFrameCount);
      if (videoFrameCount !== null) {
        setOpenaiCompatibleVideoFrameCount(clampNumber(Math.round(videoFrameCount), 1, 32));
      }
    }

    if (isRecord(globalSettings.general)) {
      const nextTriggerWord = getString(globalSettings.general.triggerWord);
      if (nextTriggerWord !== null) setTriggerWord(nextTriggerWord);
      const nextDatasetPrefix = getString(globalSettings.general.datasetPrefix);
      if (nextDatasetPrefix !== null) setDatasetPrefix(nextDatasetPrefix);
      const nextCharacterTaggingEnabled = getBoolean(globalSettings.general.characterTaggingEnabled);
      if (nextCharacterTaggingEnabled !== null) setIsCharacterTaggingEnabled(nextCharacterTaggingEnabled);
      const nextCharacterShowName = getString(globalSettings.general.characterShowName);
      if (nextCharacterShowName !== null) setCharacterShowName(nextCharacterShowName);
    }

    if (isRecord(globalSettings.instructions)) {
      const nextBulkGeneration = getString(globalSettings.instructions.bulkGeneration);
      if (nextBulkGeneration !== null) setBulkGenerationInstructions(nextBulkGeneration);
      const nextBulkRefinement = getString(globalSettings.instructions.bulkRefinement);
      if (nextBulkRefinement !== null) setBulkInstructions(nextBulkRefinement);
    }

    if (isRecord(globalSettings.queue)) {
      const nextQueueEnabled = getBoolean(globalSettings.queue.enabled);
      if (nextQueueEnabled !== null) setIsQueueEnabled(nextQueueEnabled);
      const nextRpmLimit = getNumber(globalSettings.queue.rpmLimit);
      if (nextRpmLimit !== null) setRpmLimit(clampNumber(Math.round(nextRpmLimit), 1));
      const nextBatchSize = getNumber(globalSettings.queue.batchSize);
      if (nextBatchSize !== null) setBatchSize(clampNumber(Math.round(nextBatchSize), 1));
    }

    if (isRecord(globalSettings.ui)) {
      const nextAutofit = getBoolean(globalSettings.ui.autofitTextareas);
      if (nextAutofit !== null) setAutofitTextareas(nextAutofit);

      // Load collapsed sections
      if (isRecord(globalSettings.ui.collapsedSections)) {
        const collapsed = globalSettings.ui.collapsedSections as Record<string, unknown>;
        setCollapsedSections({
          userProfile: getBoolean(collapsed.userProfile) ?? undefined,
          globalSettings: getBoolean(collapsed.globalSettings) ?? undefined,
          comfyUI: getBoolean(collapsed.comfyUI) ?? undefined,
          segmentedAnalysis: getBoolean(collapsed.segmentedAnalysis) ?? undefined,
        });
      }
    }

    const nextProfileName = getString(profileFile.profileName);
    if (nextProfileName !== null) setProfileName(nextProfileName);

    if (isRecord(globalSettings.extensions)) {
      setProjectExtensions(globalSettings.extensions);

      // Load segmented analysis config with migration support
      if (isRecord(globalSettings.extensions.segmentedAnalysis)) {
        const migratedConfig = migrateSegmentedAnalysisConfig(globalSettings.extensions.segmentedAnalysis);
        setSegmentedAnalysisConfig(migratedConfig);
      }

      // Load ComfyUI config
      if (isRecord(globalSettings.extensions.comfy)) {
        const comfy = globalSettings.extensions.comfy as Record<string, unknown>;
        const serverUrl = getString(comfy.serverUrl);
        if (serverUrl !== null) setComfyServerUrl(serverUrl);

        const workflowId = getString(comfy.workflowId);
        if (workflowId !== null) setComfyWorkflowId(workflowId);

        const seed = getNumber(comfy.seed);
        if (seed !== null) setComfySeed(seed);

        const steps = getNumber(comfy.steps);
        if (steps !== null) setComfySteps(clampNumber(Math.round(steps), 1, 50));

        const stepsMin = getNumber(comfy.stepsMin);
        if (stepsMin !== null) setComfyStepsMin(clampNumber(Math.round(stepsMin), 1, 50));

        const stepsMax = getNumber(comfy.stepsMax);
        if (stepsMax !== null) setComfyStepsMax(clampNumber(Math.round(stepsMax), 1, 50));

        const seedLow = getNumber(comfy.seedLow);
        if (seedLow !== null) setComfySeedLow(seedLow);

        const seedHigh = getNumber(comfy.seedHigh);
        if (seedHigh !== null) setComfySeedHigh(seedHigh);
      }
    }

    setProfileError('');
  }, [
    setApiProvider,
    setManualApiKey,
    setIsAiStudioKey,
    setOpenaiCompatibleEndpoint,
    setOpenaiCompatibleModel,
    setOpenaiCompatibleApiKey,
    setOpenaiCompatibleVideoFrameCount,
    setTriggerWord,
    setDatasetPrefix,
    setIsCharacterTaggingEnabled,
    setCharacterShowName,
    setBulkGenerationInstructions,
    setBulkInstructions,
    setIsQueueEnabled,
    setRpmLimit,
    setBatchSize,
    setAutofitTextareas,
    setSegmentedAnalysisConfig,
    setComfyServerUrl,
    setComfyWorkflowId,
    setComfySeed,
    setComfySteps,
    setComfyStepsMin,
    setComfyStepsMax,
    setComfySeedLow,
    setComfySeedHigh,
    setCollapsedSections,
  ]);

  const loadProfileFromService = useCallback(async (source: 'auto' | 'manual') => {
    loadAbortControllerRef.current?.abort();
    const controller = new AbortController();
    loadAbortControllerRef.current = controller;
    const shouldShowLoading = source === 'manual';
    if (shouldShowLoading) {
    }

    try {
      const rawProfile = await loadProfile(profileServiceConfig, profileId, controller.signal);
      if (!rawProfile) {
        if (source === 'manual') {
          setProfileError('Profile not found.');
        }
        return;
      }
      const validatedProfile = validateProfileFile(rawProfile);
      suppressAutoSaveRef.current = true;
      applyProfileFile(validatedProfile);
      await saveProfileToService(validatedProfile);
      setProfileError('');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      if (error instanceof SyntaxError) {
        setProfileError('Invalid profile file.');
        return;
      }
      const message = error instanceof Error ? error.message : 'Failed to load profile.';
      setProfileError(message);
    } finally {
      if (shouldShowLoading) {
      }
    }
  }, [profileServiceConfig, profileId, applyProfileFile, saveProfileToService]);

  const handleProjectLoad = useCallback(() => {
    loadProfileFromService('manual');
  }, [loadProfileFromService]);

  const handleProjectSave = useCallback(() => {
    saveProfileToService();
  }, [saveProfileToService]);

  const handleProfileDownload = useCallback((includeApiKeys: boolean = true) => {
    try {
      const profileFile = buildProfileFile(includeApiKeys);
      const safeBaseName = sanitizeFileName(profileFile.profileName) || PROFILE_NAME_FALLBACK;
      const fileName = `${safeBaseName}-${formatTimestamp(new Date())}.json`;
      const blob = new Blob([JSON.stringify(profileFile, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setProfileError('');
    } catch (error) {
      setProfileError('Failed to download profile.');
    }
  }, [buildProfileFile]);

  const handleProfileUpload = useCallback(async (file: File) => {
    setIsUploading(true);
    setUploadSuccess(false);
    setProfileError('');

    try {
      // Read and parse the uploaded file
      const text = await file.text();
      const rawProfile = JSON.parse(text) as unknown;

      // Basic validation: check if profileName exists
      if (!isRecord(rawProfile) || !getString(rawProfile.profileName)) {
        toastError('Invalid profile file');
        return;
      }

      const validatedProfile = validateProfileFile(rawProfile);

      // Apply the uploaded profile settings
      suppressAutoSaveRef.current = true;
      applyProfileFile(validatedProfile);

      // Save to profile service
      await saveProfileToService(validatedProfile);

      toastSuccess('Profile uploaded and loaded successfully!');
    } catch (error) {
      toastError('Invalid profile file');
    } finally {
      setIsUploading(false);
    }
  }, [applyProfileFile, saveProfileToService, toastSuccess, toastError]);

  const autoSaveSignature = useMemo(() => JSON.stringify({
    apiProvider,
    manualApiKey,
    openaiCompatibleEndpoint,
    openaiCompatibleModel,
    openaiCompatibleApiKey,
    openaiCompatibleVideoFrameCount,
    triggerWord,
    datasetPrefix,
    isCharacterTaggingEnabled,
    characterShowName,
    bulkGenerationInstructions,
    bulkInstructions,
    autofitTextareas,
    isQueueEnabled,
    rpmLimit,
    batchSize,
    segmentedAnalysisConfig,
    comfyServerUrl,
    comfyWorkflowId,
    comfySeed,
    comfySteps,
    comfyStepsMin,
    comfyStepsMax,
    comfySeedLow,
    comfySeedHigh,
    collapsedSections,
  }), [
    apiProvider,
    manualApiKey,
    openaiCompatibleEndpoint,
    openaiCompatibleModel,
    openaiCompatibleApiKey,
    openaiCompatibleVideoFrameCount,
    triggerWord,
    datasetPrefix,
    isCharacterTaggingEnabled,
    characterShowName,
    bulkGenerationInstructions,
    bulkInstructions,
    autofitTextareas,
    isQueueEnabled,
    rpmLimit,
    batchSize,
    segmentedAnalysisConfig,
    comfyServerUrl,
    comfyWorkflowId,
    comfySeed,
    comfySteps,
    comfyStepsMin,
    comfyStepsMax,
    comfySeedLow,
    comfySeedHigh,
    collapsedSections,
  ]);

  // Auto-load on mount
  useEffect(() => {
    if (hasAutoLoadedRef.current) {
      return;
    }
    hasAutoLoadedRef.current = true;
    loadProfileFromService('auto');
  }, [loadProfileFromService]);

  // Auto-save effect
  useEffect(() => {
    if (autoSaveTimeoutRef.current !== null) {
      window.clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = null;
    }
    if (!hasAutoSavedRef.current) {
      hasAutoSavedRef.current = true;
      lastAutoSaveSignatureRef.current = autoSaveSignature;
      return;
    }
    if (suppressAutoSaveRef.current) {
      suppressAutoSaveRef.current = false;
      lastAutoSaveSignatureRef.current = autoSaveSignature;
      return;
    }
    if (autoSaveSignature === lastAutoSaveSignatureRef.current) {
      return;
    }
    lastAutoSaveSignatureRef.current = autoSaveSignature;
    autoSaveTimeoutRef.current = window.setTimeout(() => {
      saveProfileToService();
      autoSaveTimeoutRef.current = null;
    }, 500);
  }, [autoSaveSignature, saveProfileToService]);

  const autoSaveStatus = useMemo(() => {
    if (lastSavedAt) {
      return lastSavedAt;
    }
    return '';
  }, [lastSavedAt]);

  return {
    profileName,
    setProfileName,
    projectExtensions,
    setProjectExtensions,
    isSavingProfile,
    isUploading,
    uploadSuccess,
    lastSavedAt,
    profileError,
    setProfileError,
    profileId,
    autoSaveStatus,
    profileServiceConfig,
    profileServiceUrl,
    handleProjectLoad,
    handleProjectSave,
    handleProfileDownload,
    handleProfileUpload,
  };
};
