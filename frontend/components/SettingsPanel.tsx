import React, { useState, useEffect, useCallback } from 'react';
import type { ApiProvider, EndpointStatus } from '../types';
import { TrashIcon, WandIcon, Spinner } from './Icons';
import SearchableSelect, { SelectOption } from './SearchableSelect';
import EndpointStatusIndicator from './EndpointStatusIndicator';
import { fetchOpenAIModels, checkEndpointStatus } from '../services/openaiCompatibleService';

interface GeminiSettingsProps {
  envApiKey: string;
  manualApiKey: string;
  isAiStudioKey: boolean;
  onManualApiKeyChange: (value: string) => void;
  onSelectKey: () => void;
}

interface OpenAICompatibleSettingsProps {
  openaiCompatibleEndpoint: string;
  onOpenAICompatibleEndpointChange: (value: string) => void;
  openaiCompatibleApiKey: string;
  onOpenAICompatibleApiKeyChange: (value: string) => void;
  openaiCompatibleModel: string;
  onOpenAICompatibleModelChange: (value: string) => void;
  openaiCompatibleVideoFrameCount: number;
  onOpenAICompatibleVideoFrameCountChange: (value: number) => void;
  isHttps: boolean;
}

interface GeneralSettingsProps {
  triggerWord: string;
  onTriggerWordChange: (value: string) => void;
  datasetPrefix: string;
  onDatasetPrefixChange: (value: string) => void;
  isCharacterTaggingEnabled: boolean;
  onCharacterTaggingToggle: (value: boolean) => void;
  characterShowName: string;
  onCharacterShowNameChange: (value: string) => void;
}

interface InstructionSettingsProps {
  bulkGenerationInstructions: string;
  onBulkGenerationInstructionsChange: (value: string) => void;
  bulkInstructions: string;
  onBulkInstructionsChange: (value: string) => void;
  onRefineSelected: () => void;
  hasValidConfig: boolean;
  selectedCount: number;
}

interface AutofitToggleProps {
  autofitTextareas: boolean;
  onAutofitToggle: (value: boolean) => void;
}

interface QueueControlsProps {
  isQueueEnabled: boolean;
  onQueueToggle: (value: boolean) => void;
  rpmLimit: number;
  onRpmLimitChange: (value: number) => void;
  batchSize: number;
  onBatchSizeChange: (value: number) => void;
  isProcessingQueueItem: boolean;
  requestQueueLength: number;
  completedQueueCount: number;
  totalQueueItems: number;
  queueProgress: number;
  onClearQueue: () => void;
  colorTheme?: 'pink' | 'orange';
  hideRpmAndBatch?: boolean;
  queueRunning?: number;
  queueRemaining?: number;
}

interface SettingsPanelProps {
  apiProvider: ApiProvider;
  onApiProviderChange: (provider: ApiProvider) => void;
  geminiSettings: GeminiSettingsProps;
  openaiCompatibleSettings: OpenAICompatibleSettingsProps;
  generalSettings: GeneralSettingsProps;
  instructionSettings: InstructionSettingsProps;
  autofitToggle: AutofitToggleProps;
  queueControls: QueueControlsProps;
  footer?: React.ReactNode;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const GeminiSettings: React.FC<GeminiSettingsProps> = ({
  envApiKey,
  manualApiKey,
  isAiStudioKey,
  onManualApiKeyChange,
  onSelectKey,
}) => {
  const canUseAiStudio = typeof window !== 'undefined' && Boolean(window.aistudio);

  return (
    <div className="space-y-1 animate-fade-in">
      <label className="block text-sm font-medium text-gray-300">Google API Key</label>
      {envApiKey ? (
        <button
          disabled
          className="w-full p-2 rounded-md bg-green-900/50 text-green-200 border border-green-700 cursor-not-allowed"
        >
          API Key configured via Environment Variables ✓
        </button>
      ) : (
        <div className="flex gap-2">
          <input
            id="manual-api-key"
            type="password"
            value={manualApiKey}
            onChange={(e) => onManualApiKeyChange(e.target.value)}
            placeholder="Paste Gemini API Key here"
            className="flex-grow p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          {canUseAiStudio && (
            <button
              onClick={onSelectKey}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-md border border-gray-600 text-sm"
            >
              Select
            </button>
          )}
        </div>
      )}
      <div className="flex flex-col gap-1 pt-1">
        <a
          href="https://aistudio.google.com/api-keys"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-indigo-400 hover:text-indigo-300 underline w-fit"
        >
          Get your API Key here
        </a>
        {isAiStudioKey && !envApiKey && (
          <span className="text-[11px] text-green-300">AI Studio key selected.</span>
        )}
      </div>
    </div>
  );
};

const OpenAICompatibleSettings: React.FC<OpenAICompatibleSettingsProps> = ({
  openaiCompatibleEndpoint,
  onOpenAICompatibleEndpointChange,
  openaiCompatibleApiKey,
  onOpenAICompatibleApiKeyChange,
  openaiCompatibleModel,
  onOpenAICompatibleModelChange,
  openaiCompatibleVideoFrameCount,
  onOpenAICompatibleVideoFrameCountChange,
  isHttps,
}) => {
  const [endpointStatus, setEndpointStatus] = useState<EndpointStatus>('idle');
  const [availableModels, setAvailableModels] = useState<SelectOption[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  // Check endpoint status when endpoint or API key changes
  useEffect(() => {
    if (!openaiCompatibleEndpoint) {
      setEndpointStatus('idle');
      return;
    }

    const timer = setTimeout(async () => {
      setEndpointStatus('checking');
      const status = await checkEndpointStatus(openaiCompatibleEndpoint, openaiCompatibleApiKey);
      setEndpointStatus(status);
    }, 500);

    return () => clearTimeout(timer);
  }, [openaiCompatibleEndpoint, openaiCompatibleApiKey]);

  // Fetch models when endpoint is successful and API key is available
  useEffect(() => {
    if (endpointStatus !== 'success' || !openaiCompatibleEndpoint) {
      setAvailableModels([]);
      return;
    }

    const fetchModels = async () => {
      setIsLoadingModels(true);
      try {
        const models = await fetchOpenAIModels(openaiCompatibleEndpoint, openaiCompatibleApiKey);
        const options: SelectOption[] = models.map(model => ({
          id: model.id,
          name: model.id,
        }));
        setAvailableModels(options);
      } catch (error) {
        console.error('Failed to fetch models:', error);
        setAvailableModels([]);
      } finally {
        setIsLoadingModels(false);
      }
    };

    fetchModels();
  }, [endpointStatus, openaiCompatibleEndpoint, openaiCompatibleApiKey]);

  return (
    <div className="space-y-3 animate-fade-in">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Endpoint {isHttps ? '(Tunnel URL)' : ''}
        </label>
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={openaiCompatibleEndpoint}
            onChange={(e) => onOpenAICompatibleEndpointChange(e.target.value)}
            placeholder={isHttps ? 'https://....trycloudflare.com/v1' : 'http://localhost:8000/v1'}
            className="flex-grow p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
          />
          <EndpointStatusIndicator status={endpointStatus} size="sm" />
        </div>
      </div>

      <div>
        <label htmlFor="openai-compatible-model" className="block text-sm font-medium text-gray-300 mb-1">
          Model ID
        </label>
        <SearchableSelect
          options={availableModels}
          selectedId={openaiCompatibleModel || null}
          onChange={(value) => onOpenAICompatibleModelChange(value || '')}
          placeholder="e.g. Qwen/Qwen2.5-VL-7B-Instruct"
          loading={isLoadingModels}
          allowCustomInput={true}
          showStatusIndicator={false}
        />
      </div>

      <div>
        <label htmlFor="openai-compatible-api-key" className="block text-sm font-medium text-gray-300 mb-1">
          API Key
        </label>
        <input
          id="openai-compatible-api-key"
          type="password"
          value={openaiCompatibleApiKey}
          onChange={(e) => onOpenAICompatibleApiKeyChange(e.target.value)}
          placeholder="Optional for hosted endpoints"
          className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
        />
      </div>

      <div className="pt-2 border-t border-gray-700">
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Video Frame Sampling
        </label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="1"
            max="32"
            step="1"
            value={openaiCompatibleVideoFrameCount}
            onChange={(e) => onOpenAICompatibleVideoFrameCountChange(parseInt(e.target.value, 10))}
            className="flex-grow h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
          <span className="text-sm text-gray-400 w-12 text-right">{openaiCompatibleVideoFrameCount} f</span>
        </div>
        <p className="text-xs text-gray-500 mt-1">Number of frames to extract and send to the API for video files.</p>
      </div>
    </div>
  );
};

const GeneralSettings: React.FC<GeneralSettingsProps> = ({
  triggerWord,
  onTriggerWordChange,
  datasetPrefix,
  onDatasetPrefixChange,
  isCharacterTaggingEnabled,
  onCharacterTaggingToggle,
  characterShowName,
  onCharacterShowNameChange,
}) => (
  <>
    <div>
      <label htmlFor="trigger-word" className="block text-sm font-medium text-gray-300 mb-1">Trigger Word</label>
      <input
        id="trigger-word"
        type="text"
        value={triggerWord}
        onChange={(e) => onTriggerWordChange(e.target.value)}
        className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        placeholder="e.g., GurrenLagannStyle"
      />
    </div>
    <div>
      <label htmlFor="dataset-prefix" className="block text-sm font-medium text-gray-300 mb-1">Dataset File Prefix</label>
      <input
        id="dataset-prefix"
        type="text"
        value={datasetPrefix}
        onChange={(e) => onDatasetPrefixChange(e.target.value)}
        className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        placeholder="e.g., my_dataset"
      />
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-1">Character Tagging</label>
      <div className="flex items-center space-x-3">
        <input
          type="checkbox"
          id="character-tagging-toggle"
          checked={isCharacterTaggingEnabled}
          onChange={(e) => onCharacterTaggingToggle(e.target.checked)}
          className="h-4 w-4 rounded border-gray-500 bg-gray-700 text-indigo-500 focus:ring-indigo-600 flex-shrink-0"
          title="Enable character tagging"
        />
        <input
          id="character-show-name"
          type="text"
          value={characterShowName}
          onChange={(e) => onCharacterShowNameChange(e.target.value)}
          className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
          placeholder="Enter show/series name..."
          disabled={!isCharacterTaggingEnabled}
        />
      </div>
    </div>
  </>
);

const InstructionSettings: React.FC<InstructionSettingsProps> = ({
  bulkGenerationInstructions,
  onBulkGenerationInstructionsChange,
  bulkInstructions,
  onBulkInstructionsChange,
  onRefineSelected,
  hasValidConfig,
  selectedCount,
}) => {
  const refineDisabled = !hasValidConfig || selectedCount === 0 || !bulkInstructions.trim();

  return (
    <>
      <div>
        <label htmlFor="bulk-generation-instructions" className="block text-sm font-medium text-gray-300 mb-1">Bulk Generation Instructions</label>
        <textarea
          id="bulk-generation-instructions"
          value={bulkGenerationInstructions}
          onChange={(e) => onBulkGenerationInstructionsChange(e.target.value)}
          className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-h-[120px] text-sm"
          placeholder="For 'Generate All'/'Selected' button..."
          rows={4}
        />
      </div>
      <div>
        <label htmlFor="bulk-instructions" className="block text-sm font-medium text-gray-300 mb-1">Bulk Refinement Instructions</label>
        <div className="flex gap-2">
          <input
            id="bulk-instructions"
            type="text"
            value={bulkInstructions}
            onChange={(e) => onBulkInstructionsChange(e.target.value)}
            className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="For 'Refine' button, e.g., Focus on..."
          />
          <button
            onClick={onRefineSelected}
            disabled={refineDisabled}
            className="flex-shrink-0 flex items-center justify-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
            title={!hasValidConfig ? 'Please check provider settings' : 'Apply instructions to all selected items'}
          >
            <WandIcon className="w-5 h-5 mr-2" />
            <span>Refine ({selectedCount})</span>
          </button>
        </div>
      </div>
    </>
  );
};

const AutofitToggle: React.FC<AutofitToggleProps> = ({
  autofitTextareas,
  onAutofitToggle,
}) => (
  <div className="flex items-center space-x-3 pt-2">
    <input
      type="checkbox"
      id="autofit-toggle"
      checked={autofitTextareas}
      onChange={(e) => onAutofitToggle(e.target.checked)}
      className="h-4 w-4 rounded border-gray-500 bg-gray-700 text-indigo-500 focus:ring-indigo-600"
    />
    <label htmlFor="autofit-toggle" className="text-sm font-medium text-gray-300">
      Autofit caption textboxes
    </label>
  </div>
);

const QueueControls: React.FC<QueueControlsProps> = ({
  isQueueEnabled,
  onQueueToggle,
  rpmLimit,
  onRpmLimitChange,
  batchSize,
  onBatchSizeChange,
  isProcessingQueueItem,
  requestQueueLength,
  completedQueueCount,
  totalQueueItems,
  queueProgress,
  onClearQueue,
  colorTheme = 'pink',
  hideRpmAndBatch = false,
  queueRunning,
  queueRemaining,
}) => {
  const isActive = requestQueueLength > 0 || isProcessingQueueItem;

  const theme = {
    text: colorTheme === 'orange' ? 'text-orange-300' : 'text-pink-300',
    gradientFrom: colorTheme === 'orange' ? 'from-orange-400' : 'from-pink-400',
    gradientTo: colorTheme === 'orange' ? 'to-orange-500' : 'to-purple-500',
    bg: colorTheme === 'orange' ? 'bg-orange-600' : 'bg-purple-600',
  };

  return (
    <div className="pt-2">
      <div className="flex items-center space-x-3 cursor-pointer">
        <input
          type="checkbox"
          id="queue-toggle"
          checked={isQueueEnabled}
          onChange={(e) => onQueueToggle(e.target.checked)}
          className="h-4 w-4 rounded border-gray-500 bg-gray-700 text-indigo-500 focus:ring-indigo-600"
        />
        <label htmlFor="queue-toggle" className="text-sm font-medium text-gray-300">
          Enable Request Queue
        </label>
      </div>
      {isQueueEnabled && (
        <div className="pl-7 mt-2 space-y-2">
          {!hideRpmAndBatch && (
            <div className="flex items-center space-x-2">
              <label htmlFor="rpm-limit" className="text-sm font-medium text-gray-300">RPM Limit:</label>
              <input
                type="number"
                id="rpm-limit"
                value={rpmLimit}
                onChange={(e) => onRpmLimitChange(parseInt(e.target.value, 10) || 1)}
                className="w-20 p-1 bg-gray-900 border border-gray-600 rounded-md text-sm focus:ring-1 focus:ring-indigo-500"
                min="1"
              />
              <label htmlFor="batch-size" className="text-sm font-medium text-gray-300">Batch Size:</label>
              <input
                type="number"
                id="batch-size"
                value={batchSize}
                onChange={(e) => onBatchSizeChange(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-20 p-1 bg-gray-900 border border-gray-600 rounded-md text-sm focus:ring-1 focus:ring-indigo-500"
                min="1"
              />
            </div>
          )}
          {isActive ? (
            <div className="flex items-center gap-3 w-full">
              <div className="flex-grow">
                <div className="flex justify-between mb-1">
                  <span className={`font-medium ${theme.text} flex items-center`}>
                    <Spinner size="sm" className="mr-2" />
                    Processing Queue...
                  </span>
                  <span className="text-gray-400 font-mono">
                    {completedQueueCount} / {totalQueueItems}
                  </span>
                </div>
                <div className="w-full bg-gray-900 rounded-full h-2.5 relative overflow-hidden">
                  <div
                    className={`bg-gradient-to-r ${theme.gradientFrom} ${theme.gradientTo} h-2.5 rounded-full transition-all duration-300 ease-out`}
                    style={{ width: `${queueProgress}%` }}
                  ></div>
                </div>
                {/* Show ComfyUI queue status if available */}
                {(queueRunning !== undefined || queueRemaining !== undefined) && (queueRunning! > 0 || queueRemaining! > 0) && (
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                    {queueRunning !== undefined && queueRunning > 0 && (
                      <span>Running: {queueRunning}</span>
                    )}
                    {(queueRunning! > 0 && (queueRemaining !== undefined && queueRemaining > 0)) && (
                      <span className="text-gray-600">|</span>
                    )}
                    {queueRemaining !== undefined && queueRemaining > 0 && (
                      <span>Queued: {queueRemaining}</span>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={onClearQueue}
                disabled={requestQueueLength === 0}
                className="text-gray-400 hover:text-white disabled:text-gray-600 disabled:cursor-not-allowed p-1 rounded-full hover:bg-gray-700 transition-colors flex-shrink-0"
                title="Clear queue"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <span className="text-xs text-gray-400">Queue is idle.</span>
          )}
        </div>
      )}
    </div>
  );
};

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  apiProvider,
  onApiProviderChange,
  geminiSettings,
  openaiCompatibleSettings,
  generalSettings,
  instructionSettings,
  autofitToggle,
  queueControls,
  footer,
  isCollapsed = false,
  onToggleCollapse,
}) => (
  <section className="bg-gray-800/50 rounded-lg shadow-lg">
    <div className="p-6 flex items-center justify-between">
      <h2 className="text-xl font-semibold">2. Global Settings & Actions</h2>
      <button
        onClick={onToggleCollapse}
        className="text-gray-400 hover:text-white transition-colors p-1 rounded hover:bg-gray-700"
        aria-label={isCollapsed ? 'Expand' : 'Collapse'}
      >
        <svg className="w-5 h-5 transition-transform" style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </div>
    {!isCollapsed && (
      <div className="px-6 pb-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">AI Provider</label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-gray-900 rounded-md">
                <button
                  onClick={() => onApiProviderChange('gemini')}
                  className={`py-2 rounded text-sm font-medium transition-colors ${apiProvider === 'gemini' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}
                >
                  Google Gemini
                </button>
                <button
                  onClick={() => onApiProviderChange('openaiCompatible')}
                  className={`py-2 rounded text-sm font-medium transition-colors ${apiProvider === 'openaiCompatible' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}
                >
                  OpenAI Compatible (API)
                </button>
              </div>
            </div>

            {apiProvider === 'gemini' && <GeminiSettings {...geminiSettings} />}
            {apiProvider === 'openaiCompatible' && <OpenAICompatibleSettings {...openaiCompatibleSettings} />}

            <GeneralSettings {...generalSettings} />
          </div>
          <div className="space-y-4">
            <InstructionSettings {...instructionSettings} />
            <AutofitToggle {...autofitToggle} />
            <QueueControls {...queueControls} />
          </div>
        </div>
        {footer}
      </div>
    )}
  </section>
);

export default SettingsPanel;
