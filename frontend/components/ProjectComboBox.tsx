import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { ProjectMetadata } from '../services/projectService';
import { ChevronDownIcon, XIcon, TrashIcon } from './Icons';
import ModalConfirm from './ModalConfirm';

interface ProjectComboBoxProps {
  projects: ProjectMetadata[];
  selectedId: string | null;
  onChange: (projectId: string | null) => void | Promise<void>;
  onBeforeChange?: (project: ProjectMetadata) => boolean | Promise<boolean>;
  onCreateProject: (projectName: string) => Promise<void>;
  onDeleteProject?: (projectId: string) => void;
  isCreating?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const ProjectComboBox: React.FC<ProjectComboBoxProps> = ({
  projects,
  selectedId,
  onChange,
  onBeforeChange,
  onCreateProject,
  onDeleteProject,
  isCreating = false,
  placeholder = 'Select or create project...',
  disabled = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [filteredProjects, setFilteredProjects] = useState<ProjectMetadata[]>(projects);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const comboBoxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update input value when selection changes from outside
  useEffect(() => {
    if (selectedId) {
      const selectedProject = projects.find(p => p.id === selectedId);
      if (selectedProject) {
        setInputValue(selectedProject.name);
      } else {
        setInputValue('');
      }
    } else {
      setInputValue('');
    }
  }, [selectedId, projects]);

  // Always show all projects (no filtering)
  useEffect(() => {
    setFilteredProjects(projects);
  }, [projects]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (comboBoxRef.current && !comboBoxRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setIsOpen(true);
  };

  const handleProjectSelect = async (project: ProjectMetadata) => {
    // Prevent re-selecting the same project
    if (project.id === selectedId) {
      setIsOpen(false);
      return;
    }

    // Call onBeforeChange callback if provided
    if (onBeforeChange) {
      const canChange = await onBeforeChange(project);
      if (!canChange) {
        return;  // Selection cancelled, don't proceed
      }
    }

    // Proceed with selection
    setInputValue(project.name);
    setIsOpen(false);
    await onChange(project.id);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // Prioritize creating new project if "Create new" hint is visible
      if (showCreateHint && inputValue.trim() && !isCreating) {
        handleCreateProject();
      } else if (filteredProjects.length > 0) {
        handleProjectSelect(filteredProjects[0]);
      } else if (inputValue.trim() && !isCreating) {
        handleCreateProject();
      }
    } else if (e.key === 'Tab') {
      setIsOpen(false);
    }
  };

  const showCreateHint = inputValue.trim() !== '' && !filteredProjects.some(
    p => p.name.toLowerCase() === inputValue.trim().toLowerCase()
  );
  const hasSelection = selectedId !== null;

  // Handle create project
  const handleCreateProject = async () => {
    if (!inputValue.trim() || isCreating) return;
    setIsOpen(false);  // Close dropdown before creating
    await onCreateProject(inputValue.trim());
  };

  const handleClear = () => {
    setShowClearConfirm(true);
  };

  const handleConfirmClear = () => {
    setShowClearConfirm(false);
    setInputValue('');
    setIsOpen(false);
    onChange(null);
    inputRef.current?.focus();
  };

  const handleCancelClear = () => {
    setShowClearConfirm(false);
  };

  const handleDeleteProject = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation(); // Prevent project selection
    if (!onDeleteProject) return;
    onDeleteProject(projectId);
  };

  return (
    <>
      <div ref={comboBoxRef} className={`relative ${className}`}>
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={placeholder}
            className={`w-full px-3 py-1.5 rounded-md text-white placeholder-gray-400 focus:ring-2 disabled:bg-gray-800 disabled:cursor-not-allowed text-sm ${hasSelection
              ? 'bg-blue-800 border-2 border-blue-400 focus:border-blue-400 focus:ring-blue-400 pr-16'
              : 'bg-gray-700 border-2 border-gray-600 focus:border-indigo-500 focus:ring-indigo-500 pr-10'
              }`}
          />
          <div className="absolute right-1 top-1/2 transform -translate-y-1/2 flex items-center gap-0.5">
            {hasSelection && (
              <button
                type="button"
                onClick={handleClear}
                disabled={disabled}
                className="p-0.5 text-gray-400 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                aria-label="Clear selection"
                tabIndex={-1}
              >
                <XIcon className="w-3 h-3" />
              </button>
            )}
            <button
              type="button"
              onClick={() => !disabled && setIsOpen(!isOpen)}
              disabled={disabled}
              className="p-1 text-gray-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={isOpen ? 'Close dropdown' : 'Open dropdown'}
              tabIndex={-1}
            >
              <ChevronDownIcon className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {isOpen && !disabled && (
          <div className="absolute z-50 w-full mt-1 bg-gray-700 border border-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
            {showCreateHint && (
              <div
                onClick={() => !isCreating && handleCreateProject()}
                className={`px-3 py-2 text-sm text-indigo-400 italic cursor-pointer hover:bg-gray-600 border-b border-gray-600 ${isCreating ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isCreating ? 'Creating...' : `Create new: "${inputValue}"`}
              </div>
            )}
            {filteredProjects.length > 0 ? (
              filteredProjects.map((project) => (
                <div
                  key={project.id}
                  className="px-3 py-2 hover:bg-gray-600 transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <div
                      onClick={() => handleProjectSelect(project)}
                      className="flex-1 min-w-0 flex items-center gap-2 cursor-pointer"
                    >
                      {project.id === selectedId && (
                        <span className="text-green-400">✓</span>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white truncate">{project.name}</div>
                        <div className="text-xs text-gray-400 truncate">
                          {new Date(project.updatedAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    {onDeleteProject && (
                      <button
                        onClick={(e) => handleDeleteProject(e, project.id)}
                        className="p-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                        title="Delete project"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : !showCreateHint && (
              <div className="px-3 py-2 text-sm text-gray-400">
                No projects found
              </div>
            )}
          </div>
        )}
      </div>

      {createPortal(
        <ModalConfirm
          isOpen={showClearConfirm}
          title="Disconnect Project"
          message={
            <div>
              <p className="mb-2">Are you sure you want to disconnect from the current project?</p>
              <p className="text-sm text-gray-400">This will not delete the project, but you will need to select it again to continue working.</p>
            </div>
          }
          confirmText="Disconnect"
          cancelText="Cancel"
          onConfirm={handleConfirmClear}
          onCancel={handleCancelClear}
          variant="warning"
        />,
        document.body
      )}
    </>
  );
};

export default ProjectComboBox;
