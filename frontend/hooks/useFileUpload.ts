import { useCallback, useRef } from 'react';
import type { MediaFile, MediaMetadata, MetadataStatus } from '../types';
import { GenerationStatus } from '../types';
import { extractBaseName } from '../utils/fileUtils';

export interface FileConflictInfo {
  conflictingFiles: File[];
  existingNames: string[];
}

const readImageMetadata = (file: File): Promise<Pick<MediaMetadata, 'width' | 'height'>> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to read image metadata.'));
    };
    img.src = url;
  });

const readVideoMetadata = (file: File): Promise<Pick<MediaMetadata, 'width' | 'height' | 'durationSec'>> =>
  new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    video.preload = 'metadata';

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve({
        width: video.videoWidth,
        height: video.videoHeight,
        durationSec: Number.isFinite(video.duration) ? video.duration : undefined,
      });
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to read video metadata.'));
    };

    video.src = url;
    video.load();
  });

// Extract files from ZIP archive with preview and caption separation
const extractZipFiles = async (zipFile: File): Promise<{
  mediaFiles: File[];
  previewFileMap: Map<string, File>;
  captionStringMap: Map<string, string>;
}> => {
  if (!window.JSZip) {
    return { mediaFiles: [], previewFileMap: new Map(), captionStringMap: new Map() };
  }

  try {
    const zip = new window.JSZip();
    const contents = await zip.loadAsync(zipFile);
    const mediaFiles: File[] = [];
    const previewFileMap = new Map<string, File>();
    const captionStringMap = new Map<string, string>();

    for (const [_path, zipEntry] of Object.entries(contents.files)) {
      // Skip directories
      if ((zipEntry as any).dir) continue;

      // Extract file content
      const blob = await (zipEntry as any).async('blob');
      const fileName = (zipEntry as any).name;

      // Check if this is a preview file (previews/ or preview/ folder at any level)
      // Matches: "previews/img.png", "folder/previews/img.png", "preview/img.png"
      const previewMatch = fileName.match(/(?:^|\/)(previews?)\/(.+)$/i);

      if (previewMatch) {
        // extract the part after "previews/" or "preview/"
        // previewMatch[2] contains the filename part relative to the preview folder
        const previewNameWithExt = previewMatch[2];

        // Get base name without extension for matching: "image01.png" -> "image01"
        const baseName = extractBaseName(previewNameWithExt);

        // Create preview file and store by base name
        const previewFile = new File([blob], previewNameWithExt, {
          type: blob.type || getMimeType(previewNameWithExt),
          lastModified: (zipEntry as any).date?.getTime() || Date.now(),
        });

        previewFileMap.set(baseName, previewFile);
        continue;
      }

      // Check if this is a caption file (.txt)
      if (fileName.toLowerCase().endsWith('.txt')) {
        // For caption files, we need to store the content as string
        // The filename mapping will be done in prepareMediaFiles
        const textContent = await blob.text();
        const baseName = extractBaseName(fileName);
        captionStringMap.set(baseName, textContent);
        continue;
      }

      // Create a new File object for media files
      const file = new File([blob], fileName, {
        type: blob.type || getMimeType(fileName),
        lastModified: (zipEntry as any).date?.getTime() || Date.now(),
      });

      mediaFiles.push(file);
    }

    return { mediaFiles, previewFileMap, captionStringMap };
  } catch (error) {
    console.error('[zip] Error extracting ZIP file:', error);
    return { mediaFiles: [], previewFileMap: new Map(), captionStringMap: new Map() };
  }
};

// Helper to determine MIME type from filename
const getMimeType = (filename: string): string => {
  const ext = filename.toLowerCase().split('.').pop();
  const mimeTypes: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'bmp': 'image/bmp',
    'svg': 'image/svg+xml',
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'mov': 'video/quicktime',
    'avi': 'video/x-msvideo',
    'mkv': 'video/x-matroska',
    'txt': 'text/plain',
  };
  return mimeTypes[ext || ''] || 'application/octet-stream';
};

interface UseFileUploadParams {
  setMediaFiles: React.Dispatch<React.SetStateAction<MediaFile[]>>;
  enqueueMetadataRequest: (id: string) => void;
  onConflictDetected?: (conflict: FileConflictInfo, confirmCallback: () => void, cancelCallback: () => void) => void;
  onZipProgressChange?: (isActive: boolean, progress: number, current: number, total: number) => void;
  selectedProjectId?: string | null;
}

export const useFileUpload = ({
  setMediaFiles,
  enqueueMetadataRequest,
  onConflictDetected,
  onZipProgressChange,
  selectedProjectId,
}: UseFileUploadParams) => {
  const pendingFilesRef = useRef<File[] | null>(null);

  // Extract file preparation logic as a standalone function for reuse
  const prepareMediaFiles = useCallback(async (
    files: File[],
    previewFileMap?: Map<string, File>,
    captionStringMap?: Map<string, string>,
    idMap?: Map<string, string>,
    datasetPrefix?: string,
    startIndex?: number,
    selectedProjectId?: string | null
  ) => {
    const mediaUploads = files.filter(file => file.type.startsWith('image/') || file.type.startsWith('video/'));
    const captionUploads = files.filter(file => file.name.toLowerCase().endsWith('.txt'));

    // Sort media files by name (while preserving pairing with caption files)
    mediaUploads.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
    captionUploads.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

    const captionFileMap = new Map<string, File>();
    captionUploads.forEach(file => {
      const baseName = extractBaseName(file.name);
      captionFileMap.set(baseName.toLowerCase(), file);
    });

    const newMediaFilesPromises = mediaUploads.map(async (file, index): Promise<MediaFile> => {
      // Look up ID using baseName for consistent matching with project load
      const originalBaseName = extractBaseName(file.name);
      let id = idMap?.get(originalBaseName);
      if (!id) {
        // Always generate Frontend ID for Drag & Drop additions (replaced upon backend upload)
        id = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      }
      let caption = '';
      let status = GenerationStatus.IDLE;
      let errorMessage: string | undefined = undefined;
      let metadata: MediaMetadata | undefined = undefined;
      let metadataStatus: MetadataStatus = 'idle';
      let metadataError: string | undefined = undefined;

      // Generate filename with datasetPrefix if provided
      let displayFileName = file.name;
      if (datasetPrefix && startIndex !== undefined) {
        const isVideo = file.type.startsWith('video');
        const type = isVideo ? 'video' : 'image';
        const fileIndex = startIndex + index + 1;
        const baseFileName = `${datasetPrefix}_${type}${String(fileIndex).padStart(2, '0')}`;

        // Get the original file extension
        const extension = file.name.split('.').pop() || '';
        displayFileName = `${baseFileName}.${extension}`;
      }

      // Extract base name for caption/preview matching (filename without extension)
      const baseName = extractBaseName(displayFileName);
      const baseNameLower = baseName.toLowerCase();

      // Priority: Use captionStringMap (from project load) first, then caption files
      if (captionStringMap && captionStringMap.has(baseName)) {
        caption = captionStringMap.get(baseName) || '';
        status = GenerationStatus.SUCCESS;
      } else if (captionFileMap.has(baseNameLower)) {
        const captionFile = captionFileMap.get(baseNameLower)!;
        try {
          caption = await captionFile.text();
          status = GenerationStatus.SUCCESS;
        } catch (e) {
          console.error("Error reading caption file:", e);
          status = GenerationStatus.ERROR;
          errorMessage = "Failed to read caption file.";
        }
      }

      // Check if preview file exists in the map (by base name)
      let previewFile: File | undefined = undefined;
      if (previewFileMap && previewFileMap.size > 0) {
        previewFile = previewFileMap.get(baseName);
      }

      if (file.type.startsWith('image/')) {
        try {
          const imageMeta = await readImageMetadata(file);
          metadata = {
            ...imageMeta,
            sizeBytes: file.size,
          };
          metadataStatus = 'done';
        } catch (e) {
          console.error("Error reading image metadata:", e);
          metadataStatus = 'error';
          metadataError = 'Failed to read image metadata.';
        }
      } else if (file.type.startsWith('video/')) {
        try {
          const videoMeta = await readVideoMetadata(file);
          metadata = {
            ...videoMeta,
            sizeBytes: file.size,
          };
          metadataStatus = 'loading';
        } catch (e) {
          console.error("Error reading video metadata:", e);
          metadataStatus = 'error';
          metadataError = 'Failed to read video metadata.';
        }
      }

      return {
        id,
        url: '', // Will be set by backend after upload
        name: displayFileName, // Use the generated display filename
        type: file.type,
        size: file.size,
        file, // Keep file object for now (will be optional in Phase 2)
        originalUrl: URL.createObjectURL(file), // Always set originalUrl from source file
        previewUrl: previewFile ? URL.createObjectURL(previewFile) : '',
        caption,
        initialCaption: caption, // Initialize with current caption value
        status,
        isSelected: false,
        customInstructions: '',
        errorMessage,
        metadata,
        metadataStatus,
        previewFile,
        metadataError,
      };
    });

    const newMediaFiles = await Promise.all(newMediaFilesPromises);
    return newMediaFiles;
  }, []);

  const handleFilesAdded = useCallback(async (
    files: File[],
    currentMediaFiles: MediaFile[] = [],
    previewFileMap?: Map<string, File>,
    captionStringMap?: Map<string, string>,
    idMap?: Map<string, string>,
    datasetPrefix?: string,
    startIndex?: number
  ) => {
    // Check for ZIP files and extract them
    const zipFiles = files.filter(file =>
      file.name.toLowerCase().endsWith('.zip') ||
      file.type === 'application/zip' ||
      file.type === 'application/x-zip-compressed'
    );

    let allFilesToProcess = [...files];
    // Merge previewFileMap and captionStringMap from ZIP extraction
    let mergedPreviewFileMap = previewFileMap || new Map<string, File>();
    let mergedCaptionStringMap = captionStringMap || new Map<string, string>();

    if (zipFiles.length > 0) {
      // Start progress
      onZipProgressChange?.(true, 0, 0, zipFiles.length);

      // Extract all ZIP files with progress tracking
      const extractedResults: Array<{ mediaFiles: File[]; previewFileMap: Map<string, File>; captionStringMap: Map<string, string> }> = [];
      for (let i = 0; i < zipFiles.length; i++) {
        const result = await extractZipFiles(zipFiles[i]);
        extractedResults.push(result);
        const progress = ((i + 1) / zipFiles.length) * 100;
        onZipProgressChange?.(true, progress, i + 1, zipFiles.length);
      }

      // Merge all extracted results
      for (const result of extractedResults) {
        allFilesToProcess = [...allFilesToProcess, ...result.mediaFiles];
        // Merge previewFileMap (baseName -> File)
        for (const [baseName, file] of result.previewFileMap) {
          mergedPreviewFileMap.set(baseName, file);
        }
        // Merge captionStringMap (baseName -> string)
        for (const [baseName, content] of result.captionStringMap) {
          mergedCaptionStringMap.set(baseName, content);
        }
      }

      // Remove original ZIP files from processing
      allFilesToProcess = allFilesToProcess.filter(file =>
        !file.name.toLowerCase().endsWith('.zip') &&
        file.type !== 'application/zip' &&
        file.type !== 'application/x-zip-compressed'
      );

      // End progress
      onZipProgressChange?.(false, 100, zipFiles.length, zipFiles.length);
    }

    const mediaUploads = allFilesToProcess.filter(file => file.type.startsWith('image/') || file.type.startsWith('video/'));

    // Check for filename conflicts
    const existingFileNames = new Set(currentMediaFiles.map(f => f.name));
    const conflictingFiles = mediaUploads.filter(file => existingFileNames.has(file.name));

    // When loading from project with conflicts, auto-replace without modal
    if (conflictingFiles.length > 0 && idMap) {
      const conflictingNames = new Set(conflictingFiles.map(f => f.name));

      // Prepare the new files
      const newMediaFiles = await prepareMediaFiles(allFilesToProcess, mergedPreviewFileMap, mergedCaptionStringMap, idMap, datasetPrefix, startIndex, selectedProjectId);

      // Update state in one go (remove conflicts + add new)
      setMediaFiles(prev => {
        const filtered = prev.filter(f => !conflictingNames.has(f.name));
        return [...filtered, ...newMediaFiles];
      });

      // Queue metadata requests for video files
      const newMetadataIds = newMediaFiles
        .filter(item => item.type.startsWith('video/') && item.metadataStatus !== 'error')
        .map(item => item.id);
      if (newMetadataIds.length > 0) {
        newMetadataIds.forEach(id => enqueueMetadataRequest(id));
      }
    } else if (conflictingFiles.length > 0 && onConflictDetected) {
      // Show conflict modal for user-initiated file additions
      const conflictInfo: FileConflictInfo = {
        conflictingFiles,
        existingNames: conflictingFiles.map(f => f.name),
      };
      const conflictingNames = new Set(conflictInfo.existingNames);

      pendingFilesRef.current = allFilesToProcess;

      onConflictDetected(conflictInfo,
        async () => {
          // User confirmed - remove conflicting files and add new ones atomically
          pendingFilesRef.current = null;

          // First prepare the new files
          const newMediaFiles = await prepareMediaFiles(allFilesToProcess, mergedPreviewFileMap, mergedCaptionStringMap, idMap, datasetPrefix, startIndex, selectedProjectId);

          // Then update state in one go (remove conflicts + add new)
          setMediaFiles(prev => {
            const filtered = prev.filter(f => !conflictingNames.has(f.name));
            return [...filtered, ...newMediaFiles];
          });

          // Queue metadata requests for video files
          const newMetadataIds = newMediaFiles
            .filter(item => item.type.startsWith('video/') && item.metadataStatus !== 'error')
            .map(item => item.id);
          if (newMetadataIds.length > 0) {
            newMetadataIds.forEach(id => enqueueMetadataRequest(id));
          }
        },
        async () => {
          // User cancelled - only add non-conflicting files
          const nonConflictingFiles = allFilesToProcess.filter(file => {
            const isMedia = file.type.startsWith('image/') || file.type.startsWith('video/');
            return isMedia && !conflictingNames.has(file.name);
          });
          if (nonConflictingFiles.length > 0) {
            const newMediaFiles = await prepareMediaFiles(nonConflictingFiles, mergedPreviewFileMap, mergedCaptionStringMap, idMap, datasetPrefix, startIndex, selectedProjectId);
            setMediaFiles(prev => [...prev, ...newMediaFiles]);

            const newMetadataIds = newMediaFiles
              .filter(item => item.type.startsWith('video/') && item.metadataStatus !== 'error')
              .map(item => item.id);
            if (newMetadataIds.length > 0) {
              newMetadataIds.forEach(id => enqueueMetadataRequest(id));
            }
          }
          pendingFilesRef.current = null;
        }
      );
    } else {
      // No conflicts or no conflict handler - process all files
      const newMediaFiles = await prepareMediaFiles(allFilesToProcess, mergedPreviewFileMap, mergedCaptionStringMap, idMap, datasetPrefix, startIndex, selectedProjectId);
      setMediaFiles(prev => [...prev, ...newMediaFiles]);

      // Queue metadata requests for video files
      const newMetadataIds = newMediaFiles
        .filter(item => item.type.startsWith('video/') && item.metadataStatus !== 'error')
        .map(item => item.id);
      if (newMetadataIds.length > 0) {
        newMetadataIds.forEach(id => enqueueMetadataRequest(id));
      }
    }
  }, [onConflictDetected, prepareMediaFiles, setMediaFiles, enqueueMetadataRequest, onZipProgressChange, selectedProjectId]);

  return { handleFilesAdded };
};
