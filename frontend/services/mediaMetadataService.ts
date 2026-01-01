import type { MediaMetadata } from '../types';
import { BASE_URL } from './apiConfig';

const normalizeBaseUrl = (baseUrl: string) => baseUrl.replace(/\/+$/, '');

export interface MediaMetadataResponse {
  width: number;
  height: number;
  durationSec?: number;
  fps?: number;
  frameCount?: number;
}

export const fetchMediaMetadata = async (
  file: File,
  signal?: AbortSignal,
): Promise<MediaMetadataResponse> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${normalizeBaseUrl(BASE_URL)}/api/media/metadata`, {
    method: 'POST',
    body: formData,
    signal,
  });

  if (!response.ok) {
    let detail = 'Failed to fetch media metadata.';
    try {
      const payload = (await response.json()) as { detail?: string };
      if (payload.detail) detail = payload.detail;
    } catch {
      // Ignore JSON parse errors.
    }
    throw new Error(detail);
  }

  return (await response.json()) as MediaMetadataResponse;
};

export const mergeMetadata = (
  base: MediaMetadata,
  update: MediaMetadataResponse,
): MediaMetadata => ({
  ...base,
  width: update.width ?? base.width,
  height: update.height ?? base.height,
  durationSec: update.durationSec ?? base.durationSec,
  fps: update.fps ?? base.fps,
  frameCount: update.frameCount ?? base.frameCount,
});
