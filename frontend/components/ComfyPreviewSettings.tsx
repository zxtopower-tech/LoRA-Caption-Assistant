import React, { useState, useEffect, useRef } from 'react';
import { TrashIcon, Spinner } from './Icons';
import { listWorkflows, uploadWorkflow, deleteWorkflow } from '../services/workflowService';
import type { WorkflowInfo } from '../types';
import { useComfyPreview } from '../contexts/ComfyPreviewContext';
import { useToast } from '../hooks/useToast';
import ModalConfirm from './ModalConfirm';

interface ComfyPreviewSettingsProps {
  serverUrl: string;
  onServerUrlChange: (url: string) => void;
  queueRunning?: number;
  queueRemaining?: number;
}

interface ConfirmModalState {
  isOpen: boolean;
  title: string;
  message: string;
  variant: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
}

export const ComfyPreviewSettings: React.FC<ComfyPreviewSettingsProps> = ({
  serverUrl,
  onServerUrlChange,
  queueRunning = 0,
  queueRemaining = 0,
}) => {
  const {
    workflowMode,
    workflowId,
    setWorkflowId,
    seed,
    setSeed,
    steps,
    setSteps,
    stepsMin,
    setStepsMin,
    stepsMax,
    setStepsMax,
    seedLow,
    setSeedLow,
    seedHigh,
    setSeedHigh,
  } = useComfyPreview();
  const { success: toastSuccess, error: toastError } = useToast();
  const [workflows, setWorkflows] = useState<WorkflowInfo[]>([]);
  const [isLoadingWorkflows, setIsLoadingWorkflows] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string>('');
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load workflows on mount and after upload/delete
  useEffect(() => {
    const loadWorkflows = async () => {
      setIsLoadingWorkflows(true);
      setError('');
      try {
        const workflowList = await listWorkflows();
        setWorkflows(workflowList);
        // If current workflowId is not in the list, reset it
        if (workflowId && !workflowList.find(w => w.filename === workflowId)) {
          setWorkflowId('');
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to load workflows';
        setError(errorMsg);
        toastError(`Failed to load workflows: ${errorMsg}`);
        setWorkflows([]);
      } finally {
        setIsLoadingWorkflows(false);
      }
    };

    loadWorkflows();
  }, [toastError]);  // Load once on mount

  const handleUploadWorkflow = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    // Check if file with same name exists
    const existingWorkflow = workflows.find(w => w.filename === file.name);
    if (existingWorkflow) {
      setConfirmModal({
        isOpen: true,
        title: 'Overwrite Workflow',
        message: `A workflow named "${file.name}" already exists. Do you want to overwrite it?`,
        variant: 'warning',
        onConfirm: async () => {
          setIsUploading(true);
          setError('');
          setUploadSuccess(false);

          try {
            const result = await uploadWorkflow(file);

            // Reload workflows
            const workflowList = await listWorkflows();
            setWorkflows(workflowList);

            // Select the newly uploaded workflow (use sanitized filename from backend)
            setWorkflowId(result.filename);

            toastSuccess('Workflow uploaded successfully!');
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to upload workflow';
            setError(errorMsg);
            toastError(`Failed to upload workflow: ${errorMsg}`);
          } finally {
            setIsUploading(false);
            setConfirmModal(null);
          }
        },
      });
      return;
    }

    setIsUploading(true);
    setError('');
    setUploadSuccess(false);

    try {
      const result = await uploadWorkflow(file);

      // Reload workflows
      const workflowList = await listWorkflows();
      setWorkflows(workflowList);

      // Select the newly uploaded workflow (use sanitized filename from backend)
      setWorkflowId(result.filename);

      toastSuccess('Workflow uploaded successfully!');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to upload workflow';
      setError(errorMsg);
      toastError(`Failed to upload workflow: ${errorMsg}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleDeleteWorkflow = async () => {
    if (!workflowId) return;

    setConfirmModal({
      isOpen: true,
      title: 'Delete Workflow',
      message: `Are you sure you want to delete "${workflowId}"?`,
      variant: 'danger',
      onConfirm: async () => {
        setError('');
        try {
          await deleteWorkflow(workflowId);

          // Reload workflows
          const workflowList = await listWorkflows();
          setWorkflows(workflowList);

          // Clear selection
          setWorkflowId('');
          setConfirmModal(null);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Failed to delete workflow';
          setError(errorMsg);
          toastError(`Failed to delete workflow: ${errorMsg}`);
        }
      },
    });
  };

  return (
    <>
    <div className="space-y-4 p-4 rounded-lg border border-orange-900/30 bg-orange-900/10 animate-fade-in">
      <h3 className="text-lg font-semibold text-orange-300">ComfyUI Preview Settings</h3>

      {/* Server URL */}
      <div>
        <label htmlFor="comfy-server-url" className="block text-sm font-medium text-gray-300 mb-1">
          ComfyUI Server URL
        </label>
        <input
          id="comfy-server-url"
          type="text"
          value={serverUrl}
          onChange={(e) => onServerUrlChange(e.target.value)}
          placeholder="http://localhost:8188"
          className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
        />
      </div>

      {/* Workflow Selection */}
      <div>
        <label htmlFor="comfy-workflow" className="block text-sm font-medium text-gray-300 mb-1">
          Workflow
        </label>
        <div className="flex gap-2">
          <div className="flex-grow relative">
            {isLoadingWorkflows && (
              <div className="absolute right-8 top-1/2 -translate-y-1/2">
                <Spinner size="sm" className="text-orange-400" />
              </div>
            )}
            <select
              id="comfy-workflow"
              value={workflowId}
              onChange={(e) => setWorkflowId(e.target.value)}
              disabled={isLoadingWorkflows || workflows.length === 0}
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed appearance-none pr-8"
            >
              <option value="">Select a workflow...</option>
              {workflows.map((workflow) => (
                <option key={workflow.filename} value={workflow.filename}>
                  {workflow.filename}
                </option>
              ))}
            </select>
          </div>

          {/* Upload Button */}
          <button
            type="button"
            onClick={handleUploadClick}
            disabled={isUploading}
            className="flex-shrink-0 flex items-center justify-center px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-md transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
            title="Upload workflow"
          >
            {isUploading ? (
              <Spinner size="md" />
            ) : (
              <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" x2="12" y1="3" y2="15"/>
              </svg>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleUploadWorkflow}
            className="hidden"
          />

          {/* Delete Button */}
          <button
            onClick={handleDeleteWorkflow}
            disabled={!workflowId}
            className="flex-shrink-0 flex items-center justify-center px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed"
            title="Delete workflow"
          >
            <TrashIcon className="w-5 h-5" />
          </button>
        </div>

        {serverUrl.trim() && !isLoadingWorkflows && workflows.length === 0 && !error && (
          <p className="text-xs text-gray-400 mt-1">No workflows found. Upload one to get started.</p>
        )}
      </div>

      {/* Seed Section - Conditional Rendering based on mode */}
      {workflowMode === 'full_multi' ? (
        // Full multi mode: Seed High and Seed Low
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="comfy-seed-high" className="block text-sm font-medium text-gray-300 mb-1">
              Seed High (KSampler High) <span className="text-gray-500">(use -1 for random)</span>
            </label>
            <input
              id="comfy-seed-high"
              type="number"
              value={seedHigh ?? 42}
              onChange={(e) => {
                if (e.target.value === '') {
                  setSeedHigh(-1);
                  return;
                }
                const val = parseInt(e.target.value, 10);
                if (isNaN(val)) return;
                if (val < 0 && val !== -1) return;
                setSeedHigh(val);
              }}
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="-1"
            />
          </div>
          <div>
            <label htmlFor="comfy-seed-low" className="block text-sm font-medium text-gray-300 mb-1">
              Seed Low (KSampler Low) <span className="text-gray-500">(use -1 for random)</span>
            </label>
            <input
              id="comfy-seed-low"
              type="number"
              value={seedLow ?? 42}
              onChange={(e) => {
                if (e.target.value === '') {
                  setSeedLow(-1);
                  return;
                }
                const val = parseInt(e.target.value, 10);
                if (isNaN(val)) return;
                if (val < 0 && val !== -1) return;
                setSeedLow(val);
              }}
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="-1"
            />
          </div>
        </div>
      ) : (
        // Single mode: Single Seed
        <div>
          <label htmlFor="comfy-seed" className="block text-sm font-medium text-gray-300 mb-1">
            Seed <span className="text-gray-500">(use -1 for random)</span>
          </label>
          <input
            id="comfy-seed"
            type="number"
            value={seed}
            onChange={(e) => setSeed(parseInt(e.target.value, 10) || 42)}
            className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            placeholder="-1"
          />
        </div>
      )}

      {/* Steps Section - Conditional Rendering based on mode */}
      {workflowMode === 'single' ? (
        // Single mode: Single Steps
        <div>
          <label htmlFor="comfy-steps" className="block text-sm font-medium text-gray-300 mb-1">
            Steps
          </label>
          <input
            id="comfy-steps"
            type="number"
            value={steps}
            onChange={(e) => setSteps(Math.max(1, parseInt(e.target.value, 10) || 4))}
            className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            min="1"
            max="50"
          />
        </div>
      ) : (
        // Multi steps / Full multi mode: Steps Min and Steps Max
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="comfy-steps-min" className="block text-sm font-medium text-gray-300 mb-1">
              Steps Min
            </label>
            <input
              id="comfy-steps-min"
              type="number"
              value={stepsMin ?? 3}
              onChange={(e) => setStepsMin(Math.max(1, parseInt(e.target.value, 10) || 3))}
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              min="1"
              max="50"
            />
          </div>
          <div>
            <label htmlFor="comfy-steps-max" className="block text-sm font-medium text-gray-300 mb-1">
              Steps Max
            </label>
            <input
              id="comfy-steps-max"
              type="number"
              value={stepsMax ?? 8}
              onChange={(e) => setStepsMax(Math.max(1, parseInt(e.target.value, 10) || 8))}
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              min="1"
              max="50"
            />
          </div>
        </div>
      )}

      {/* Node Matching Conditions Info */}
      <div className="mt-4 pt-4 border-t border-gray-700">
        <p className="text-xs text-gray-500">
          Detected nodes:
          {workflowMode === 'single' && ' Standard mode (no special nodes detected)'}
          {workflowMode === 'multi_steps' && ' steps_min, steps_max'}
          {workflowMode === 'full_multi' && ' steps_min, steps_max, KSampler Low, KSampler High'}
        </p>
        <p className="text-xs text-gray-600 mt-1">
          Matching: _meta.title equals node name
        </p>
      </div>

      {/* Queue Status */}
      {(queueRunning > 0 || queueRemaining > 0) && (
        <div className="pt-2 border-t border-orange-900/30">
          <div className="flex items-center gap-2 text-sm text-orange-300">
            {queueRunning > 0 && (
              <>
                <Spinner size="sm" />
                <span>Running: {queueRunning}</span>
              </>
            )}
            {queueRemaining > 0 && (
              <>
                {queueRunning > 0 && <span className="text-gray-500">|</span>}
                <span>Queued: {queueRemaining}</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>

    {confirmModal && (
      <ModalConfirm
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText="Confirm"
        cancelText="Cancel"
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(null)}
        variant={confirmModal.variant}
      />
    )}
  </>
  );
};
