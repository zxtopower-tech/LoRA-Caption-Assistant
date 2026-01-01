import React, { useRef } from 'react';
import { SaveIcon, DownloadIcon, Spinner, UploadCloudIcon } from './Icons';

interface ProfilePanelProps {
  profileName: string;
  onProfileNameChange: (value: string) => void;
  autoSaveStatus: string;
  onSaveNow: () => void;
  onDownload: () => void;
  onUpload: (file: File) => void;
  errorMessage?: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isSaving?: boolean;
  isUploading?: boolean;
  uploadSuccess?: boolean;
}

const ProfilePanel: React.FC<ProfilePanelProps> = ({
  profileName,
  onProfileNameChange,
  autoSaveStatus,
  onSaveNow,
  onDownload,
  onUpload,
  errorMessage,
  isCollapsed = false,
  onToggleCollapse,
  isSaving = false,
  isUploading = false,
  uploadSuccess = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    onUpload(file);
  };

  return (
    <section className="bg-gray-800/50 rounded-lg shadow-lg">
      <div className="p-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">1. User Profile</h2>
          {isSaving && (
            <Spinner size="md" className="text-orange-500" />
          )}
        </div>
        <button
          onClick={onToggleCollapse}
          className="text-gray-400 hover:text-white transition-colors p-1 rounded hover:bg-gray-700"
          aria-label={isCollapsed ? 'Expand' : 'Collapse'}
        >
          <svg className="w-5 h-5 transition-transform" style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
      {!isCollapsed && (
        <div className="px-6 pb-6 space-y-3">
          <div>
            <label htmlFor="profile-name" className="block text-sm font-medium text-gray-300 mb-1">
              Profile Name
            </label>
            <div className="flex gap-2">
              <input
                id="profile-name"
                type="text"
                value={profileName}
                onChange={(e) => onProfileNameChange(e.target.value)}
                className="flex-grow p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="e.g., my-profile"
                readOnly
              />
              <button
                onClick={onSaveNow}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded-md border border-gray-600"
                aria-label="Save"
                title="Save"
              >
                <SaveIcon className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={handleUploadClick}
                disabled={isUploading}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded-md border border-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed"
                aria-label="Upload"
                title="Upload profile file"
              >
                {isUploading ? (
                  <Spinner size="md" />
                ) : (
                  <UploadCloudIcon className="w-5 h-5" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                onClick={onDownload}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded-md border border-gray-600"
                aria-label="Download"
                title="Download"
              >
                <DownloadIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Auto-save:</span>
            <span className="text-xs text-gray-400">{autoSaveStatus || 'On'}</span>
          </div>
        </div>
      )}
    </section>
  );
};

export default ProfilePanel;
