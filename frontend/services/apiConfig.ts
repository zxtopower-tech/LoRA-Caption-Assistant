/**
 * Centralized Backend URL Configuration
 * All services use this single source of truth for the backend URL
 */

export const getBackendUrl = (): string => {
  // Runtime config (set by index.html)
  if (typeof window !== 'undefined' && (window as any).BACKEND_URL) {
    return (window as any).BACKEND_URL;
  }
  // Fallback (default backend port)
  return 'http://localhost:8001';
};

export const BASE_URL = getBackendUrl();
