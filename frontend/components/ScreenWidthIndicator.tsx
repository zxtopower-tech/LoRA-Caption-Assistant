import React, { useState, useEffect } from 'react';

/**
 * Indicator component that displays screen width in real-time
 * Displays current breakpoint tier and pixel width as an overlay at top-center
 */
export const ScreenWidthIndicator: React.FC = () => {
  const [width, setWidth] = useState<number>(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Tailwind CSS breakpoint criteria (default, md, lg) - 3 tiers
  const getBreakpoint = (w: number): string => {
    if (w < 768) return 'default';
    if (w < 1024) return 'md';
    return 'lg';
  };

  const breakpoint = getBreakpoint(width);

  return (
    <div className="fixed top-0 left-1/2 -translate-x-1/2 z-[9999] bg-black/80 text-white px-4 py-2 rounded-b-lg font-mono text-sm pointer-events-none backdrop-blur-sm border border-gray-700">
      {breakpoint} base width: {width}px
    </div>
  );
};
