import type { ProfileFile } from '../types';

export interface ProfileServiceConfig {
  baseUrl: string;
  token?: string;
}

const normalizeBaseUrl = (baseUrl: string) => baseUrl.replace(/\/+$/, '');

const buildProfileUrl = (baseUrl: string, profileId: string) =>
  `${normalizeBaseUrl(baseUrl)}/api/profiles/${encodeURIComponent(profileId)}`;

const buildHeaders = (token?: string) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

export const saveProfile = async (
  config: ProfileServiceConfig,
  profileId: string,
  payload: ProfileFile,
  signal?: AbortSignal,
) => {
  const response = await fetch(buildProfileUrl(config.baseUrl, profileId), {
    method: 'PUT',
    headers: buildHeaders(config.token),
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    throw new Error('Failed to save profile.');
  }
};

export const loadProfile = async (
  config: ProfileServiceConfig,
  profileId: string,
  signal?: AbortSignal,
): Promise<ProfileFile | null> => {
  const response = await fetch(buildProfileUrl(config.baseUrl, profileId), {
    method: 'GET',
    headers: buildHeaders(config.token),
    signal,
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error('Failed to load profile.');
  }

  return (await response.json()) as ProfileFile;
};
