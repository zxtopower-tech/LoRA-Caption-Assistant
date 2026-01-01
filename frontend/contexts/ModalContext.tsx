import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { MediaFile } from '../types';

export interface ModalContextValue {
  // State
  activeMediaId: string | null;
  modalCaption: string;
  modalCustomInstructions: string;

  // Computed
  isModalOpen: boolean;
  activeMedia: MediaFile | null;
  hasPrevMedia: boolean;
  hasNextMedia: boolean;

  // Actions
  setActiveMediaId: (id: string | null) => void;
  setModalCaption: (caption: string) => void;
  setModalCustomInstructions: (instructions: string) => void;
  openModal: (item: MediaFile) => void;
  closeModal: () => void;
  prevMedia: () => void;
  nextMedia: () => void;
  commitModalCaption: (updateCaption: (id: string, caption: string) => void, updateCustomInstructions: (id: string, instructions: string) => void) => void;
  setMediaFiles: React.Dispatch<React.SetStateAction<MediaFile[]>>;
}

const ModalContext = createContext<ModalContextValue | null>(null);

export const ModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeMediaId, setActiveMediaId] = useState<string | null>(null);
  const [modalCaption, setModalCaption] = useState<string>('');
  const [modalCustomInstructions, setModalCustomInstructions] = useState<string>('');
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);

  const getActiveMediaIndex = useCallback(() => {
    if (!activeMediaId) return -1;
    return mediaFiles.findIndex(mf => mf.id === activeMediaId);
  }, [activeMediaId, mediaFiles]);

  const openModal = useCallback((item: MediaFile) => {
    setActiveMediaId(item.id);
    setModalCaption(item.caption);
    setModalCustomInstructions(item.customInstructions);
  }, []);

  const closeModal = useCallback(() => {
    setActiveMediaId(null);
    setModalCaption('');
    setModalCustomInstructions('');
  }, []);

  const prevMedia = useCallback(() => {
    const activeIndex = getActiveMediaIndex();
    if (activeIndex <= 0) return;
    const nextItem = mediaFiles[activeIndex - 1];
    if (!nextItem) return;
    setActiveMediaId(nextItem.id);
    setModalCaption(nextItem.caption);
    setModalCustomInstructions(nextItem.customInstructions);
  }, [mediaFiles, getActiveMediaIndex]);

  const nextMedia = useCallback(() => {
    const activeIndex = getActiveMediaIndex();
    if (activeIndex < 0 || activeIndex >= mediaFiles.length - 1) return;
    const nextItem = mediaFiles[activeIndex + 1];
    if (!nextItem) return;
    setActiveMediaId(nextItem.id);
    setModalCaption(nextItem.caption);
    setModalCustomInstructions(nextItem.customInstructions);
  }, [mediaFiles, getActiveMediaIndex]);

  const commitModalCaption = useCallback((
    updateCaption: (id: string, caption: string) => void,
    updateCustomInstructions: (id: string, instructions: string) => void
  ) => {
    if (!activeMediaId) return;
    const activeItem = mediaFiles.find(mf => mf.id === activeMediaId);
    if (!activeItem) return;
    const needsUpdate = activeItem.caption !== modalCaption || activeItem.customInstructions !== modalCustomInstructions;
    if (!needsUpdate) return;
    updateCaption(activeMediaId, modalCaption);
    updateCustomInstructions(activeMediaId, modalCustomInstructions);
  }, [activeMediaId, mediaFiles, modalCaption, modalCustomInstructions]);

  const isModalOpen = activeMediaId !== null;
  const activeMediaIndex = getActiveMediaIndex();
  const activeMedia = activeMediaIndex >= 0 ? mediaFiles[activeMediaIndex] : null;
  const hasPrevMedia = activeMediaIndex > 0;
  const hasNextMedia = activeMediaIndex >= 0 && activeMediaIndex < mediaFiles.length - 1;

  const value = useMemo<ModalContextValue>(
    () => ({
      activeMediaId,
      modalCaption,
      modalCustomInstructions,
      isModalOpen,
      activeMedia,
      hasPrevMedia,
      hasNextMedia,
      setActiveMediaId,
      setModalCaption,
      setModalCustomInstructions,
      openModal,
      closeModal,
      prevMedia,
      nextMedia,
      commitModalCaption,
      setMediaFiles,
    }),
    [activeMediaId, modalCaption, modalCustomInstructions, isModalOpen, activeMedia, hasPrevMedia, hasNextMedia, openModal, closeModal, prevMedia, nextMedia, commitModalCaption]
  );

  return <ModalContext.Provider value={value}>{children}</ModalContext.Provider>;
};

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within ModalProvider');
  }
  return context;
};
