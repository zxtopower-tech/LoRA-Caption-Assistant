import { useState, useRef, useCallback } from 'react';

/**
 * Parameters for the useFileDragDrop hook
 */
export interface UseFileDragDropParams {
  /** Callback function invoked when files are dropped */
  onFilesDrop: (files: File[]) => void;
}

/**
 * Drag and drop event handlers
 */
export interface DragDropHandlers {
  /** Handler for drag enter event */
  onDragEnter: (e: React.DragEvent) => void;
  /** Handler for drag leave event */
  onDragLeave: (e: React.DragEvent) => void;
  /** Handler for drag over event */
  onDragOver: (e: React.DragEvent) => void;
  /** Handler for drop event */
  onDrop: (e: React.DragEvent) => void;
}

/**
 * Return value for the useFileDragDrop hook
 */
export interface UseFileDragDropReturn {
  /** Whether an item is currently being dragged over the drop zone */
  isDragging: boolean;
  /** Object containing drag and drop event handlers */
  dragHandlers: DragDropHandlers;
}

/**
 * Custom hook for managing file drag and drop functionality
 *
 * Features:
 * - Prevents flickering when dragging over child elements using dragCounter
 * - Provides stable handlers using useCallback
 * - Automatically handles drag enter/leave/over/drop events
 *
 * @param params - Hook parameters including onFilesDrop callback
 * @returns Object containing isDragging state and dragHandlers
 *
 * @example
 * ```tsx
 * const { isDragging, dragHandlers } = useFileDragDrop({
 *   onFilesDrop: (files) => {
 *     console.log('Dropped files:', files);
 *   }
 * });
 *
 * return (
 *   <div {...dragHandlers}>
 *     {isDragging && <DropOverlay />}
 *   </div>
 * );
 * ```
 */
export function useFileDragDrop(params: UseFileDragDropParams): UseFileDragDropReturn {
  const { onFilesDrop } = params;

  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (dragCounter.current === 1) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      onFilesDrop(files);
    }
  }, [onFilesDrop]);

  const dragHandlers: DragDropHandlers = {
    onDragEnter: handleDragEnter,
    onDragLeave: handleDragLeave,
    onDragOver: handleDragOver,
    onDrop: handleDrop,
  };

  return {
    isDragging,
    dragHandlers,
  };
}
