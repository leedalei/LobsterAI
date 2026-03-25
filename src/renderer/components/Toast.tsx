import React from 'react';
import { XMarkIcon, InformationCircleIcon } from '@heroicons/react/24/outline';

interface ToastProps {
  message: string;
  onClose?: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop">
      <div className="relative inline-flex max-w-[calc(100vw-2rem)] mx-4 rounded-2xl border border-claude-border/60 dark:border-claude-darkBorder/60 bg-white/95 dark:bg-claude-darkSurface/95 text-claude-text dark:text-claude-darkText px-5 py-3.5 shadow-xl backdrop-blur-md animate-scale-in">
        <div className="flex min-w-0 items-center gap-3 pr-8">
          <div className="shrink-0 rounded-full bg-claude-accent/10 p-2.5">
            <InformationCircleIcon className="h-5 w-5 text-claude-accent" />
          </div>
          <div className="min-w-0 text-sm font-medium leading-snug">
            {message}
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="absolute right-3 top-1/2 -translate-y-1/2 shrink-0 text-claude-textSecondary dark:text-claude-darkTextSecondary hover:text-claude-text dark:hover:text-claude-darkText rounded-full p-1 hover:bg-claude-surfaceHover dark:hover:bg-claude-darkSurfaceHover transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default Toast;
