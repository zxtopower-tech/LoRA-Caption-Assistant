import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { MediaFile } from '../types';

export interface MediaContextValue {
  // State
  mediaFiles: MediaFile[];
  isSavingCaption: boolean;

  // Computed
  selectedFiles: MediaFile[];
  activeMediaIndex: number;
  activeMedia: MediaFile | null;

  // Actions
  setMediaFiles: React.Dispatch<React.SetStateAction<MediaFile[]>>;
  updateFile: (id: string, updates: Partial<MediaFile>) => void;
  deleteSelected: () => void;
  selectAll: (isChecked: boolean) => void;
  updateCaption: (id: string, caption: string) => void;
  updateCustomInstructions: (id: string, instructions: string) => void;
  updateSelection: (id: string, isSelected: boolean) => void;
  setIsSavingCaption: (isSaving: boolean) => void;
}

const MediaContext = createContext<MediaContextValue | null>(null);

export const MediaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [isSavingCaption, setIsSavingCaption] = useState<boolean>(false);

  const updateFile = useCallback((id: string, updates: Partial<MediaFile>) => {
    setMediaFiles(prev =>
      prev.map(mf => (mf.id === id ? { ...mf, ...updates } : mf))
    );
  }, []);

  const deleteSelected = useCallback(() => {
    setMediaFiles(prev => prev.filter(mf => !mf.isSelected));
  }, []);

  const selectAll = useCallback((isChecked: boolean) => {
    setMediaFiles(prev => prev.map(mf => ({ ...mf, isSelected: isChecked })));
  }, []);

  const updateCaption = useCallback((id: string, caption: string) => {
    setMediaFiles(prev =>
      prev.map(mf => (mf.id === id ? { ...mf, caption, qualityScore: undefined } : mf))
    );
  }, []);

  const updateCustomInstructions = useCallback((id: string, instructions: string) => {
    setMediaFiles(prev =>
      prev.map(mf => (mf.id === id ? { ...mf, customInstructions: instructions } : mf))
    );
  }, []);

  const updateSelection = useCallback((id: string, isSelected: boolean) => {
    setMediaFiles(prev =>
      prev.map(mf => (mf.id === id ? { ...mf, isSelected } : mf))
    );
  }, []);

  const selectedFiles = useMemo(() => mediaFiles.filter(mf => mf.isSelected), [mediaFiles]);

  const value = useMemo<MediaContextValue>(
    () => ({
      mediaFiles,
      isSavingCaption,
      selectedFiles,
      activeMediaIndex: -1,
      activeMedia: null,
      setMediaFiles,
      updateFile,
      deleteSelected,
      selectAll,
      updateCaption,
      updateCustomInstructions,
      updateSelection,
      setIsSavingCaption,
    }),
    [mediaFiles, isSavingCaption, selectedFiles, updateFile, deleteSelected, selectAll, updateCaption, updateCustomInstructions, updateSelection]
  );

  return <MediaContext.Provider value={value}>{children}</MediaContext.Provider>;
};

export const useMedia = () => {
  const context = useContext(MediaContext);
  if (!context) {
    throw new Error('useMedia must be used within MediaProvider');
  }
  return context;
};
