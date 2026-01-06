import React from 'react';
import type { MediaFile } from '../types';
import { DownloadIcon, Spinner } from './Icons';

interface MediaImageSectionProps {
  item: MediaFile;
  comfyPreviewUrl: string | null;
  projectId?: string | null;
  onDownloadImage?: (type: 'original' | 'preview') => void;
}

export const MediaImageSection: React.FC<MediaImageSectionProps> = React.memo(({
  item,
  comfyPreviewUrl,
  projectId,
  onDownloadImage,
}) => {
  const isVideo = item.type.startsWith('video/');

  return (
    <div className="rounded-md bg-black/60 p-2 overflow-hidden min-h-0 flex-1 flex flex-col">
      {item.previewFile || item.comfyPreviewStatus === 'generating' ? (
        // Preview exists or generating: 2-column grid layout
        <div className="grid grid-cols-2 gap-4 min-h-0 flex-1 overflow-hidden">
          {/* Original image */}
          <div className="relative flex items-center justify-center rounded-md overflow-hidden min-h-0">
            {isVideo ? (
              <video
                src={item.files?.original || item.originalUrl}
                controls
                className="max-w-full max-h-full object-contain rounded-md"
              />
            ) : (
              <img
                src={item.files?.original || item.originalUrl}
                alt="Original"
                className="max-w-full max-h-full object-contain rounded-md"
              />
            )}
            <span className="absolute bottom-0 left-0 text-xs text-gray-400 bg-black/50 px-1">Original</span>
          </div>

          {/* Right section - Loading spinner or preview image */}
          {comfyPreviewUrl ? (
            // Preview exists: Show preview
            <div className="relative flex items-center justify-center rounded-md overflow-hidden min-h-0">
              <img
                src={comfyPreviewUrl}
                alt={`${item.name} (preview)`}
                className="max-w-full max-h-full object-contain rounded-md"
              />
              {item.comfyPreviewStatus === 'generating' && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                  <div className="flex flex-col items-center gap-3">
                    <Spinner size="xl" className="text-orange-500" />
                    <span className="text-base text-white font-medium">Generating ComfyUI preview...</span>
                  </div>
                </div>
              )}
              <span className="absolute bottom-0 left-0 text-xs text-gray-400 bg-black/50 px-1">ComfyUI Preview</span>
            </div>
          ) : (
            // No preview: Separate loading area
            <div className="flex items-center justify-center bg-gray-800/50 rounded-lg min-h-0">
              <div className="flex flex-col items-center gap-3">
                <Spinner size="xl" className="text-orange-500" />
                <span className="text-base text-gray-400">Generating ComfyUI preview...</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        // Before generation: Show original image only
        <div className="relative flex items-center justify-center rounded-md overflow-hidden min-h-0 flex-1">
          {isVideo ? (
            <video
              src={item.files?.original || item.originalUrl || item.previewUrl}
              controls
              className="max-w-full max-h-full object-contain rounded-md"
            />
          ) : (
            <img
              src={item.files?.original || item.originalUrl || item.previewUrl}
              alt={item.name}
              className="max-w-full max-h-full object-contain rounded-lg"
            />
          )}
        </div>
      )}
    </div>
  );
});

MediaImageSection.displayName = 'MediaImageSection';
