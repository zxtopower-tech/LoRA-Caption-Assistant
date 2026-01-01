import React, { useEffect, ReactNode } from 'react';
import { AlertTriangleIcon, InfoIcon, XIcon } from './Icons';

interface ModalTripleChoiceProps {
  isOpen: boolean;
  title: string;
  message: ReactNode;
  firstText: string;
  secondText: string;
  thirdText: string;
  onFirst: () => void;
  onSecond: () => void;
  onThird: () => void;
  variant?: 'danger' | 'warning' | 'info';
  firstVariant?: 'primary' | 'danger' | 'warning' | 'success';
  secondVariant?: 'primary' | 'danger' | 'warning' | 'success';
}

const ModalTripleChoice: React.FC<ModalTripleChoiceProps> = ({
  isOpen,
  title,
  message,
  firstText,
  secondText,
  thirdText,
  onFirst,
  onSecond,
  onThird,
  variant = 'info',
  firstVariant = 'primary',
  secondVariant = 'warning',
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onThird();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onThird]);

  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      icon: (
        <AlertTriangleIcon className="w-12 h-12 text-red-400" />
      ),
    },
    warning: {
      icon: (
        <AlertTriangleIcon className="w-12 h-12 text-orange-400" />
      ),
    },
    info: {
      icon: (
        <InfoIcon className="w-12 h-12 text-indigo-400" />
      ),
    },
  };

  const buttonVariantStyles = {
    primary: 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500 focus:border-indigo-500',
    danger: 'bg-red-600 hover:bg-red-700 focus:ring-red-500 focus:border-red-500',
    warning: 'bg-orange-600 hover:bg-orange-700 focus:ring-orange-500 focus:border-orange-500',
    success: 'bg-green-600 hover:bg-green-700 focus:ring-green-500 focus:border-green-500',
  };

  const styles = variantStyles[variant];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md rounded-lg bg-gray-800 shadow-2xl"
      >
        <button
          type="button"
          onClick={onThird}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-200 transition-colors z-10"
          aria-label="Close"
        >
          <XIcon className="w-6 h-6" />
        </button>

        <div className="p-6">
          <div className="flex flex-col items-center text-center">
            {styles.icon}
            <h3 className="mt-4 text-xl font-semibold text-white">{title}</h3>
          </div>

          <div className="mt-4 text-gray-300 text-left">
            {message}
          </div>

          <div className="mt-6 flex flex-col-reverse md:flex-row md:justify-end gap-3">
            <button
              type="button"
              onClick={onThird}
              className="w-full md:w-auto px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
            >
              {thirdText}
            </button>
            <button
              type="button"
              onClick={onSecond}
              className={`w-full md:w-auto px-4 py-2 text-white rounded-md transition-colors focus:outline-none focus:ring-2 ${buttonVariantStyles[secondVariant]}`}
            >
              {secondText}
            </button>
            <button
              type="button"
              onClick={onFirst}
              className={`w-full md:w-auto px-4 py-2 text-white rounded-md transition-colors focus:outline-none focus:ring-2 ${buttonVariantStyles[firstVariant]}`}
            >
              {firstText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModalTripleChoice;
