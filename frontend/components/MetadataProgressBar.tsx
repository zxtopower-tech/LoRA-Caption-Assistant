import React from 'react';
import GenericProgressBar from './GenericProgressBar';

interface MetadataProgressBarProps {
  isMetadataQueueActive: boolean;
  metadataProgress: number;
}

export const MetadataProgressBar: React.FC<MetadataProgressBarProps> = ({
  isMetadataQueueActive,
  metadataProgress,
}) => {
  return (
    <GenericProgressBar
      isActive={isMetadataQueueActive}
      progress={metadataProgress}
      color="emerald"
      offset={0}
    />
  );
};
