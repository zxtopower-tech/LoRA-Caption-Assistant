import React from 'react';
import type { SegmentedAnalysisConfig, SegmentStep, PostProcessStep } from '../types';

interface SegmentedAnalysisPanelProps {
  config: SegmentedAnalysisConfig;
  onConfigChange: (config: SegmentedAnalysisConfig) => void;
  onSegmentPromptChange: (segment: SegmentStep, systemPrompt: string) => void;
  onSegmentTemperatureChange: (segment: SegmentStep, temperature: number) => void;
  onPostProcessPromptChange: (step: PostProcessStep, prompt: string) => void;
  onSegmentExpandedChange: (segment: SegmentStep, expanded: boolean) => void;
  onPostProcessExpandedChange: (step: PostProcessStep, expanded: boolean) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const SEGMENT_LABELS: Record<SegmentStep, string> = {
  background: 'Background Analysis',
  costume: 'Costume/Clothing Analysis',
  pose: 'Pose Analysis',
  bodyType: 'Body Type Analysis',
};

const POST_PROCESSING_LABELS: Record<PostProcessStep, string> = {
  integration: 'Integration (Combine segments)',
  review: 'Review (Quality check)',
  refine: 'Refine (Final improvement)',
};

const SegmentedAnalysisPanel: React.FC<SegmentedAnalysisPanelProps> = ({
  config,
  onConfigChange,
  onSegmentPromptChange,
  onSegmentTemperatureChange,
  onPostProcessPromptChange,
  onSegmentExpandedChange,
  onPostProcessExpandedChange,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const toggleSegmentPrompt = (segment: SegmentStep) => {
    onSegmentExpandedChange(segment, !config.segments[segment].expanded);
  };

  const expandSegmentPrompts = () => {
    (Object.keys(config.segments) as SegmentStep[]).forEach(key => {
      if (config.segments[key].enabled && !config.segments[key].expanded) {
        onSegmentExpandedChange(key, true);
      }
    });
  };

  const collapseSegmentPrompts = () => {
    (Object.keys(config.segments) as SegmentStep[]).forEach(key => {
      if (config.segments[key].expanded) {
        onSegmentExpandedChange(key, false);
      }
    });
  };

  const expandPostProcessPrompts = () => {
    (Object.keys(config.postProcessing) as PostProcessStep[]).forEach(key => {
      if (config.postProcessing[key].enabled && !config.postProcessing[key].expanded) {
        onPostProcessExpandedChange(key, true);
      }
    });
  };

  const collapsePostProcessPrompts = () => {
    (Object.keys(config.postProcessing) as PostProcessStep[]).forEach(key => {
      if (config.postProcessing[key].expanded) {
        onPostProcessExpandedChange(key, false);
      }
    });
  };

  const handleEnabledToggle = (enabled: boolean) => {
    onConfigChange({ ...config, enabled });
  };

  const handleSegmentToggle = (segment: SegmentStep) => (enabled: boolean) => {
    onConfigChange({
      ...config,
      segments: {
        ...config.segments,
        [segment]: { ...config.segments[segment], enabled },
      },
    });
  };

  const handlePostProcessingToggle = (step: PostProcessStep) => (enabled: boolean) => {
    onConfigChange({
      ...config,
      postProcessing: {
        ...config.postProcessing,
        [step]: { ...config.postProcessing[step], enabled },
      },
    });
  };

  const enabledSegmentCount = Object.values(config.segments).filter(v => v.enabled).length;
  const enabledPostProcessCount = Object.values(config.postProcessing).filter(v => v.enabled).length;
  const hasAnyEnabled = enabledSegmentCount > 0 || enabledPostProcessCount > 0;

  const segmentKeys = Object.keys(SEGMENT_LABELS) as SegmentStep[];
  const postProcessKeys = Object.keys(POST_PROCESSING_LABELS) as PostProcessStep[];

  return (
    <section className="bg-gray-800/50 rounded-lg shadow-lg">
      <div className="p-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold">4. Segmented Analysis Workflow <span className="text-yellow-400/80 text-sm font-normal">(Experimental)</span></h2>
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
        <div className="px-6 pb-6 space-y-4">
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="sa-enabled-toggle"
              checked={false}
              disabled={true}
              className="h-4 w-4 rounded border-gray-500 bg-gray-700 text-indigo-500 focus:ring-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <label htmlFor="sa-enabled-toggle" className="text-sm font-medium text-gray-500 cursor-not-allowed">
              Enable Segmented Analysis
            </label>
          </div>

          {config.enabled && (
            <div className="pl-7 space-y-4">
              {/* Segments Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-400">Segments (Step 1)</h3>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={expandSegmentPrompts}
                      className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      Expand All
                    </button>
                    <span className="text-gray-600">|</span>
                    <button
                      type="button"
                      onClick={collapseSegmentPrompts}
                      className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      Collapse All
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  {segmentKeys.map((key) => (
                    <div key={key} className="pl-2 border-l-2 border-gray-700">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            id={`segment-${key}`}
                            checked={config.segments[key].enabled}
                            onChange={(e) => handleSegmentToggle(key)(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-500 bg-gray-700 text-indigo-500 focus:ring-indigo-600"
                          />
                          <label htmlFor={`segment-${key}`} className="text-sm text-gray-300">
                            {SEGMENT_LABELS[key]}
                          </label>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleSegmentPrompt(key)}
                          className="text-xs text-gray-400 hover:text-gray-300 transition-colors flex items-center gap-1"
                        >
                          {config.segments[key].expanded ? '▼' : '▶'} Show Prompt
                        </button>
                      </div>
                      {config.segments[key].expanded && (
                        <div className="mt-2 space-y-2">
                          <div>
                            <label htmlFor={`segment-prompt-${key}`} className="block text-xs font-medium text-gray-400 mb-1">
                              System Prompt
                            </label>
                            <textarea
                              id={`segment-prompt-${key}`}
                              value={config.segments[key].systemPrompt}
                              onChange={(e) => onSegmentPromptChange(key, e.target.value)}
                              className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-h-[120px] text-sm text-gray-200"
                              rows={8}
                            />
                          </div>
                          <div>
                            <label htmlFor={`segment-temp-${key}`} className="block text-xs font-medium text-gray-400 mb-1">
                              Temperature: {config.segments[key].temperature}
                            </label>
                            <input
                              id={`segment-temp-${key}`}
                              type="number"
                              min="0"
                              max="2"
                              step="0.1"
                              value={config.segments[key].temperature}
                              onChange={(e) => onSegmentTemperatureChange(key, parseFloat(e.target.value))}
                              className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-gray-200"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Post-Processing Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-400">Post-Processing (Step 2-4)</h3>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={expandPostProcessPrompts}
                      className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      Expand All
                    </button>
                    <span className="text-gray-600">|</span>
                    <button
                      type="button"
                      onClick={collapsePostProcessPrompts}
                      className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      Collapse All
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  {postProcessKeys.map((key) => (
                    <div key={key} className="pl-2 border-l-2 border-gray-700">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            id={`postprocess-${key}`}
                            checked={config.postProcessing[key].enabled}
                            onChange={(e) => handlePostProcessingToggle(key)(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-500 bg-gray-700 text-indigo-500 focus:ring-indigo-600"
                          />
                          <label htmlFor={`postprocess-${key}`} className="text-sm text-gray-300">
                            {POST_PROCESSING_LABELS[key]}
                          </label>
                        </div>
                        <button
                          type="button"
                          onClick={() => onPostProcessExpandedChange(key, !config.postProcessing[key].expanded)}
                          className="text-xs text-gray-400 hover:text-gray-300 transition-colors flex items-center gap-1"
                        >
                          {config.postProcessing[key].expanded ? '▼' : '▶'} Show Prompt
                        </button>
                      </div>
                      {config.postProcessing[key].expanded && (
                        <div className="mt-2">
                          <label htmlFor={`postprocess-prompt-${key}`} className="block text-xs font-medium text-gray-400 mb-1">
                            System Prompt
                          </label>
                          <textarea
                            id={`postprocess-prompt-${key}`}
                            value={config.postProcessing[key].prompt}
                            onChange={(e) => onPostProcessPromptChange(key, e.target.value)}
                            className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-h-[120px] text-sm text-gray-200"
                            rows={8}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            )}

            {!hasAnyEnabled && (
              <p className="text-xs text-yellow-400">
                Warning: At least one segment or post-processing step should be enabled.
              </p>
            )}
          </div>
        )}
      </section>
  );
};

export default SegmentedAnalysisPanel;
