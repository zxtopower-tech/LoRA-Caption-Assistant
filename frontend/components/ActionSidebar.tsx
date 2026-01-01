import React from 'react';
import { CheckCircleIcon, DownloadIcon, SparklesIcon, TrashIcon, ImageIcon, SortAscIcon } from './Icons';

interface ActionSidebarProps {
  hasValidConfig: boolean;
  mediaCount: number;
  selectedCount: number;
  captionedCount: number;
  allSelected: boolean;
  isIndeterminate: boolean;
  onSelectAll: (checked: boolean) => void;
  onGenerateAll: () => void;
  onGenerateSelected: () => void;
  onCheckQuality: () => void;
  onDownload: () => void;
  onDelete: () => void;
  comfyEnabled?: boolean;
  onPreviewAll?: () => void;
  onSortItems?: () => void;
  isProcessing?: boolean;
}

const ActionSidebar: React.FC<ActionSidebarProps> = ({
  hasValidConfig,
  mediaCount,
  selectedCount,
  captionedCount,
  allSelected,
  isIndeterminate,
  onSelectAll,
  onGenerateAll,
  onGenerateSelected,
  onCheckQuality,
  onDownload,
  onDelete,
  comfyEnabled = false,
  onPreviewAll,
  onSortItems,
  isProcessing = false,
}) => {
  const canPreviewAll = comfyEnabled && captionedCount > 0;
  const isPreviewAllDisabled = !canPreviewAll || isProcessing;

  return (
    <div className="fixed right-0 top-0 h-full w-14 bg-gray-800/95 backdrop-blur-sm border-l border-gray-700 shadow-lg flex flex-col items-center py-4 gap-3 z-40">
      {/* All Section */}
      <div className="flex flex-col items-center gap-2 p-2 bg-gray-700/50 rounded-lg w-12">
        <span className="text-[10px] text-gray-400 font-medium text-center">All</span>
        <button
          onClick={onGenerateAll}
          disabled={!hasValidConfig || mediaCount === 0}
          className="flex items-center justify-center w-10 h-10 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
          title={!hasValidConfig ? 'Please check provider settings' : `Generate captions for all (${mediaCount})`}
        >
          <SparklesIcon className="w-4 h-4" />
        </button>
        {onPreviewAll && (
          <button
            onClick={onPreviewAll}
            disabled={isPreviewAllDisabled}
            className="flex items-center justify-center w-10 h-10 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:bg-gray-500 disabled:cursor-not-allowed disabled:hover:bg-gray-500 transition-colors"
            title={isProcessing ? 'Wait for current processing to finish' : `Generate ComfyUI previews for all (${captionedCount})`}
          >
            <ImageIcon className="w-4 h-4" />
          </button>
        )}
        {onSortItems && (
          <button
            onClick={onSortItems}
            disabled={mediaCount === 0}
            className="flex items-center justify-center w-10 h-10 bg-gray-600 text-white rounded-md hover:bg-gray-500 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
            title="Sort items by filename"
          >
            <SortAscIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="w-8 h-px bg-gray-600" />

      {/* Selected Section */}
      <div className="flex flex-col items-center gap-2 p-2 bg-gray-700/50 rounded-lg w-12">
        <span className="text-[10px] text-gray-400 font-medium text-center">{selectedCount}/{mediaCount}</span>
        <input
          ref={(input) => {
            if (input) {
              input.indeterminate = isIndeterminate;
            }
          }}
          type="checkbox"
          checked={allSelected}
          onChange={() => onSelectAll(!allSelected)}
          className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-indigo-600 cursor-pointer focus:outline-none"
          title={allSelected ? 'Deselect All' : 'Select All'}
        />
        <button
          onClick={onGenerateSelected}
          disabled={!hasValidConfig || selectedCount === 0}
          className="flex items-center justify-center w-10 h-10 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
          title={!hasValidConfig ? 'Please check provider settings' : `Generate captions for selected (${selectedCount})`}
        >
          <SparklesIcon className="w-4 h-4" />
        </button>
        <button
          onClick={onCheckQuality}
          disabled={!hasValidConfig || selectedCount === 0}
          className="flex items-center justify-center w-10 h-10 bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
          title={!hasValidConfig ? 'Please check provider settings' : `Check quality for selected (${selectedCount})`}
        >
          <CheckCircleIcon className="w-4 h-4" />
        </button>
        <button
          onClick={onDownload}
          disabled={selectedCount === 0}
          className="flex items-center justify-center w-10 h-10 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
          title={`Download selected (${selectedCount})`}
        >
          <DownloadIcon className="w-4 h-4" />
        </button>
        <button
          onClick={onDelete}
          disabled={selectedCount === 0}
          className="flex items-center justify-center w-10 h-10 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
          title={`Delete selected (${selectedCount})`}
        >
          <TrashIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default ActionSidebar;
