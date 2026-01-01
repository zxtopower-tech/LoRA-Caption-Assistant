import React, { useEffect, useState, useRef } from 'react';
import type { MediaFile, ComfyPreviewParams } from '../types';
import { GenerationStatus } from '../types';
import { SparklesIcon, WandIcon, ImageIcon, ClockIcon, EditIcon, Spinner } from './Icons';
import { buildMetadataLabel } from '../utils/mediaMetadata';
import { FileHistorySidePanel } from './FileHistorySidePanel';
import { useComfyPreview as useComfyPreviewContext } from '../contexts/ComfyPreviewContext';
import { useToast } from '../hooks/useToast';
import { MediaImageSection } from './MediaImageSection';


interface MediaModalProps {
  isOpen: boolean;
  item: MediaFile | null;
  index: number;
  totalCount: number;
  caption: string;
  customInstructions: string;
  captionInputRef: React.RefObject<HTMLTextAreaElement>;
  onCaptionChange: (value: string) => void;
  onCustomInstructionsChange: (value: string) => void;
  onGenerate?: (id: string, customInstructions?: string) => void;
  hasValidConfig?: boolean;
  onClose: (currentCaption?: string, currentInstructions?: string) => void;
  onPrev: (currentCaption?: string, currentInstructions?: string) => void;
  onNext: (currentCaption?: string, currentInstructions?: string) => void;
  hasPrev: boolean;
  hasNext: boolean;
  comfyEnabled?: boolean;
  onComfyPreview?: (id: string, caption: string, params?: ComfyPreviewParams) => void;
  projectId?: string | null;

  onFileRestore?: (itemId: string, timestamp: string, type: 'original' | 'caption' | 'preview', content?: string) => void;
  onRename?: (id: string, newName: string) => Promise<void>;
}

const MediaModal: React.FC<MediaModalProps> = ({
  isOpen,
  item,
  index,
  totalCount,
  caption,
  customInstructions,
  captionInputRef,
  onCaptionChange,
  onCustomInstructionsChange,
  onGenerate,
  hasValidConfig,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  comfyEnabled,
  onComfyPreview,
  projectId,

  onFileRestore,
  onRename,
}) => {
  // ComfyPreview context for workflow mode and current parameters
  const { workflowMode, getCurrentParams } = useComfyPreviewContext();
  const { error: toastError } = useToast();

  // Hooks must be called before any early returns
  const comfyPreviewUrlRef = React.useRef<string | null>(null);
  const [comfyPreviewUrl, setComfyPreviewUrl] = React.useState<string | null>(null);
  // ref for caching previewFile - reuse URL for the same file
  const previewFileCacheRef = React.useRef<File | null>(null);

  // File history panel state
  const [fileHistoryOpen, setFileHistoryOpen] = useState(false);
  const isRestoringRef = useRef(false);



  // Rename state
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  const modalOpenRef = useRef<boolean>(false);

  // ComfyUI parameters local state (initial values from context)
  const currentParams = getCurrentParams();
  const [localSeed, setLocalSeed] = useState(currentParams.seed);
  const [localSteps, setLocalSteps] = useState(currentParams.steps);
  const [localStepsMin, setLocalStepsMin] = useState(currentParams.stepsMin);
  const [localStepsMax, setLocalStepsMax] = useState(currentParams.stepsMax);
  const [localSeedLow, setLocalSeedLow] = useState(currentParams.seedLow);
  const [localSeedHigh, setLocalSeedHigh] = useState(currentParams.seedHigh);

  // ComfyUI parameter initialization: execute only on first modal open
  useEffect(() => {
    if (!isOpen) return;

    // First open if modalOpenRef is false
    if (modalOpenRef.current !== isOpen) {
      const params = getCurrentParams();
      setLocalSeed(params.seed);
      setLocalSteps(params.steps);
      setLocalStepsMin(params.stepsMin);
      setLocalStepsMax(params.stepsMax);
      setLocalSeedLow(params.seedLow);
      setLocalSeedHigh(params.seedHigh);
      modalOpenRef.current = isOpen;
    }

    // Reset rename state when item changes
    if (item) {
      setRenameValue(item.name);
      setIsRenaming(false);
    }
  }, [isOpen, getCurrentParams, item]);

  // Handle modal close
  const handleModalClose = () => {
    modalOpenRef.current = false;
    onClose(caption, customInstructions);
  };

  // Create blob URL for ComfyUI preview file
  React.useEffect(() => {
    if (!item?.previewFile) {
      comfyPreviewUrlRef.current = null;
      previewFileCacheRef.current = null;
      setComfyPreviewUrl(null);
      return;
    }

    // Reuse URL if it's the same previewFile (caching)
    if (previewFileCacheRef.current === item.previewFile && comfyPreviewUrlRef.current) {
      setComfyPreviewUrl(comfyPreviewUrlRef.current);
      return;
    }

    // Generate URL only if it's a new previewFile
    if (comfyPreviewUrlRef.current) {
      URL.revokeObjectURL(comfyPreviewUrlRef.current);
    }
    const url = URL.createObjectURL(item.previewFile);
    comfyPreviewUrlRef.current = url;
    previewFileCacheRef.current = item.previewFile;
    setComfyPreviewUrl(url);

    return () => {
      if (comfyPreviewUrlRef.current) {
        URL.revokeObjectURL(comfyPreviewUrlRef.current);
        comfyPreviewUrlRef.current = null;
      }
      previewFileCacheRef.current = null;
    };
  }, [item?.previewFile, item?.comfyPreviewStatus]);

  React.useEffect(() => {
    // Prevent body scroll when modal is open
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isTextInput =
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLInputElement;

      if (event.key === 'Escape') {
        if (captionInputRef.current && activeElement === captionInputRef.current) {
          captionInputRef.current.blur();
          event.preventDefault();
          return;
        }
        // Close file history panel first if open, otherwise close modal
        if (fileHistoryOpen) {
          setFileHistoryOpen(false);
          event.preventDefault();
          return;
        }
        handleModalClose();
        event.preventDefault();
        return;
      }

      if (event.key === 'ArrowLeft' && !isTextInput && hasPrev) {
        onPrev(caption, customInstructions);
        event.preventDefault();
        return;
      }

      if (event.key === 'ArrowRight' && !isTextInput && hasNext) {
        onNext(caption, customInstructions);
        event.preventDefault();
        return;
      }

      if (event.key === 'Enter' && !isTextInput && captionInputRef.current) {
        captionInputRef.current.focus();
        event.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    isOpen,
    captionInputRef,
    handleModalClose,
    onPrev,
    onNext,
    hasPrev,
    hasNext,
    fileHistoryOpen,
  ]);

  if (!isOpen || !item) return null;

  const isVideo = item.type.startsWith('video/');
  const typeLabel = isVideo ? 'Video' : 'Image';
  const metadataLabel = item.metadata ? buildMetadataLabel(item.metadata, isVideo) : '';
  const isMetadataLoading = item.metadataStatus === 'loading';
  const isProcessing = item.status === GenerationStatus.GENERATING || item.status === GenerationStatus.CHECKING;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-7xl rounded-lg bg-gray-800 p-4 shadow-2xl max-h-[90vh] h-[85vh] overflow-hidden flex flex-col"
      >
        <div className="flex flex-col gap-4 min-h-0 flex-1 overflow-hidden">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            {isRenaming ? (
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={() => {
                  if (item && onRename && renameValue.trim() && renameValue !== item.name) {
                    onRename(item.id, renameValue).catch(() => setRenameValue(item.name));
                  }
                  setIsRenaming(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.currentTarget.blur();
                  } else if (e.key === 'Escape') {
                    setRenameValue(item.name);
                    setIsRenaming(false);
                  }
                }}
                autoFocus
                className="text-sm bg-gray-700 text-white rounded px-2 py-1 w-full md:w-64 border border-blue-500 outline-none"
              />
            ) : (
              <div className="flex items-center gap-2 group min-w-0">
                {item.id.match(/^\d{13,}-[a-z0-9]+$/) && (
                  <span className="text-xs text-green-400 font-mono bg-green-900/50 px-2 py-1 rounded shrink-0">NEW</span>
                )}
                <p
                  className="text-sm text-gray-300 truncate cursor-pointer hover:text-white"
                  title="Click to rename"
                  onClick={() => setIsRenaming(true)}
                >
                  {item.name}
                </p>
                <button
                  onClick={() => setIsRenaming(true)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-700 rounded transition-all"
                  title="Rename"
                >
                  <EditIcon className="w-3 h-3 text-gray-400" />
                </button>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
              <span>{typeLabel}</span>
              {item.qualityScore !== undefined && (
                <span>Quality: {item.qualityScore}/5</span>
              )}
              <span>Status: {item.status}</span>
              <span className="text-xs text-gray-500 font-mono bg-gray-900 px-2 py-1 rounded">
                {index + 1}/{totalCount}
              </span>
              {projectId && (
                <button
                  onClick={() => setFileHistoryOpen(true)}
                  className="p-1 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
                  title="View file history"
                >
                  <ClockIcon className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <MediaImageSection item={item} comfyPreviewUrl={comfyPreviewUrl} />

          {(metadataLabel || isMetadataLoading) && (
            <div className="text-xs text-gray-400">
              {metadataLabel || 'Metadata pending...'}
            </div>
          )}

          <textarea
            ref={captionInputRef}
            value={caption}
            onChange={(event) => {
              const newCaption = event.target.value;
              onCaptionChange(newCaption);
            }}
            className="h-32 w-full resize-none rounded-md border border-gray-700 bg-gray-900 p-3 text-sm text-gray-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
            placeholder="Edit caption..."
          />

          {/* Row 1: Custom Instructions + Generate Button */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Custom instructions for refinement..."
              value={customInstructions}
              onChange={(e) => onCustomInstructionsChange(e.target.value)}
              className="flex-grow p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
            />
            <button
              onClick={() => onGenerate && onGenerate(item.id, customInstructions)}
              disabled={isProcessing || !hasValidConfig}
              className="flex items-center justify-center px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing ? (
                <Spinner size="md" />
              ) : (
                customInstructions ? <WandIcon className="w-5 h-5" /> : <SparklesIcon className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* Row 2: ComfyUI Parameters + Preview Button */}
          {comfyEnabled && (
            <div className="flex flex-wrap gap-2 items-center">
              {/* Seed Parameters */}
              {workflowMode === 'full_multi' ? (
                <>
                  <div className="flex-1 min-w-[120px] relative">
                    <input
                      id="modal-seed-high"
                      type="number"
                      value={localSeedHigh}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val) && (val >= 0 || val === -1)) {
                          setLocalSeedHigh(val);
                        }
                      }}
                      className="peer w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
                      placeholder="-1 for random"
                    />
                    <label
                      htmlFor="modal-seed-high"
                      className="absolute left-2 -top-2.5 text-xs text-gray-400 bg-gray-800 px-1 peer-focus:text-orange-500 pointer-events-none"
                    >
                      Seed High
                    </label>
                  </div>
                  <div className="flex-1 min-w-[120px] relative">
                    <input
                      id="modal-seed-low"
                      type="number"
                      value={localSeedLow}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val) && (val >= 0 || val === -1)) {
                          setLocalSeedLow(val);
                        }
                      }}
                      className="peer w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
                      placeholder="-1 for random"
                    />
                    <label
                      htmlFor="modal-seed-low"
                      className="absolute left-2 -top-2.5 text-xs text-gray-400 bg-gray-800 px-1 peer-focus:text-orange-500 pointer-events-none"
                    >
                      Seed Low
                    </label>
                  </div>
                </>
              ) : (
                <div className="flex-1 min-w-[120px] relative">
                  <input
                    id="modal-seed"
                    type="number"
                    value={localSeed}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val) && (val >= 0 || val === -1)) {
                        setLocalSeed(val);
                      }
                    }}
                    className="peer w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
                    placeholder="-1 for random"
                  />
                  <label
                    htmlFor="modal-seed"
                    className="absolute left-2 -top-2.5 text-xs text-gray-400 bg-gray-800 px-1 peer-focus:text-orange-500 pointer-events-none"
                  >
                    Seed
                  </label>
                </div>
              )}

              {/* Steps Parameters */}
              {workflowMode === 'single' ? (
                <div className="flex-1 min-w-[120px] relative">
                  <input
                    id="modal-steps"
                    type="number"
                    value={localSteps}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val) && val >= 1) {
                        setLocalSteps(val);
                      }
                    }}
                    className="peer w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
                    placeholder=" "
                    min="1"
                    max="50"
                  />
                  <label
                    htmlFor="modal-steps"
                    className="absolute left-2 -top-2.5 text-xs text-gray-400 bg-gray-800 px-1 peer-focus:text-orange-500 pointer-events-none"
                  >
                    Steps
                  </label>
                </div>
              ) : (
                <>
                  <div className="flex-1 min-w-[120px] relative">
                    <input
                      id="modal-steps-min"
                      type="number"
                      value={localStepsMin}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val) && val >= 1) {
                          setLocalStepsMin(val);
                        }
                      }}
                      className="peer w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
                      placeholder=" "
                      min="1"
                      max="50"
                    />
                    <label
                      htmlFor="modal-steps-min"
                      className="absolute left-2 -top-2.5 text-xs text-gray-400 bg-gray-800 px-1 peer-focus:text-orange-500 pointer-events-none"
                    >
                      Steps Min
                    </label>
                  </div>
                  <div className="flex-1 min-w-[120px] relative">
                    <input
                      id="modal-steps-max"
                      type="number"
                      value={localStepsMax}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val) && val >= 1) {
                          setLocalStepsMax(val);
                        }
                      }}
                      className="peer w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
                      placeholder=" "
                      min="1"
                      max="50"
                    />
                    <label
                      htmlFor="modal-steps-max"
                      className="absolute left-2 -top-2.5 text-xs text-gray-400 bg-gray-800 px-1 peer-focus:text-orange-500 pointer-events-none"
                    >
                      Steps Max
                    </label>
                  </div>
                </>
              )}

              {/* Preview Button - Fixed on right */}
              <button
                onClick={() => {
                  const params: ComfyPreviewParams = {};
                  if (workflowMode === 'full_multi') {
                    params.seedHigh = localSeedHigh;
                    params.seedLow = localSeedLow;
                    params.stepsMin = localStepsMin;
                    params.stepsMax = localStepsMax;
                  } else if (workflowMode === 'multi_steps') {
                    params.seed = localSeed;
                    params.stepsMin = localStepsMin;
                    params.stepsMax = localStepsMax;
                  } else {
                    params.seed = localSeed;
                    params.steps = localSteps;
                  }
                  onComfyPreview && onComfyPreview(item.id, caption, params);
                }}
                disabled={!caption || item.comfyPreviewStatus === 'generating'}
                className="flex items-center justify-center px-3 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
                style={{ marginLeft: 'auto' }}
              >
                {item.comfyPreviewStatus === 'generating' ? (
                  <Spinner size="md" />
                ) : (
                  <ImageIcon className="w-5 h-5" />
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={handleModalClose}
        className="fixed right-6 top-6 rounded-md bg-gray-800 px-2 py-1 text-sm text-gray-200 hover:bg-gray-700"
        aria-label="Close"
      >
        X
      </button>

      <button
        type="button"
        onClick={() => onPrev(caption, customInstructions)}
        disabled={!hasPrev}
        className="fixed left-4 top-1/2 -translate-y-1/2 rounded-full bg-gray-800/80 px-3 py-2 text-lg text-gray-100 hover:bg-gray-700 disabled:opacity-40"
        aria-label="Previous media"
      >
        {'<'}
      </button>

      <button
        type="button"
        onClick={() => onNext(caption, customInstructions)}
        disabled={!hasNext}
        className="fixed right-4 top-1/2 -translate-y-1/2 rounded-full bg-gray-800/80 px-3 py-2 text-lg text-gray-100 hover:bg-gray-700 disabled:opacity-40"
        aria-label="Next media"
      >
        {'>'}
      </button>

      {/* File History Side Panel */}
      {item && (
        <FileHistorySidePanel
          isOpen={fileHistoryOpen}
          onClose={() => setFileHistoryOpen(false)}
          projectId={projectId ?? null}
          itemId={item.id}
          fileName={item.name}
          refreshTrigger={item.comfyPreviewStatus === 'completed' ? Date.now() : undefined}
          onRestore={async (timestamp, type, content) => {
            // Set restoring flag to prevent auto-save
            isRestoringRef.current = true;

            try {
              if (type === 'caption' && content) {
                onCaptionChange(content);
              } else if (type === 'original' || type === 'preview') {
                // Pass timestamp to parent handler to handle restore
                onFileRestore?.(item.id, timestamp, type);
              }
            } catch (err) {
              toastError('Failed to restore version');
            } finally {
              // Clear restoring flag after delay
              setTimeout(() => {
                isRestoringRef.current = false;
              }, 600);
            }
          }}
        />
      )}
    </div>
  );
};

export default MediaModal;
