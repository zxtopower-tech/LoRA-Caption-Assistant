/**
 * ComfyUI Service
 * Direct communication with ComfyUI server
 */

import type { ComfyQueueStatus } from '../types';

export interface ComfyServiceConfig {
  baseUrl: string;
}

export interface ComfyWorkflow {
  [key: string]: unknown;
}

export interface ComfyHistoryResponse {
  [promptId: string]: {
    outputs?: {
      [nodeId: string]: {
        images?: Array<{
          filename: string;
          subfolder: string;
          type: string;
        }>;
        text?: string;
      };
    };
  };
}

const normalizeBaseUrl = (baseUrl: string) => baseUrl.replace(/\/+$/, '');

/**
 * Submit workflow to ComfyUI queue
 * Note: Workflow should already be prepared with all parameters before calling this function
 */
export const submitComfyWorkflow = async (
  config: ComfyServiceConfig,
  workflowJson: ComfyWorkflow,
  signal?: AbortSignal,
): Promise<string> => {
  const prompt = { prompt: workflowJson };

  const response = await fetch(`${normalizeBaseUrl(config.baseUrl)}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(prompt),
    signal,
  });

  if (!response.ok) {
    throw new Error(`ComfyUI workflow submission failed: ${response.statusText}`);
  }

  const data = (await response.json()) as { prompt_id: string };
  return data.prompt_id;
};

/**
 * Get ComfyUI queue status
 */
export const getComfyQueueStatus = async (
  config: ComfyServiceConfig,
  signal?: AbortSignal,
): Promise<ComfyQueueStatus> => {
  const response = await fetch(`${normalizeBaseUrl(config.baseUrl)}/queue`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to get ComfyUI queue status: ${response.statusText}`);
  }

  const data = (await response.json()) as ComfyQueueStatus;
  return data;
};

/**
 * Clear ComfyUI queue
 */
export const clearComfyQueue = async (
  config: ComfyServiceConfig,
  signal?: AbortSignal,
): Promise<void> => {
  const response = await fetch(`${normalizeBaseUrl(config.baseUrl)}/queue`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ clear: true }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to clear ComfyUI queue: ${response.statusText}`);
  }
};

/**
 * Get ComfyUI history for a specific prompt
 * Used for polling completion status
 */
export const getComfyHistory = async (
  config: ComfyServiceConfig,
  promptId: string,
  signal?: AbortSignal,
): Promise<ComfyHistoryResponse[string] | null> => {
  const response = await fetch(`${normalizeBaseUrl(config.baseUrl)}/history/${promptId}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    signal,
  });

  if (response.status === 404) {
    // Prompt not found yet (still processing)
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to get ComfyUI history: ${response.statusText}`);
  }

  const data = (await response.json()) as ComfyHistoryResponse;
  return data[promptId] || null;
};

/**
 * Download image from ComfyUI server
 * Returns a Blob for creating object URLs
 */
export const downloadComfyImage = async (
  config: ComfyServiceConfig,
  filename: string,
  subfolder: string = '',
  type: string = 'output',
  signal?: AbortSignal,
): Promise<Blob> => {
  const params = new URLSearchParams({
    filename,
    subfolder,
    type,
  });

  const response = await fetch(`${normalizeBaseUrl(config.baseUrl)}/view?${params.toString()}`, {
    method: 'GET',
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to download image from ComfyUI: ${response.statusText}`);
  }

  return response.blob();
};

/**
 * Generate a random seed for ComfyUI
 */
export const generateRandomSeed = (): number => {
  // ComfyUI typically uses large integers for seeds
  return Math.floor(Math.random() * 1125899906842624); // 2^50
};
