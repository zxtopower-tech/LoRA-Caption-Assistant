import React from 'react';
import type { MediaFile } from '../types';
import { GenerationStatus } from '../types';
import { SparklesIcon, WandIcon, XIcon, ImageIcon, DownloadIcon, Spinner } from './Icons';
import { buildMetadataLabel } from '../utils/mediaMetadata';
import { getMediaItemHistory, downloadVersionFile } from '../services/projectService';

interface MediaItemProps {
  item: MediaFile;
  index: number;
  totalCount: number;
  autofit: boolean;
  isApiKeySet: boolean;
  onGenerate: (id: string, customInstructions?: string) => void;
  onCaptionChange: (id: string, caption: string) => void;
  onCustomInstructionsChange: (id: string, instructions: string) => void;
  onSelectionChange: (id: string, isSelected: boolean) => void;
  onPreview: (item: MediaFile) => void;
  comfyEnabled: boolean;
  onComfyPreview: (id: string) => void;
  onDelete: (id: string) => void;
  projectId?: string | null;
}

const getScoreColor = (score?: number) => {
  if (score === undefined) return 'text-gray-500';
  if (score >= 4) return 'text-green-400';
  if (score >= 3) return 'text-yellow-400';
  return 'text-red-400';
};


const MediaItem: React.FC<MediaItemProps> = ({
  item,
  index,
  totalCount,
  autofit,
  isApiKeySet,
  onGenerate,
  onCaptionChange,
  onCustomInstructionsChange,
  onSelectionChange,
  onPreview,
  comfyEnabled,
  onComfyPreview,
  onDelete,
}) => {
  const isVideo = item.type.startsWith('video/');
  const metadataLabel = item.metadata ? buildMetadataLabel(item.metadata, isVideo) : '';
  const isMetadataLoading = item.metadataStatus === 'loading';
  const metadataText = metadataLabel || (isMetadataLoading ? 'Metadata pending...' : '');
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const comfyPreviewUrlRef = React.useRef<string | null>(null);
  const [comfyPreviewUrl, setComfyPreviewUrl] = React.useState<string | null>(null);

  // Create blob URL for ComfyUI preview file
  React.useEffect(() => {
    if (comfyPreviewUrlRef.current) {
      URL.revokeObjectURL(comfyPreviewUrlRef.current);
    }
    if (item.previewFile) {
      const url = URL.createObjectURL(item.previewFile);
      comfyPreviewUrlRef.current = url;
      setComfyPreviewUrl(url);
    } else {
      comfyPreviewUrlRef.current = null;
      setComfyPreviewUrl(null);
    }
    return () => {
      if (comfyPreviewUrlRef.current) {
        URL.revokeObjectURL(comfyPreviewUrlRef.current);
        comfyPreviewUrlRef.current = null;
      }
    };
  }, [item.previewFile, item.comfyPreviewStatus]);

  React.useEffect(() => {
    if (textareaRef.current && autofit) {
      textareaRef.current.style.height = 'auto'; // Reset height
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    } else if (textareaRef.current) {
      textareaRef.current.style.height = ''; // Revert to CSS-defined height
    }
  }, [item.caption, autofit]);

  const getStatusColor = () => {
    switch (item.status) {
      case GenerationStatus.SUCCESS: return 'border-green-500';
      case GenerationStatus.ERROR: return 'border-red-500';
      case GenerationStatus.GENERATING: return 'border-indigo-500';
      case GenerationStatus.CHECKING: return 'border-yellow-500';
      default: return 'border-gray-700';
    }
  };

  const isProcessing = item.status === GenerationStatus.GENERATING || item.status === GenerationStatus.CHECKING;

  return (
    <div className={`bg-gray-800 rounded-lg overflow-hidden border-2 transition-colors ${getStatusColor()}`}>
      <div className="relative p-2">
        <div className="flex items-center gap-3 mb-3">
          <input
            type="checkbox"
            checked={item.isSelected}
            onChange={(e) => onSelectionChange(item.id, e.target.checked)}
            className="h-6 w-6 bg-gray-900 border-gray-600 text-indigo-500 rounded focus:ring-indigo-600 z-10 shrink-0"
          />
          <div className="flex-grow flex items-center justify-between gap-3 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              {item.id.match(/^\d{13,}-[a-z0-9]+$/) && (
                <span className="text-xs text-green-400 font-mono bg-green-900/50 px-2 py-1 rounded shrink-0">NEW</span>
              )}
              <div className="flex flex-col min-w-0">
                <p className="text-sm text-gray-400 truncate" title={item.name}>{item.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-gray-500 font-mono bg-gray-900 px-2 py-1 rounded">
                {index + 1}/{totalCount}
              </span>
              <button
                type="button"
                onClick={() => onDelete(item.id)}
                className="p-1 text-gray-300 bg-gray-700 hover:bg-red-600 rounded transition-colors"
                aria-label={`Delete ${item.name}`}
                title="Delete this item"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
          {item.qualityScore !== undefined && (
            <div className="bg-gray-900/70 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1.5 z-10 shrink-0">
              <span className={`tracking-widest ${getScoreColor(item.qualityScore)}`}>
                {'★'.repeat(item.qualityScore)}{'☆'.repeat(5 - item.qualityScore)}
              </span>
              <span className="text-gray-300">{item.qualityScore}/5</span>
            </div>
          )}
        </div>
        {item.comfyPreviewStatus === 'generating' ? (
          // Generating: Preview + Overlay if available, otherwise just loading spinner
          <div className="grid grid-cols-2 gap-2">
            {/* Original image - always displayed */}<div className="relative rounded-md overflow-hidden max-w-full">
              {isVideo ? (
                <video src={item.files?.original || item.originalUrl || item.previewUrl} controls className="w-full h-64 object-contain rounded-md bg-gray-900" />
              ) : (
                <button
                  type="button"
                  onClick={() => onPreview(item)}
                  className="block w-full"
                  aria-label={`Open preview for ${item.name}`}
                >
                  <img src={item.files?.original || item.originalUrl || item.previewUrl} alt={item.name} className="w-full h-64 object-contain rounded-md" />
                </button>
              )}
              <span className="absolute bottom-0 left-0 text-xs text-gray-400 bg-black/50 px-1">Original</span>
            </div>

            {/* Right section - Loading spinner or preview image */}
            {comfyPreviewUrl ? (
              // If preview exists, show Preview + Overlay
              <div className="relative rounded-md overflow-hidden max-w-full">
                <img
                  src={comfyPreviewUrl}
                  alt={`${item.name} (preview)`}
                  className="w-full h-64 object-contain rounded-md"
                />
                {/* Loading overlay on top of preview image */}
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2">
                    <Spinner size="lg" className="text-orange-500" />
                    <span className="text-sm text-white font-medium">Generating preview...</span>
                  </div>
                </div>
              </div>
            ) : (
              // If no preview, separate loading spinner area
              <div className="flex items-center justify-center rounded-md max-w-full bg-gray-800/50 min-h-[200px]">
                <div className="flex flex-col items-center gap-2">
                  <Spinner size="lg" className="text-orange-500" />
                  <span className="text-sm text-gray-400">Generating preview...</span>
                </div>
              </div>
            )}
          </div>
        ) : comfyPreviewUrl ? (
          // Generation complete: 2-column grid layout
          <div className="grid grid-cols-2 gap-2">
            {/* Original image */}
            <div className="relative rounded-md overflow-hidden max-w-full">
              {isVideo ? (
                <video src={item.files?.original || item.originalUrl || item.previewUrl} controls className="w-full h-64 object-contain rounded-md bg-gray-900" />
              ) : (
                <button
                  type="button"
                  onClick={() => onPreview(item)}
                  className="block w-full"
                  aria-label={`Open preview for ${item.name}`}
                >
                  <img src={item.files?.original || item.originalUrl || item.previewUrl} alt={item.name} className="w-full h-64 object-contain rounded-md" />
                </button>
              )}
              <span className="absolute bottom-0 left-0 text-xs text-gray-400 bg-black/50 px-1">Original</span>
            </div>

            {/* Additional image when preview is complete */}
            <div className="relative rounded-md overflow-hidden max-w-full">
              <button
                type="button"
                onClick={() => onPreview(item)}
                className="block w-full"
                aria-label={`Open preview for ${item.name}`}
              >
                <img
                  src={comfyPreviewUrl}
                  alt={`${item.name} (preview)`}
                  className="w-full h-64 object-contain rounded-md"
                />
              </button>
              <span className="absolute bottom-0 left-0 text-xs text-gray-400 bg-black/50 px-1">ComfyUI Preview</span>
            </div>
          </div>
        ) : (
          // Before generation: Display original image only
          <div className="relative rounded-md overflow-hidden max-w-full">
            {isVideo ? (
              <video src={item.files?.original || item.originalUrl || item.previewUrl} controls className="w-full h-64 object-contain rounded-md bg-gray-900" />
            ) : (
              <button
                type="button"
                onClick={() => onPreview(item)}
                className="block w-full"
                aria-label={`Open preview for ${item.name}`}
              >
                <img src={item.files?.original || item.originalUrl || item.previewUrl} alt={item.name} className="w-full h-64 object-contain rounded-md" />
              </button>
            )}
          </div>
        )}
        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="text-xs text-gray-400">
            {metadataText}
          </div>
          <button
            type="button"
            onClick={() => onPreview(item)}
            className="shrink-0 rounded-md bg-gray-900/80 px-2 py-1 text-xs text-gray-100 hover:bg-gray-700"
            aria-label={`Open preview for ${item.name}`}
          >
            View
          </button>
        </div>
      </div>
      <div className="p-4 space-y-4">
        <textarea
          ref={textareaRef}
          value={item.caption}
          onChange={(e) => onCaptionChange(item.id, e.target.value)}
          placeholder="Generated caption will appear here..."
          rows={!autofit ? 6 : 1}
          className={`w-full p-2 bg-gray-900 border border-gray-700 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors resize-none overflow-y-auto ${!autofit ? 'h-32' : ''}`}
        />

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            placeholder="Custom instructions for refinement..."
            value={item.customInstructions}
            onChange={(e) => onCustomInstructionsChange(item.id, e.target.value)}
            className="flex-1 min-w-0 p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
          />
          <div className="flex gap-2">
            <button
              onClick={() => onGenerate(item.id, item.customInstructions)}
              disabled={isProcessing || !isApiKeySet}
              className="flex items-center justify-center px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing ? (
                <Spinner size="md" />
              ) : (
                item.customInstructions ? <WandIcon className="w-5 h-5" /> : <SparklesIcon className="w-5 h-5" />
              )}
            </button>
            <button
              onClick={() => onComfyPreview(item.id)}
              disabled={!comfyEnabled || !item.caption || item.comfyPreviewStatus === 'generating'}
              className="flex items-center justify-center px-3 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
            >
              {item.comfyPreviewStatus === 'generating' ? (
                <Spinner size="md" />
              ) : (
                <ImageIcon className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MediaItem;
