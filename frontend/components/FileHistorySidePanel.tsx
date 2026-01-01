import React, { useState, useEffect } from 'react';
import { getMediaItemHistory } from '../services/projectService';
import type { MediaItemHistoryEntry } from '../types';
import { XIcon, Spinner } from './Icons';
import { useToast } from '../hooks/useToast';

interface FileHistorySidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string | null;
  itemId: string;
  fileName: string;
  refreshTrigger?: number;
  onRestore?: (timestamp: string, type: 'original' | 'caption' | 'preview', content?: string) => void;
}

export const FileHistorySidePanel: React.FC<FileHistorySidePanelProps> = ({
  isOpen,
  onClose,
  projectId,
  itemId,
  fileName,
  refreshTrigger,
  onRestore,
}) => {
  const [history, setHistory] = useState<MediaItemHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoringIndex, setRestoringIndex] = useState<number | null>(null);
  const { error: toastError, success: toastSuccess } = useToast();

  const originalFilename = fileName;

  // Load history when panel opens
  useEffect(() => {
    if (!isOpen || !projectId || !itemId) return;

    const loadHistory = async () => {
      setLoading(true);
      try {
        const entries = await getMediaItemHistory(projectId, itemId);
        setHistory(entries);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to load history';
        toastError(`Failed to load file history: ${errorMsg}`);
        setHistory([]);
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [isOpen, projectId, itemId, refreshTrigger, toastError]);

  // Helper function to get subtype icon and label
  const getSubtypeInfo = (subtype: MediaItemHistoryEntry['subtype']) => {
    switch (subtype) {
      case 'caption':
        return { icon: '🟢', label: 'Caption', color: 'text-green-400' };
      case 'preview':
        return { icon: '🟣', label: 'Preview', color: 'text-purple-400' };
      case 'original':
        return { icon: '🔵', label: 'Original', color: 'text-blue-400' };
      default:
        return { icon: '📄', label: 'File', color: 'text-gray-400' };
    }
  };

  // Format file size for display
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Parse timestamp (format: YYYYMMDD_HHMMSS_microseconds) to Date
  const parseTimestamp = (timestamp: string): Date | null => {
    const match = timestamp.match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
    if (!match) return null;
    const [, year, month, day, hour, minute, second] = match;
    return new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      parseInt(second)
    );
  };

  // Handle restore version file
  const handleRestoreVersion = async (entry: MediaItemHistoryEntry, index: number) => {
    if (!projectId || !itemId) return;
    const startTime = Date.now();

    // Set restoring state
    setRestoringIndex(index);

    try {
      if (entry.subtype === 'caption') {
        // For caption, use content_preview directly (already includes full content)
        onRestore?.(entry.timestamp, entry.subtype, entry.content_preview);
        // Show success toast with history index
        const totalEntries = history.length;
        const currentIndex = totalEntries - index;
        toastSuccess(`[${currentIndex}/${totalEntries}] Caption restored!`);
      } else {
        // For original/preview, just pass timestamp and type
        onRestore?.(entry.timestamp, entry.subtype);
      }
    } finally {
      // Ensure minimum 500ms loading state
      const elapsed = Date.now() - startTime;
      const remainingTime = Math.max(0, 500 - elapsed);
      setTimeout(() => {
        setRestoringIndex(null);
      }, remainingTime);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-[60] w-80 bg-gray-800 shadow-xl transform transition-transform">
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">File History</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* File name */}
        <div className="p-4 border-b border-gray-700">
          <p className="text-sm text-gray-400 truncate" title={originalFilename}>{originalFilename}</p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="flex items-center justify-center gap-2">
              <Spinner size="md" className="text-blue-400" />
              <p className="text-gray-400">Loading history...</p>
            </div>
          )}
          {!loading && history.length === 0 && (
            <p className="text-gray-400">No history available</p>
          )}
          {!loading && history.length > 0 && (
            <ul className="space-y-3">
              {history.map((entry, index) => {
                const subtypeInfo = getSubtypeInfo(entry.subtype);
                const showThumbnail = entry.subtype === 'original' || entry.subtype === 'preview';
                const showCaption = entry.subtype === 'caption' && entry.content_preview;
                const totalEntries = history.length;
                const currentIndex = totalEntries - index;

                return (
                  <li
                    key={entry.timestamp}
                    className="p-2 bg-gray-800 rounded-lg border border-gray-700"
                  >
                    {/* Row 1: Icon + Type + Extension Label | Page Counter + Delete */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{subtypeInfo.icon}</span>
                        <span className={`text-sm font-medium ${subtypeInfo.color}`}>
                          {subtypeInfo.label}
                        </span>
                        <span className="px-1.5 py-0.5 text-xs font-medium bg-gray-600 text-gray-300 rounded">
                          {entry.extension.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-gray-500 font-mono bg-gray-900 px-2 py-1 rounded">
                          {currentIndex}/{totalEntries}
                        </span>
                        {entry.is_available && (
                          <button
                            className="p-1 text-gray-300 bg-gray-700 hover:bg-red-600 rounded transition-colors"
                            title="Delete version"
                          >
                            <XIcon className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Row 2: Thumbnail / Caption */}
                    {(showThumbnail || showCaption) && (
                      <div className="mb-3">
                        {showThumbnail && entry.thumbnail_url && (
                          <div className="flex justify-center">
                            <img
                              src={entry.thumbnail_url}
                              alt={`${entry.subtype} thumbnail`}
                              className="w-32 h-32 rounded border border-gray-600 object-contain bg-gray-900"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          </div>
                        )}
                        {showCaption && (
                          <div
                            className="w-full p-2 bg-gray-900 rounded max-h-32 overflow-y-auto cursor-pointer"
                            onClick={() => {
                              const text = entry.content_preview || '';
                              // Fallback copy method
                              const textarea = document.createElement('textarea');
                              textarea.value = text;
                              textarea.style.position = 'fixed';
                              textarea.style.opacity = '0';
                              document.body.appendChild(textarea);
                              textarea.select();
                              document.execCommand('copy');
                              document.body.removeChild(textarea);
                              // Show success toast with history index
                              const totalEntries = history.length;
                              const currentIndex = totalEntries - index;
                              toastSuccess(`[${currentIndex}/${totalEntries}] Caption copied!`);
                            }}
                            title="Click to copy"
                          >
                            <p className="text-xs text-gray-300 text-left whitespace-pre-wrap break-words">
                              {entry.content_preview}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Row 3: File size · Date */}
                    <div className="flex items-center text-xs text-gray-400 mb-3">
                      <span>{formatFileSize(entry.size)}</span>
                      <span className="mx-2">·</span>
                      <span>{parseTimestamp(entry.timestamp)?.toLocaleString() || 'Invalid Date'}</span>
                    </div>

                    {/* Row 4: Restore button (full width, different background) */}
                    {entry.is_available && (
                      <button
                        onClick={() => handleRestoreVersion(entry, index)}
                        disabled={restoringIndex === index}
                        className="w-full py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed rounded flex items-center justify-center gap-2"
                        title={`Restore ${entry.subtype} version`}
                      >
                        {restoringIndex === index ? (
                          <Spinner size="sm" />
                        ) : (
                          'Restore'
                        )}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
