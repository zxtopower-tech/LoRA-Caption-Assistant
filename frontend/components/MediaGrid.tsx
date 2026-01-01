import React from 'react';
import type { MediaFile } from '../types';
import MediaItem from './MediaItem';
import type { ReactNode } from 'react';

interface MediaGridProps {
  mediaFiles: MediaFile[];
  autofitTextareas: boolean;
  hasValidConfig: boolean;
  onGenerate: (id: string, customInstructions?: string) => void;
  onCaptionChange: (id: string, caption: string) => void;
  onCustomInstructionsChange: (id: string, instructions: string) => void;
  onSelectionChange: (id: string, isSelected: boolean) => void;
  onPreview: (item: MediaFile) => void;
  comfyEnabled: boolean;
  onComfyPreview: (id: string) => void;
  onDelete: (id: string) => void;
  actionBar?: ReactNode;
  projectId?: string | null;
  onFilesDrop?: (files: File[]) => void;
}

const MediaGrid: React.FC<MediaGridProps> = ({
  mediaFiles,
  autofitTextareas,
  hasValidConfig,
  onGenerate,
  onCaptionChange,
  onCustomInstructionsChange,
  onSelectionChange,
  onPreview,
  comfyEnabled,
  onComfyPreview,
  onDelete,
  actionBar,
  onFilesDrop,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0 && onFilesDrop) {
      onFilesDrop(Array.from(files));
    }
    // Reset input value to allow selecting the same file again
    e.target.value = '';
  };

  return (
  <section>
    {actionBar}
    <div className="bg-gray-800/50 rounded-lg shadow-lg p-6 mt-4">
      {mediaFiles.length === 0 ? (
        <>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={handleClick}
            className="w-full bg-gray-900/50 p-12 rounded-lg border-2 border-dashed border-gray-600 text-center hover:border-gray-500 hover:bg-gray-900/70 transition-colors cursor-pointer"
          >
            <svg className="mx-auto h-16 w-16 text-gray-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <h3 className="text-lg font-medium text-gray-300 mb-2">No media files yet</h3>
            <p className="text-sm text-gray-500">Click to browse or drag and drop images or videos anywhere on the page to upload</p>
          </button>
        </>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mediaFiles.map((item, index) => (
            <MediaItem
              key={item.id}
              item={item}
              index={index}
              totalCount={mediaFiles.length}
              autofit={autofitTextareas}
              isApiKeySet={hasValidConfig}
              onGenerate={onGenerate}
              onCaptionChange={onCaptionChange}
              onCustomInstructionsChange={onCustomInstructionsChange}
              onSelectionChange={onSelectionChange}
              onPreview={onPreview}
              comfyEnabled={comfyEnabled}
              onComfyPreview={onComfyPreview}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  </section>
  );
};

export default MediaGrid;
