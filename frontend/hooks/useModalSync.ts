import { useEffect, useRef } from 'react';
import { MediaFile } from '../types';

export const useModalSync = (
  activeMediaId: string | null,
  mediaFiles: MediaFile[],
  activeMedia: MediaFile | null,
  _modalCaption: string,
  setActiveMediaId: (id: string | null) => void,
  setModalCaption: (caption: string) => void,
  setModalCustomInstructions: (instructions: string) => void
) => {
  const lastSyncedCaptionRef = useRef<string | null>(null);
  const lastSyncedInstructionsRef = useRef<string | null>(null);

  useEffect(() => {
    const activeMediaIndex = mediaFiles.findIndex(mf => mf.id === activeMediaId);
    if (activeMediaId && activeMediaIndex === -1) {
      setActiveMediaId(null);
      setModalCaption('');
      setModalCustomInstructions('');
      lastSyncedCaptionRef.current = null;
      lastSyncedInstructionsRef.current = null;
    }
  }, [activeMediaId, mediaFiles, setActiveMediaId, setModalCaption, setModalCustomInstructions]);

  // Sync caption only when activeMedia changes and it's different from last synced value
  useEffect(() => {
    if (!activeMedia) {
      lastSyncedCaptionRef.current = null;
      lastSyncedInstructionsRef.current = null;
      return;
    }

    // Only sync if the media caption changed externally (not from user input)
    if (lastSyncedCaptionRef.current !== activeMedia.caption) {
      setModalCaption(activeMedia.caption);
      lastSyncedCaptionRef.current = activeMedia.caption;
    }

    if (lastSyncedInstructionsRef.current !== activeMedia.customInstructions) {
      setModalCustomInstructions(activeMedia.customInstructions);
      lastSyncedInstructionsRef.current = activeMedia.customInstructions;
    }
  }, [activeMedia, setModalCaption, setModalCustomInstructions]);
};
