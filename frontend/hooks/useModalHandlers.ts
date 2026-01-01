import { useCallback } from 'react';
import type { MediaFile } from '../types';

interface UseModalHandlersParams {
  mediaFiles: MediaFile[];
  activeMediaId: string | null;
  hasPrevMedia: boolean;
  hasNextMedia: boolean;
  updateFile: (id: string, updates: Partial<MediaFile>) => void;
  setActiveMediaId: (id: string | null) => void;
  setModalCaption: (caption: string) => void;
  setModalCustomInstructions: (instructions: string) => void;
  onModalNavigate?: (currentItem: { id: string; name: string; caption: string }) => void;
  onModalClose?: (currentItem: { id: string; name: string; caption: string } | null) => void;
}

export const useModalHandlers = ({
  mediaFiles,
  activeMediaId,
  hasPrevMedia,
  hasNextMedia,
  updateFile,
  setActiveMediaId,
  setModalCaption,
  setModalCustomInstructions,
  onModalNavigate,
  onModalClose,
}: UseModalHandlersParams) => {

  const openMediaModal = useCallback((item: MediaFile) => {
    setActiveMediaId(item.id);
    setModalCaption(item.caption);
    setModalCustomInstructions(item.customInstructions);
  }, [setActiveMediaId, setModalCaption, setModalCustomInstructions]);

  const handleModalCaptionChange = useCallback((caption: string) => {
    setModalCaption(caption);
  }, [setModalCaption]);

  const handleModalCustomInstructionsChange = useCallback((instructions: string) => {
    setModalCustomInstructions(instructions);
  }, [setModalCustomInstructions]);

  const handleModalClose = useCallback((currentCaption?: string, currentInstructions?: string) => {
    // Sync modal caption and customInstructions to mediaFiles before closing
    if (activeMediaId) {
      updateFile(activeMediaId, {
        caption: currentCaption ?? '',
        customInstructions: currentInstructions ?? '',
        qualityScore: undefined
      });
    }

    // Notify parent with current caption
    if (activeMediaId && onModalClose) {
      const currentFile = mediaFiles.find(f => f.id === activeMediaId);
      if (currentFile) {
        onModalClose({
          id: activeMediaId,
          name: currentFile.name,
          caption: currentCaption ?? currentFile.caption,
        });
      } else {
        onModalClose(null);
      }
    }

    setActiveMediaId(null);
    setModalCaption('');
    setModalCustomInstructions('');
  }, [activeMediaId, mediaFiles, setActiveMediaId, setModalCaption, setModalCustomInstructions, onModalClose, updateFile]);

  const handleModalPrev = useCallback((currentCaption?: string, currentInstructions?: string) => {
    if (!hasPrevMedia) return;

    // Sync modal caption and customInstructions to mediaFiles before navigating
    if (activeMediaId) {
      updateFile(activeMediaId, {
        caption: currentCaption ?? '',
        customInstructions: currentInstructions ?? '',
        qualityScore: undefined
      });
    }

    // Notify parent with current caption before navigating
    if (activeMediaId && onModalNavigate) {
      const currentFile = mediaFiles.find(f => f.id === activeMediaId);
      if (currentFile) {
        onModalNavigate({
          id: activeMediaId,
          name: currentFile.name,
          caption: currentCaption ?? currentFile.caption,
        });
      }
    }

    const currentIndex = mediaFiles.findIndex(mf => mf.id === activeMediaId);
    if (currentIndex > 0) {
      const nextItem = mediaFiles[currentIndex - 1];
      setActiveMediaId(nextItem.id);
      setModalCaption(nextItem.caption);
      setModalCustomInstructions(nextItem.customInstructions);
    }
  }, [hasPrevMedia, activeMediaId, mediaFiles, setActiveMediaId, setModalCaption, setModalCustomInstructions, onModalNavigate, updateFile]);

  const handleModalNext = useCallback((currentCaption?: string, currentInstructions?: string) => {
    if (!hasNextMedia) return;

    // Sync modal caption and customInstructions to mediaFiles before navigating
    if (activeMediaId) {
      updateFile(activeMediaId, {
        caption: currentCaption ?? '',
        customInstructions: currentInstructions ?? '',
        qualityScore: undefined
      });
    }

    // Notify parent with current caption before navigating
    if (activeMediaId && onModalNavigate) {
      const currentFile = mediaFiles.find(f => f.id === activeMediaId);
      if (currentFile) {
        onModalNavigate({
          id: activeMediaId,
          name: currentFile.name,
          caption: currentCaption ?? currentFile.caption,
        });
      }
    }

    const currentIndex = mediaFiles.findIndex(mf => mf.id === activeMediaId);
    if (currentIndex >= 0 && currentIndex < mediaFiles.length - 1) {
      const nextItem = mediaFiles[currentIndex + 1];
      setActiveMediaId(nextItem.id);
      setModalCaption(nextItem.caption);
      setModalCustomInstructions(nextItem.customInstructions);
    }
  }, [hasNextMedia, activeMediaId, mediaFiles, setActiveMediaId, setModalCaption, setModalCustomInstructions, onModalNavigate, updateFile]);

  return {
    openMediaModal,
    handleModalCaptionChange,
    handleModalCustomInstructionsChange,
    handleModalClose,
    handleModalPrev,
    handleModalNext,
  };
};
