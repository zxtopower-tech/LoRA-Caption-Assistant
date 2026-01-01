import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

const PROFILE_NAME_FALLBACK = 'Default';

export interface ProfileContextValue {
  // State
  profileName: string;
  projectExtensions: Record<string, unknown>;
  isSavingProfile: boolean;
  lastSavedAt: string;
  profileError: string;

  // Computed
  profileId: string;
  autoSaveStatus: string;

  // Actions
  setProfileName: (name: string) => void;
  setProjectExtensions: (extensions: Record<string, unknown>) => void;
  setIsSavingProfile: (saving: boolean) => void;
  setLastSavedAt: (timestamp: string) => void;
  setProfileError: (error: string) => void;
  saveProfile: () => Promise<void>;
  loadProfile: () => Promise<void>;
  downloadProfile: () => void;
  clearError: () => void;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export const ProfileProvider: React.FC<{
  children: React.ReactNode;
  profileServiceConfig: { baseUrl: string; token?: string };
  buildProfileFile: () => any;
}> = ({ children, profileServiceConfig, buildProfileFile }) => {
  const [profileName, setProfileName] = useState<string>('Default');
  const [projectExtensions, setProjectExtensions] = useState<Record<string, unknown>>({});
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);
  const [lastSavedAt, setLastSavedAt] = useState<string>('');
  const [profileError, setProfileError] = useState<string>('');

  const saveProfile = useCallback(async () => {
    const { saveProfile: saveProfileToService } = require('../services/profileService');
    const profileFile = buildProfileFile();
    const profileId = profileName.trim() || PROFILE_NAME_FALLBACK;

    setIsSavingProfile(true);
    setProfileError('');

    try {
      await saveProfileToService(profileServiceConfig, profileId, profileFile, new AbortController().signal);
      setLastSavedAt(new Date().toISOString());
      setProfileError('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save profile.';
      setProfileError(message);
    } finally {
      setIsSavingProfile(false);
    }
  }, [profileName, profileServiceConfig, buildProfileFile]);

  const loadProfile = useCallback(async () => {
    const { loadProfile: loadProfileFromService } = require('../services/profileService');
    const profileId = profileName.trim() || PROFILE_NAME_FALLBACK;

    setProfileError('');

    try {
      const rawProfile = await loadProfileFromService(profileServiceConfig, profileId, new AbortController().signal);
      if (!rawProfile) {
        setProfileError('Profile not found.');
        return;
      }
      // Profile application logic should be handled by the caller
      setProfileError('');
    } catch (error) {
      if (error instanceof SyntaxError) {
        setProfileError('Invalid profile file.');
        return;
      }
      const message = error instanceof Error ? error.message : 'Failed to load profile.';
      setProfileError(message);
    }
  }, [profileName, profileServiceConfig]);

  const downloadProfile = useCallback(() => {
    try {
      const profileFile = buildProfileFile();
      const sanitizeFileName = (value: string) =>
        value.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').trim();
      const formatTimestamp = (date: Date) => {
        const pad = (value: number) => String(value).padStart(2, '0');
        return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
      };

      const safeBaseName = sanitizeFileName(profileFile.profileName) || PROFILE_NAME_FALLBACK;
      const fileName = `${safeBaseName}-${formatTimestamp(new Date())}.json`;
      const blob = new Blob([JSON.stringify(profileFile, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setProfileError('');
    } catch (error) {
      setProfileError('Failed to download profile.');
    }
  }, [buildProfileFile]);

  const clearError = useCallback(() => {
    setProfileError('');
  }, []);

  const profileId = useMemo(
    () => profileName.trim() || PROFILE_NAME_FALLBACK,
    [profileName]
  );

  const autoSaveStatus = useMemo(() => {
    if (isSavingProfile) {
      return 'Auto-save: Saving...';
    }
    if (lastSavedAt) {
      return `Auto-save: Last saved ${lastSavedAt}`;
    }
    return 'Auto-save: On (Profile Service, Global Settings only)';
  }, [isSavingProfile, lastSavedAt]);

  const value = useMemo<ProfileContextValue>(
    () => ({
      profileName,
      projectExtensions,
      isSavingProfile,
      lastSavedAt,
      profileError,
      profileId,
      autoSaveStatus,
      setProfileName,
      setProjectExtensions,
      setIsSavingProfile,
      setLastSavedAt,
      setProfileError,
      saveProfile,
      loadProfile,
      downloadProfile,
      clearError,
    }),
    [
      profileName,
      projectExtensions,
      isSavingProfile,
      lastSavedAt,
      profileError,
      profileId,
      autoSaveStatus,
      saveProfile,
      loadProfile,
      downloadProfile,
      clearError,
    ]
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
};

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within ProfileProvider');
  }
  return context;
};
