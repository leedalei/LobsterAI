import React, { useEffect, useRef, useState } from 'react';
import { i18nService } from '../../services/i18n';
import {
  buildSessionExportFileName,
  normalizeSessionExportFileName,
  type CoworkExportFormat,
} from '../../services/coworkExport';

interface CoworkExportDialogProps {
  isOpen: boolean;
  sessionTitle: string;
  isExporting?: boolean;
  onClose: () => void;
  onConfirm: (fileName: string, format: CoworkExportFormat) => void | Promise<void>;
}

const CoworkExportDialog: React.FC<CoworkExportDialogProps> = ({
  isOpen,
  sessionTitle,
  isExporting = false,
  onClose,
  onConfirm,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [format, setFormat] = useState<CoworkExportFormat>('markdown');

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setFormat('markdown');
    setFileName(buildSessionExportFileName(sessionTitle, new Date(), 'markdown'));
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, [isOpen, sessionTitle]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isExporting) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isExporting, isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop" onClick={() => !isExporting && onClose()}>
      <div
        className="modal-content w-full max-w-lg mx-4 dark:bg-claude-darkSurface bg-claude-surface rounded-2xl shadow-modal overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label={i18nService.t('coworkExportDialogTitle')}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="px-5 py-4 border-b dark:border-claude-darkBorder border-claude-border">
          <h2 className="text-base font-semibold dark:text-claude-darkText text-claude-text">
            {i18nService.t('coworkExportDialogTitle')}
          </h2>
          <p className="mt-1 text-sm dark:text-claude-darkTextSecondary text-claude-textSecondary">
            {i18nService.t('coworkExportDialogDescription')}
          </p>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium dark:text-claude-darkText text-claude-text mb-2">
              {i18nService.t('coworkExportFormatLabel')}
            </label>
            <div className="inline-flex rounded-lg border dark:border-claude-darkBorder border-claude-border p-1 gap-1 dark:bg-claude-darkBg bg-claude-bg">
              {(['markdown', 'pdf'] as CoworkExportFormat[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  disabled={isExporting}
                  onClick={() => {
                    setFormat(option);
                    setFileName((current) => normalizeSessionExportFileName(
                      current || buildSessionExportFileName(sessionTitle, new Date(), option),
                      option,
                    ));
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    format === option
                      ? 'bg-claude-accent text-white'
                      : 'dark:text-claude-darkTextSecondary text-claude-textSecondary hover:bg-claude-surfaceHover dark:hover:bg-claude-darkSurfaceHover'
                  } disabled:opacity-50`}
                >
                  {i18nService.t(option === 'pdf' ? 'coworkExportFormatPdf' : 'coworkExportFormatMarkdown')}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium dark:text-claude-darkText text-claude-text mb-2">
              {i18nService.t('coworkExportFileName')}
            </label>
            <input
              ref={inputRef}
              value={fileName}
              onChange={(event) => setFileName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !isExporting) {
                  void onConfirm(normalizeSessionExportFileName(fileName, format), format);
                }
              }}
              className="w-full rounded-lg border dark:border-claude-darkBorder border-claude-border dark:bg-claude-darkBg bg-claude-bg px-3 py-2 text-sm dark:text-claude-darkText text-claude-text focus:outline-none focus:ring-2 focus:ring-claude-accent"
            />
          </div>
        </div>

        <div className="px-5 py-4 border-t dark:border-claude-darkBorder border-claude-border flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
            className="px-4 py-2 text-sm font-medium rounded-lg dark:text-claude-darkTextSecondary text-claude-textSecondary dark:hover:bg-claude-darkSurfaceHover hover:bg-claude-surfaceHover transition-colors disabled:opacity-50"
          >
            {i18nService.t('cancel')}
          </button>
          <button
            type="button"
            onClick={() => void onConfirm(normalizeSessionExportFileName(fileName, format), format)}
            disabled={isExporting}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-claude-accent hover:bg-claude-accent/90 text-white transition-colors disabled:opacity-50"
          >
            {isExporting ? i18nService.t('coworkExportSubmitting') : i18nService.t('coworkExportConfirm')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CoworkExportDialog;
