import React from 'react';
import { DownloadIcon, Spinner, RefreshIcon } from './Icons';
import ProjectComboBox from './ProjectComboBox';
import { ProjectMetadata } from '../services/projectService';

interface ActionBarProps {
  hasValidConfig: boolean;
  mediaCount: number;
  selectedCount: number;
  captionedCount: number;
  allSelected: boolean;
  onSelectAll: (checked: boolean) => void;
  onGenerateAll: () => void;
  onGenerateSelected: () => void;
  onCheckQuality: () => void;
  onDownload: () => void;
  onDelete: () => void;
  comfyEnabled?: boolean;
  onPreviewAll?: () => void;
  onSortItems?: () => void;
  isProcessing?: boolean;
  // Project-related props
  projectSelectedId: string | null;
  projectList: ProjectMetadata[];
  onProjectChange: (projectId: string | null) => void;
  onBeforeProjectChange?: (project: ProjectMetadata) => boolean | Promise<boolean>;
  onProjectCreate: (projectName: string) => Promise<void>;
  onProjectSave: () => void;
  onProjectLoad: (projectId?: string) => Promise<void>;
  onProjectDownload: () => void;
  onProjectDelete?: (projectId: string) => void | Promise<void>;
  isProjectSaving?: boolean;
  isProjectLoading?: boolean;
  isProjectDownloading?: boolean;
  isSavingCaption?: boolean;
}

const ActionBar: React.FC<ActionBarProps> = ({
  hasValidConfig,
  mediaCount,
  selectedCount,
  captionedCount,
  allSelected,
  onSelectAll,
  onGenerateAll,
  onGenerateSelected,
  onCheckQuality,
  onDownload,
  onDelete,
  comfyEnabled = false,
  onPreviewAll,
  onSortItems,
  isProcessing = false,
  // Project-related props
  projectSelectedId,
  projectList,
  onProjectChange,
  onBeforeProjectChange,
  onProjectCreate,
  onProjectSave,
  onProjectLoad,
  onProjectDownload,
  onProjectDelete,
  isProjectSaving = false,
  isProjectLoading = false,
  isProjectDownloading = false,
  isSavingCaption = false,
}) => {
  const isDownloadDisabled = !projectSelectedId || isSavingCaption;

  return (
  <div className="sticky top-0 z-50 py-2 px-4 md:px-6 bg-gray-800/95 backdrop-blur-sm border border-gray-700 rounded-lg shadow-lg flex items-center gap-3 relative">
    {/* Caption & Refine + Project */}
    <div className="flex items-center gap-2 md:gap-3">
      <span className="text-xs font-bold text-purple-400/90 uppercase tracking-widest whitespace-nowrap">Caption & Refine</span>
      <span className="text-gray-600 hidden md:inline">|</span>
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400 font-medium whitespace-nowrap">Project</span>
        <ProjectComboBox
          projects={projectList}
          selectedId={projectSelectedId}
          onChange={onProjectChange}
          onBeforeChange={onBeforeProjectChange}
          onCreateProject={onProjectCreate}
          onDeleteProject={onProjectDelete}
          isCreating={isProjectSaving}
          placeholder="Select or create project..."
          className="w-32 md:w-56"
        />
        <button
          onClick={onProjectSave}
          disabled={!projectSelectedId || mediaCount === 0 || isProjectSaving}
          className="flex items-center justify-center px-2 md:px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors text-xs md:text-sm"
          title={!projectSelectedId ? 'Select a project first' : isProjectSaving ? 'Saving...' : `Save current media to project "${projectList.find(p => p.id === projectSelectedId)?.name || ''}"`}
        >
          {isProjectSaving ? (
            <Spinner />
          ) : (
            <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
              <polyline points="17 21 17 13 7 13 7 21"></polyline>
              <polyline points="7 3 7 8 15 8"></polyline>
            </svg>
          )}
        </button>
        <button
          onClick={() => onProjectLoad(projectSelectedId ?? undefined)}
          disabled={!projectSelectedId || isProjectLoading}
          className="flex items-center justify-center px-2 md:px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors text-xs md:text-sm"
          title={!projectSelectedId ? 'Select a project first' : isProjectLoading ? 'Refreshing...' : `Refresh project "${projectList.find(p => p.id === projectSelectedId)?.name || ''}"`}
        >
          {isProjectLoading ? (
            <Spinner />
          ) : (
            <RefreshIcon className="w-4 h-4" />
          )}
        </button>
        <button
          onClick={onProjectDownload}
          disabled={isDownloadDisabled || isProjectDownloading}
          className="flex items-center justify-center px-2 md:px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors text-xs md:text-sm"
          title={
            !projectSelectedId
              ? 'Select a project first'
              : isSavingCaption
              ? 'Wait for caption to finish saving'
              : isProjectDownloading
              ? 'Downloading...'
              : `Download project "${projectList.find(p => p.id === projectSelectedId)?.name || ''}"`
          }
        >
          {isProjectDownloading ? (
            <Spinner />
          ) : (
            <DownloadIcon className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  </div>
  );
};

export default ActionBar;
