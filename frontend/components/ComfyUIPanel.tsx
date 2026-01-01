import React from 'react';
import { ComfyPreviewSettings } from './ComfyPreviewSettings';
import { ChevronDownIcon } from './Icons';

interface ComfyUIPanelProps {
  serverUrl: string;
  onServerUrlChange: (url: string) => void;
  queueRunning?: number;
  queueRemaining?: number;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const ComfyUIPanel: React.FC<ComfyUIPanelProps> = ({
  serverUrl,
  onServerUrlChange,
  queueRunning,
  queueRemaining,
  isCollapsed = false,
  onToggleCollapse,
}) => (
  <section className="bg-gray-800/50 rounded-lg shadow-lg">
    <div className="p-6 flex items-center justify-between">
      <h2 className="text-xl font-semibold">3. ComfyUI Preview Settings</h2>
      <button
        onClick={onToggleCollapse}
        className="text-gray-400 hover:text-white transition-colors p-1 rounded hover:bg-gray-700"
        aria-label={isCollapsed ? 'Expand' : 'Collapse'}
      >
        <ChevronDownIcon className={`w-5 h-5 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
      </button>
    </div>
    {!isCollapsed && (
      <div className="px-6 pb-6">
        <ComfyPreviewSettings
          serverUrl={serverUrl}
          onServerUrlChange={onServerUrlChange}
          queueRunning={queueRunning}
          queueRemaining={queueRemaining}
        />
      </div>
    )}
  </section>
);

export default ComfyUIPanel;
