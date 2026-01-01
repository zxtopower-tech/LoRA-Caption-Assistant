import type { MediaFile } from '../types';
import { extractBaseName } from './fileUtils';

export const createProjectZip = async (mediaFiles: MediaFile[], datasetPrefix: string): Promise<Blob> => {
  if (!window.JSZip) throw new Error('JSZip library not available');
  if (mediaFiles.length === 0) throw new Error('No media files to zip');
  const zip = new window.JSZip();
  let imageCounter = 0;
  let videoCounter = 0;

  await Promise.all(mediaFiles.map(async ({ file, name, caption, previewFile }) => {
    // Use file if available (for now it should be), otherwise skip
    const actualFile = file;
    if (!actualFile) {
      return;
    }

    const extension = actualFile.name.split('.').pop() || '';
    let newBaseName: string;
    if (actualFile.type.startsWith('image/')) {
      imageCounter++;
      newBaseName = `${datasetPrefix}_image${String(imageCounter).padStart(2, '0')}`;
    } else if (actualFile.type.startsWith('video/')) {
      videoCounter++;
      newBaseName = `${datasetPrefix}_video${String(videoCounter).padStart(2, '0')}`;
    } else {
      newBaseName = `${datasetPrefix}_file${String(imageCounter + videoCounter).padStart(2, '0')}`;
    }
    const fileName = `${newBaseName}.${extension}`;
    zip.file(fileName, actualFile);
    zip.file(`${newBaseName}.txt`, caption);

    // Add preview file to previews/ folder if it exists
    if (previewFile) {
      // Use preview file's own extension instead of original file's extension
      const previewFileName = `${newBaseName}.${previewFile.name.split('.').pop() || 'png'}`;
      zip.file(`previews/${previewFileName}`, previewFile);
    }
  }));

  return await zip.generateAsync({ type: 'blob' });
};

export const extractProjectZip = async (zipFile: File): Promise<{
  mediaFiles: File[];
  previewFileMap: Map<string, File>;
}> => {
  if (!window.JSZip) throw new Error('JSZip library not available');
  const zip = new window.JSZip();
  const contents = await zip.loadAsync(zipFile);
  const mediaFiles: File[] = [];
  const previewFileMap = new Map<string, File>();

  for (const [_path, zipEntry] of Object.entries(contents.files)) {
    if ((zipEntry as any).dir) continue;

    const blob = await (zipEntry as any).async('blob');
    const fileName = (zipEntry as any).name;

    // Check if file is in previews/ folder
    if (fileName.startsWith('previews/')) {
      // Extract the base name without extension
      // e.g., "previews/item_image02.png" -> "item_image02"
      const previewNameWithExt = fileName.substring('previews/'.length);
      const baseName = extractBaseName(previewNameWithExt);

      const file = new File([blob], previewNameWithExt, {
        type: blob.type || getMimeType(previewNameWithExt),
        lastModified: (zipEntry as any).date?.getTime() || Date.now(),
      });
      // Map by base name (without extension) to match any media file with the same base name
      previewFileMap.set(baseName, file);
    } else {
      // Regular media file or caption file
      const file = new File([blob], fileName, {
        type: blob.type || getMimeType(fileName),
        lastModified: (zipEntry as any).date?.getTime() || Date.now(),
      });
      mediaFiles.push(file);
    }
  }

  return { mediaFiles, previewFileMap };
};

const getMimeType = (filename: string): string => {
  const ext = filename.toLowerCase().split('.').pop();
  const mimeTypes: Record<string, string> = {
    'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'gif': 'image/gif',
    'webp': 'image/webp', 'bmp': 'image/bmp', 'svg': 'image/svg+xml',
    'mp4': 'video/mp4', 'webm': 'video/webm', 'mov': 'video/quicktime',
    'avi': 'video/x-msvideo', 'mkv': 'video/x-matroska', 'txt': 'text/plain',
  };
  return mimeTypes[ext || ''] || 'application/octet-stream';
};
