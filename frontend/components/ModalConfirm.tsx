import React, { useEffect, useState, ReactNode, useRef } from 'react';
import { Spinner, AlertTriangleIcon, InfoIcon, XIcon } from './Icons';

type InitialFocus = 'confirm' | 'cancel' | 'close';

interface ModalConfirmProps {
  isOpen: boolean;
  title: string;
  message: ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'warning' | 'info';
  // Checkbox props
  checkboxLabel?: string;
  checkboxChecked?: boolean;
  onCheckboxChange?: (checked: boolean) => void;
  requireCheckboxToConfirm?: boolean;
  // Loading state
  isLoading?: boolean;
  // Initial focus target
  initialFocus?: InitialFocus;
}

const ModalConfirm: React.FC<ModalConfirmProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'warning',
  checkboxLabel,
  checkboxChecked = false,
  onCheckboxChange,
  requireCheckboxToConfirm = false,
  isLoading = false,
  initialFocus,
}) => {
  const [internalChecked, setInternalChecked] = useState(checkboxChecked);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Focus initial element when modal opens
  useEffect(() => {
    if (!isOpen || !initialFocus) return;

    const focusMap: Record<InitialFocus, React.RefObject<HTMLButtonElement>> = {
      confirm: confirmButtonRef,
      cancel: cancelButtonRef,
      close: closeButtonRef,
    };

    focusMap[initialFocus]?.current?.focus();
  }, [isOpen, initialFocus]);

  // Reset checkbox state when modal opens
  useEffect(() => {
    if (isOpen) {
      setInternalChecked(checkboxChecked);
    }
  }, [isOpen, checkboxChecked]);

  const handleCheckboxChange = (checked: boolean) => {
    setInternalChecked(checked);
    onCheckboxChange?.(checked);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
      }
      // Only allow Enter to confirm if checkbox is not required or is checked
      if (event.key === 'Enter') {
        if (!requireCheckboxToConfirm || internalChecked) {
          onConfirm();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onConfirm, onCancel, internalChecked, requireCheckboxToConfirm]);

  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      confirmBg: 'bg-red-600 hover:bg-red-700',
      confirmFocus: 'focus:ring-red-500 focus:border-red-500',
      icon: <AlertTriangleIcon className="w-12 h-12 text-red-400" />,
    },
    warning: {
      confirmBg: 'bg-orange-600 hover:bg-orange-700',
      confirmFocus: 'focus:ring-orange-500 focus:border-orange-500',
      icon: <AlertTriangleIcon className="w-12 h-12 text-orange-400" />,
    },
    info: {
      confirmBg: 'bg-indigo-600 hover:bg-indigo-700',
      confirmFocus: 'focus:ring-indigo-500 focus:border-indigo-500',
      icon: <InfoIcon className="w-12 h-12 text-indigo-400" />,
    },
  };

  const styles = variantStyles[variant];
  const isConfirmDisabled = requireCheckboxToConfirm && !internalChecked || isLoading;

  const handleConfirm = () => {
    if (!isConfirmDisabled && !isLoading) {
      onConfirm();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md rounded-lg bg-gray-800 shadow-2xl"
      >
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onCancel}
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

          {checkboxLabel && (
            <div className="mt-4">
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative flex items-center mt-0.5">
                  <input
                    type="checkbox"
                    checked={internalChecked}
                    onChange={(e) => handleCheckboxChange(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-orange-500 focus:ring-2 focus:ring-orange-500 focus:ring-offset-gray-800 cursor-pointer"
                  />
                </div>
                <span className="text-sm text-gray-300 group-hover:text-gray-200 select-none">
                  {checkboxLabel}
                </span>
              </label>
            </div>
          )}

          <div className="mt-6 flex flex-col-reverse md:flex-row md:justify-end gap-3">
            <button
              ref={cancelButtonRef}
              type="button"
              onClick={onCancel}
              className="w-full md:w-auto px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
            >
              {cancelText}
            </button>
            <button
              type="button"
              ref={confirmButtonRef}
              onClick={handleConfirm}
              disabled={isConfirmDisabled}
              className={`w-full md:w-auto px-4 py-2 text-white rounded-md transition-colors min-w-[80px] flex items-center justify-center ${
                isConfirmDisabled
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : `${styles.confirmBg} focus:outline-none focus:ring-2 ${styles.confirmFocus}`
              }`}
            >
              {isLoading ? (
                <Spinner />
              ) : (
                confirmText
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModalConfirm;
