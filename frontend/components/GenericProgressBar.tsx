import React, { useState, useEffect, useRef } from 'react';

interface GenericProgressBarProps {
  isActive: boolean;
  progress: number;
  color?: 'emerald' | 'purple' | 'pink' | 'blue';
  offset?: number;
  label?: string;
  detailLabel?: string;
  onShowDetail?: () => void;
}

const COLOR_CLASSES = {
  emerald: 'bg-emerald-400',
  purple: 'bg-gradient-to-r from-pink-400 to-purple-500',
  pink: 'bg-pink-400',
  blue: 'bg-blue-400',
};

const GenericProgressBar: React.FC<GenericProgressBarProps> = ({
  isActive,
  progress,
  color = 'emerald',
  offset = 0,
  label,
  detailLabel,
  onShowDetail,
}) => {
  // Use a single state to control position directly
  const [bottomPosition, setBottomPosition] = useState<'-100%' | '0px'>('-100%');
  const [showComplete, setShowComplete] = useState(false);
  const isAnimatingRef = useRef(false);
  const hasCompletedRef = useRef(false);

  useEffect(() => {
    // Prevent multiple animations
    if (isAnimatingRef.current) {
      return;
    }

    // Start entering animation
    if (isActive && bottomPosition === '-100%' && !hasCompletedRef.current) {
      isAnimatingRef.current = true;
      // Render at -100% first, then animate to 0
      setTimeout(() => {
        setBottomPosition('0px');
        isAnimatingRef.current = false;
      }, 50);
      return;
    }

    // Start exit animation when progress completes (regardless of isActive state)
    if (progress >= 100 && bottomPosition === '0px' && !hasCompletedRef.current) {
      hasCompletedRef.current = true;
      setShowComplete(true);

      // Show complete message, then slide down
      setTimeout(() => {
        setBottomPosition('-100%');
        // Reset after animation completes
        setTimeout(() => {
          setShowComplete(false);
          hasCompletedRef.current = false;
        }, 700);
      }, 1200);
      return;
    }

    // Reset if not active and not animating and not completed
    if (!isActive && !isAnimatingRef.current && !hasCompletedRef.current && bottomPosition === '0px') {
      setBottomPosition('-100%');
    }
  }, [isActive, progress, bottomPosition]);

  // Don't render if below viewport and not active
  if (bottomPosition === '-100%' && !isActive && !showComplete) return null;

  return (
    <div
      className="fixed left-0 right-0 z-50 transition-all duration-700 ease-in-out"
      style={{
        bottom: bottomPosition,
        ...(offset > 0 && !showComplete ? { marginBottom: `${offset}px` } : {})
      }}
    >
      {(label || detailLabel || onShowDetail) && (
        <div className="flex items-center justify-between px-4 py-1 bg-black/95 border-b border-gray-800">
          {label && (
            <span className={`text-sm font-medium ${showComplete ? 'text-green-400' : 'text-gray-200'}`}>
              {showComplete ? `${label} Complete!` : label}
            </span>
          )}
          {detailLabel && !showComplete && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{detailLabel}</span>
            </div>
          )}
          {onShowDetail && !showComplete && (
            <button
              onClick={onShowDetail}
              className="text-xs text-indigo-400 hover:text-indigo-300 underline"
            >
              Details
            </button>
          )}
        </div>
      )}
      <div className="h-3 bg-black/95 border-t border-b border-gray-800">
        <div
          className={`h-3 ${COLOR_CLASSES[color]} transition-all duration-300 ease-out`}
          style={{ width: `${progress}%` }}
        ></div>
      </div>
    </div>
  );
};

export default GenericProgressBar;
