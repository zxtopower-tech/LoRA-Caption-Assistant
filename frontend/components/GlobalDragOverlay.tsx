import React from 'react';

interface GlobalDragOverlayProps {
  isVisible: boolean;
}

const GlobalDragOverlay: React.FC<GlobalDragOverlayProps> = ({ isVisible }) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-indigo-900/80 backdrop-blur-sm transition-opacity duration-200">
      <div className="text-center">
        <svg className="w-24 h-24 mx-auto mb-4 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <p className="text-2xl font-semibold text-white mb-2">Drop files to upload</p>
        <p className="text-indigo-200">Images, videos, and caption files</p>
      </div>
    </div>
  );
};

export default GlobalDragOverlay;
