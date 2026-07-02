import React from 'react';
import { Button } from '../../../ui';
import type { ImportProgressState } from '../types';
import { ImportExportStatBadge } from './ImportExportProgressBar';

type TFn = (key: string, vars?: Record<string, string | number>) => string;

export function ImportResultPanel({
  progress,
  onClose,
  onImportAnother,
  onDownloadErrors,
  onDownloadWarnings,
  t,
}: {
  progress: ImportProgressState;
  onClose: () => void;
  onImportAnother: () => void;
  onDownloadErrors: () => void;
  onDownloadWarnings: () => void;
  t: TFn;
}) {
  const warnings = progress.warnings || [];
  const errs = progress.errors;
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3"
      style={{ border: `1px solid ${progress.failed === 0 ? 'var(--noorix-accent-green)' : 'var(--color-noorix-amber)'}40` }}
    >
      <p className="text-[13px] font-bold text-noorix-muted uppercase tracking-[0.05em] mb-2">{t('importDoneTitle')}</p>
      <div className="flex flex-wrap gap-3">
        <ImportExportStatBadge count={progress.succeeded} label={t('importStatImportedOk')} color="#16a34a" />
        {progress.failed > 0 && (
          <ImportExportStatBadge count={progress.failed} label={t('importStatFailed')} color="var(--noorix-accent-red)" />
        )}
        {warnings.length > 0 && (
          <ImportExportStatBadge
            count={warnings.length}
            label={t('importStatWarnings')}
            color="var(--noorix-accent-amber)"
          />
        )}
      </div>

      {warnings.length > 0 && (
        <div className="flex flex-col mt-2 gap-[5px] max-h-[200px] overflow-y-auto">
          {warnings.slice(0, 20).map((w, i) => (
            <div
              key={i}
              className="grid gap-2 rounded-lg text-[12px] grid-cols-[56px_1fr] items-start py-[5px] px-2.5 bg-[var(--noorix-yellow-7)]"
            >
              <span className="font-bold text-noorix-amber">
                {t('importValidationRowPrefix')} {w.rowNum}
              </span>
              <span className="text-noorix-amber">{w.message}</span>
            </div>
          ))}
          {warnings.length > 20 && (
            <span className="text-[12px] text-noorix-muted">{t('importMoreWarnings', { n: warnings.length - 20 })}</span>
          )}
          <Button variant="ghost" size="sm" className="self-start" onClick={onDownloadWarnings}>
            {t('importDownloadWarningsReport')}
          </Button>
        </div>
      )}

      {errs.length > 0 && (
        <div className="flex flex-col gap-[5px] max-h-[200px] overflow-y-auto">
          {errs.slice(0, 20).map((e, i) => (
            <div
              key={i}
              className="grid gap-2 rounded-lg text-[13px] grid-cols-[56px_1fr] items-start py-1.5 px-2.5 bg-[var(--noorix-red-7)]"
            >
              <span className="font-bold text-noorix-red">
                {t('importValidationRowPrefix')} {e.rowNum}
              </span>
              <span className="text-noorix-red">{e.message}</span>
            </div>
          ))}
          {errs.length > 20 && (
            <span className="text-[12px] text-noorix-muted">{t('importMoreErrors', { n: errs.length - 20 })}</span>
          )}
          <Button variant="ghost" size="sm" className="self-start" onClick={onDownloadErrors}>
            {t('importDownloadErrorsReport')}
          </Button>
        </div>
      )}

      <div className="flex gap-2.5">
        <Button variant="primary" onClick={onClose}>
          {t('close')}
        </Button>
        <Button onClick={onImportAnother}>{t('importImportAnotherFile')}</Button>
      </div>
    </div>
  );
}
