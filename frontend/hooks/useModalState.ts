import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { MediaFile } from '../types';

interface UseModalStateProps {
  mediaFiles: MediaFile[];
  updateCaption: (id: string, caption: string) => void;
  updateCustomInstructions: (id: string, instructions: string) => void;
}

export const useModalState = ({
  mediaFiles,
  updateCaption,
  updateCustomInstructions,
}: UseModalStateProps) => {
  const [activeMediaId, setActiveMediaId] = useState<string | null>(null);
  const [modalCaption, setModalCaption] = useState<string>('');
  const [modalCustomInstructions, setModalCustomInstructions] = useState<string>('');
  const lastSyncedCaptionRef = useRef<string | null>(null);
  const lastSyncedInstructionsRef = useRef<string | null>(null);

  const activeMediaIndex = useMemo(() => {
    if (!activeMediaId) return -1;
    return mediaFiles.findIndex(mf => mf.id === activeMediaId);
  }, [activeMediaId, mediaFiles]);

  const activeMedia = activeMediaIndex >= 0 ? mediaFiles[activeMediaIndex] : null;
  const hasPrevMedia = activeMediaIndex > 0;
  const hasNextMedia = activeMediaIndex >= 0 && activeMediaIndex < mediaFiles.length - 1;
  const isModalOpen = activeMediaId !== null && activeMediaIndex >= 0;

  const openMediaModal = useCallback((item: MediaFile) => {
    setActiveMediaId(item.id);
    setModalCaption(item.caption);
    setModalCustomInstructions(item.customInstructions);
    lastSyncedCaptionRef.current = item.caption;
    lastSyncedInstructionsRef.current = item.customInstructions;
  }, []);

  const commitModalCaption = useCallback(() => {
    if (!activeMediaId) return;
    const activeItem = mediaFiles.find(mf => mf.id === activeMediaId);
    if (!activeItem) return;
    const needsUpdate = activeItem.caption !== modalCaption || activeItem.customInstructions !== modalCustomInstructions;
    if (!needsUpdate) return;
    updateCaption(activeMediaId, modalCaption);
    updateCustomInstructions(activeMediaId, modalCustomInstructions);
  }, [activeMediaId, mediaFiles, modalCaption, modalCustomInstructions, updateCaption, updateCustomInstructions]);

  const handleModalClose = useCallback(() => {
    commitModalCaption();
    setActiveMediaId(null);
    setModalCaption('');
    setModalCustomInstructions('');
    lastSyncedCaptionRef.current = null;
    lastSyncedInstructionsRef.current = null;
  }, [commitModalCaption]);

  const handleModalPrev = useCallback(() => {
    if (activeMediaIndex <= 0) return;
    commitModalCaption();
    const nextItem = mediaFiles[activeMediaIndex - 1];
    if (!nextItem) return;
    setActiveMediaId(nextItem.id);
    setModalCaption(nextItem.caption);
    setModalCustomInstructions(nextItem.customInstructions);
    lastSyncedCaptionRef.current = nextItem.caption;
    lastSyncedInstructionsRef.current = nextItem.customInstructions;
  }, [activeMediaIndex, mediaFiles, commitModalCaption]);

  const handleModalNext = useCallback(() => {
    if (activeMediaIndex < 0 || activeMediaIndex >= mediaFiles.length - 1) return;
    commitModalCaption();
    const nextItem = mediaFiles[activeMediaIndex + 1];
    if (!nextItem) return;
    setActiveMediaId(nextItem.id);
    setModalCaption(nextItem.caption);
    setModalCustomInstructions(nextItem.customInstructions);
    lastSyncedCaptionRef.current = nextItem.caption;
    lastSyncedInstructionsRef.current = nextItem.customInstructions;
  }, [activeMediaIndex, mediaFiles, commitModalCaption]);

  // Reset modal state when activeMedia is removed
  useEffect(() => {
    if (activeMediaId && activeMediaIndex === -1) {
      setActiveMediaId(null);
      setModalCaption('');
      setModalCustomInstructions('');
      lastSyncedCaptionRef.current = null;
      lastSyncedInstructionsRef.current = null;
    }
  }, [activeMediaId, activeMediaIndex]);

  // Sync modal caption/instructions when activeMedia's caption changes (e.g., after Generate)
  // Only sync if the value changed externally, not from user input
  useEffect(() => {
    if (!activeMedia) {
      lastSyncedCaptionRef.current = null;
      lastSyncedInstructionsRef.current = null;
      return;
    }

    if (lastSyncedCaptionRef.current !== activeMedia.caption) {
      setModalCaption(activeMedia.caption);
      lastSyncedCaptionRef.current = activeMedia.caption;
    }

    if (lastSyncedInstructionsRef.current !== activeMedia.customInstructions) {
      setModalCustomInstructions(activeMedia.customInstructions);
      lastSyncedInstructionsRef.current = activeMedia.customInstructions;
    }
  }, [activeMedia]);

  return {
    activeMediaId,
    setActiveMediaId,
    modalCaption,
    setModalCaption,
    modalCustomInstructions,
    setModalCustomInstructions,
    activeMedia,
    activeMediaIndex,
    hasPrevMedia,
    hasNextMedia,
    isModalOpen,
    openMediaModal,
    commitModalCaption,
    handleModalClose,
    handleModalPrev,
    handleModalNext,
  };
};
