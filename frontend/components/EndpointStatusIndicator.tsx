import React from 'react';
import { LoaderIcon, CheckIcon, XIcon } from './Icons';
import type { EndpointStatus } from '../types';

interface EndpointStatusIndicatorProps {
  status: EndpointStatus;
  size?: 'sm' | 'md';
  className?: string;
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
};

const EndpointStatusIndicator: React.FC<EndpointStatusIndicatorProps> = ({
  status,
  size = 'sm',
  className = '',
}) => {
  const iconSize = sizeClasses[size];

  switch (status) {
    case 'checking':
      return (
        <div className={`flex items-center justify-center ${className}`}>
          <LoaderIcon className={`${iconSize} text-orange-500 animate-spin`} />
        </div>
      );
    case 'success':
      return (
        <div className={`flex items-center justify-center ${className}`}>
          <CheckIcon className={`${iconSize} text-green-400`} />
        </div>
      );
    case 'error':
      return (
        <div className={`flex items-center justify-center ${className}`}>
          <XIcon className={`${iconSize} text-red-400`} />
        </div>
      );
    case 'idle':
    default:
      return null;
  }
};

export default EndpointStatusIndicator;
