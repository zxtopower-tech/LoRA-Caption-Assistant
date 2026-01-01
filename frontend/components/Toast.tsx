import React from 'react';
import { SuccessIcon, ErrorIcon, InfoIcon, WarningIcon, XIcon } from './Icons';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastProps {
  toast: ToastItem;
  onRemove: (id: string) => void;
}

const ToastIcons: Record<ToastType, JSX.Element> = {
  success: <SuccessIcon className="w-5 h-5" />,
  error: <ErrorIcon className="w-5 h-5" />,
  info: <InfoIcon className="w-5 h-5" />,
  warning: <WarningIcon className="w-5 h-5" />,
};

const ToastStyles: Record<ToastType, string> = {
  success: 'bg-green-600',
  error: 'bg-red-600',
  info: 'bg-blue-600',
  warning: 'bg-yellow-600',
};

export const Toast: React.FC<ToastProps> = ({ toast, onRemove }) => {
  React.useEffect(() => {
    const timer = setTimeout(() => onRemove(toast.id), 5000);
    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-white min-w-[300px] max-w-md animate-slide-in ${ToastStyles[toast.type]}`}
    >
      <div className="shrink-0">
        {ToastIcons[toast.type]}
      </div>
      <span className="text-sm flex-grow">{toast.message}</span>
      <button
        onClick={() => onRemove(toast.id)}
        className="shrink-0 p-1 hover:bg-white/20 rounded transition-colors"
        aria-label="Close"
      >
        <XIcon className="w-4 h-4" />
      </button>
    </div>
  );
};

interface ToastContainerProps {
  toasts: ToastItem[];
  onRemove: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
};
