/**
 * Workflow Service
 * Backend API client for ComfyUI workflow management
 */

import type { WorkflowInfo } from '../types';
import { BASE_URL } from './apiConfig';

const normalizeBaseUrl = (baseUrl: string) => baseUrl.replace(/\/+$/, '');

const buildWorkflowUrl = (baseUrl: string, path: string) =>
  `${normalizeBaseUrl(baseUrl)}${path}`;

const buildHeaders = () => ({
  'Content-Type': 'application/json',
  Accept: 'application/json',
});

/**
 * List all available workflow files
 */
export const listWorkflows = async (
  signal?: AbortSignal,
): Promise<WorkflowInfo[]> => {
  const response = await fetch(buildWorkflowUrl(BASE_URL, '/api/workflows'), {
    method: 'GET',
    headers: buildHeaders(),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to list workflows: ${response.statusText}`);
  }

  const data = await response.json();
  return data.workflows as WorkflowInfo[];
};

/**
 * Upload a new workflow file
 */
export const uploadWorkflow = async (
  file: File,
  signal?: AbortSignal,
): Promise<{ filename: string; status: string }> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(buildWorkflowUrl(BASE_URL, '/api/workflows'), {
    method: 'POST',
    body: formData,
    // Don't set Content-Type header when sending FormData - browser will set it with boundary
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to upload workflow: ${response.statusText}`);
  }

  return (await response.json()) as { filename: string; status: string };
};

/**
 * Delete a workflow file
 */
export const deleteWorkflow = async (
  filename: string,
  signal?: AbortSignal,
): Promise<void> => {
  const response = await fetch(buildWorkflowUrl(BASE_URL, `/api/workflows/${encodeURIComponent(filename)}`), {
    method: 'DELETE',
    headers: buildHeaders(),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to delete workflow: ${response.statusText}`);
  }
};

/**
 * Get a specific workflow JSON content
 */
export const getWorkflow = async (
  filename: string,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> => {
  const response = await fetch(buildWorkflowUrl(BASE_URL, `/api/workflows/${encodeURIComponent(filename)}`), {
    method: 'GET',
    headers: buildHeaders(),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to get workflow: ${response.statusText}`);
  }

  return (await response.json()) as Record<string, unknown>;
};
