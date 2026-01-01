import { useMemo, useRef, useEffect } from 'react';
import { MediaFile } from '../types';

export const useUIState = (mediaFiles: MediaFile[]) => {
  const modalCaptionRef = useRef<HTMLTextAreaElement>(null);
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null);

  const allSelected = useMemo(
    () => mediaFiles.length > 0 && mediaFiles.every(mf => mf.isSelected),
    [mediaFiles]
  );

  const someSelected = useMemo(
    () => mediaFiles.some(mf => mf.isSelected) && !allSelected,
    [mediaFiles, allSelected]
  );

  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  return {
    modalCaptionRef,
    selectAllCheckboxRef,
    allSelected,
    someSelected,
  };
};
