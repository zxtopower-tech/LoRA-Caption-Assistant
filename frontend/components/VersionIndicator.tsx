/**
 * Version Indicator Component
 * Displays current version and update status in the header
 */

import React, { useEffect, useState } from 'react';
import { fetchSystemVersion } from '../services/systemService';
import { GitHubIcon } from './Icons';
import type { SystemVersion } from '../types';

interface VersionIndicatorProps {
  className?: string;
}

export const VersionIndicator: React.FC<VersionIndicatorProps> = ({ className = '' }) => {
  const [version, setVersion] = useState<SystemVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const loadVersion = async () => {
      try {
        setLoading(true);
        const data = await fetchSystemVersion(controller.signal);
        setVersion(data);
        setError(null);
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setError(err.message);
        }
      } finally {
        setLoading(false);
      }
    };

    loadVersion();

    return () => {
      controller.abort();
    };
  }, []);

  const handleClick = () => {
    if (version?.repo_url) {
      window.open(version.repo_url, '_blank');
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center gap-2 text-xs text-gray-500 ${className}`}>
        <span>Checking version...</span>
      </div>
    );
  }

  if (error || !version) {
    return (
      <div className={`flex items-center gap-2 text-xs text-gray-600 ${className}`}>
        <GitHubIcon className="w-4 h-4" />
        <span>v1.0.0</span>
      </div>
    );
  }

  return (
    <button
      onClick={handleClick}
      className={`flex items-center gap-2 text-xs text-gray-400 hover:text-gray-300 transition-colors ${className}`}
      title={version.has_update ? `New version available: ${version.latest_version}\n${version.release_notes}` : 'Open GitHub repository'}
    >
      <GitHubIcon className="w-4 h-4" />
      <span>v{version.current_version}</span>
      {version.has_update && (
        <span className="px-2 py-0.5 bg-green-600/20 text-green-400 rounded-full text-xs font-medium border border-green-600/30">
          NEW
        </span>
      )}
    </button>
  );
};

export default VersionIndicator;
