import { useCallback } from 'react';
import type { MediaFile, QueueRequest } from '../types';
import { useToast } from './useToast';

interface UseMediaHandlersParams {
  mediaFiles: MediaFile[];
  selectedFiles: MediaFile[];
  datasetPrefix: string;
  isQueueEnabled: boolean;
  _checkQuality: (id: string) => Promise<void>;
  updateFile: (id: string, updates: Partial<MediaFile>) => void;
  setMediaFiles: React.Dispatch<React.SetStateAction<MediaFile[]>>;
  setRequestQueue: React.Dispatch<React.SetStateAction<QueueRequest[]>>;
}

export const useMediaHandlers = ({
  mediaFiles,
  selectedFiles,
  datasetPrefix,
  isQueueEnabled,
  _checkQuality,
  updateFile,
  setMediaFiles,
  setRequestQueue,
}: UseMediaHandlersParams) => {
  const { warning: toastWarning } = useToast();

  const handleSelectAll = useCallback((isChecked: boolean) => {
    setMediaFiles(prev => prev.map(mf => ({ ...mf, isSelected: isChecked })));
  }, [setMediaFiles]);

  const handleCheckQuality = useCallback(async () => {
    const filesToCheck = selectedFiles.filter(mf => mf.caption.trim() !== '');

    if (filesToCheck.length === 0) {
      toastWarning("Please select files with captions to check quality.");
      return;
    }

    if (isQueueEnabled) {
      const newRequests = filesToCheck.map(file => ({ type: 'quality' as const, id: file.id }));
      setRequestQueue(prev => [...prev, ...newRequests]);
    } else {
      const promises = filesToCheck.map(file => _checkQuality(file.id));
      await Promise.all(promises);
    }

  }, [selectedFiles, isQueueEnabled, _checkQuality, setRequestQueue, toastWarning]);

  const handleCaptionChange = useCallback((id: string, caption: string) => {
    updateFile(id, { caption, qualityScore: undefined });
  }, [updateFile]);

  const handleCustomInstructionsChange = useCallback((id: string, instructions: string) => {
    updateFile(id, { customInstructions: instructions });
  }, [updateFile]);

  const handleSelectionChange = useCallback((id: string, isSelected: boolean) => {
    updateFile(id, { isSelected });
  }, [updateFile]);

  const handleDownload = useCallback(async () => {
    if (selectedFiles.length === 0 || !window.JSZip) return;

    const zip = new window.JSZip();
    let imageCounter = 0;
    let videoCounter = 0;

    await Promise.all(selectedFiles.map(async ({ file, name, caption, previewFile }) => {
      // Use file if available (for now it should be), otherwise use name/type from MediaFile
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

    const zipFileName = datasetPrefix ? `${datasetPrefix}_dataset_${Date.now()}.zip` : `lora-dataset-${Date.now()}.zip`;
    zip.generateAsync({ type: 'blob' }).then((content: Blob) => {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = zipFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  }, [selectedFiles, datasetPrefix]);

  const deleteSelected = useCallback(() => {
    const newMediaFiles = mediaFiles.filter(mf => !mf.isSelected);
    setMediaFiles(newMediaFiles);
  }, [mediaFiles, setMediaFiles]);

  const deleteOne = useCallback((id: string) => {
    setMediaFiles(prev => prev.filter(mf => mf.id !== id));
  }, [setMediaFiles]);

  return {
    handleSelectAll,
    handleCheckQuality,
    handleCaptionChange,
    handleCustomInstructionsChange,
    handleSelectionChange,
    handleDownload,
    deleteSelected,
    deleteOne,
    handleRename: useCallback((id: string, newName: string) => {
      // Optimistic update
      updateFile(id, { name: newName });
    }, [updateFile]),
  };
};
