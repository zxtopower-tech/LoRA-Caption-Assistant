import React from 'react';
import { MediaProvider } from './MediaContext';
import { ApiConfigProvider } from './ApiConfigContext';
import { ConnectionProvider } from './ConnectionContext';
import { SettingsProvider } from './SettingsContext';
import { QueueProvider } from './QueueContext';
import { ComfyQueueProvider } from './ComfyQueueContext';
import { ProfileProvider } from './ProfileContext';
import { ModalProvider } from './ModalContext';
import { MetadataQueueProvider } from './MetadataQueueContext';
import { ProjectProvider } from './ProjectContext';

interface AppProviderProps {
  children: React.ReactNode;
  profileServiceConfig: { baseUrl: string; token?: string };
  buildProfileFile: () => any;
}

export const AppProvider: React.FC<AppProviderProps> = ({
  children,
  profileServiceConfig,
  buildProfileFile,
}) => {
  return (
    <ApiConfigProvider>
      <ConnectionProvider>
        <MediaProvider>
          <SettingsProvider>
          <QueueProvider>
            <ComfyQueueProvider>
              <ProfileProvider profileServiceConfig={profileServiceConfig} buildProfileFile={buildProfileFile}>
                <ModalProvider>
                  <MetadataQueueProvider>
                    <ProjectProvider>
                      {children}
                    </ProjectProvider>
                  </MetadataQueueProvider>
                </ModalProvider>
              </ProfileProvider>
            </ComfyQueueProvider>
          </QueueProvider>
        </SettingsProvider>
      </MediaProvider>
      </ConnectionProvider>
    </ApiConfigProvider>
  );
};
