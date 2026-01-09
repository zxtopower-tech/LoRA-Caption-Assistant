/**
 * System Service
 * Handles system-related API calls such as version checking
 */

import { BASE_URL } from './apiConfig';
import type { SystemVersion } from '../types';

const normalizeBaseUrl = (baseUrl: string) => baseUrl.replace(/\/+$/, '');

/**
 * Fetch system version information
 * Checks for updates against GitHub releases
 */
export const fetchSystemVersion = async (
  signal?: AbortSignal
): Promise<SystemVersion> => {
  const response = await fetch(
    `${normalizeBaseUrl(BASE_URL)}/api/system/version`,
    {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal,
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch system version: ${response.statusText}`);
  }

  return await response.json();
};
