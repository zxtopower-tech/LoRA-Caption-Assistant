import type { MediaMetadata } from '../types';

const formatNumber = (value: number, maxDecimals: number) => {
  const rounded = Number(value.toFixed(maxDecimals));
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toString();
};

export const formatBytes = (bytes: number | undefined) => {
  if (bytes === undefined || !Number.isFinite(bytes) || bytes <= 0) return '0B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const decimals = value >= 100 || unitIndex === 0 ? 0 : 1;
  return `${formatNumber(value, decimals)}${units[unitIndex]}`;
};

export const formatDuration = (seconds?: number) => {
  if (seconds === undefined || !Number.isFinite(seconds)) return undefined;
  return formatNumber(seconds, 1);
};

export const formatFps = (fps?: number) => {
  if (fps === undefined || !Number.isFinite(fps)) return undefined;
  return formatNumber(fps, 2);
};

export const buildMetadataLabel = (
  metadata: MediaMetadata,
  isVideo: boolean,
) => {
  const segments: string[] = [];

  if (Number.isFinite(metadata.width) && Number.isFinite(metadata.height)) {
    segments.push(`${metadata.width} x ${metadata.height}`);
  }

  if (isVideo) {
    if (metadata.frameCount !== undefined) {
      segments.push(`${metadata.frameCount}f`);
    }
    const fpsLabel = formatFps(metadata.fps);
    if (fpsLabel) {
      segments.push(`${fpsLabel}fps`);
    }
    const durationLabel = formatDuration(metadata.durationSec);
    if (durationLabel) {
      segments.push(`${durationLabel}s`);
    }
  }

  if (Number.isFinite(metadata.sizeBytes)) {
    segments.push(formatBytes(metadata.sizeBytes));
  }

  return segments.join(' · ');
};
