import React from 'react';
import { Button } from '../../../ui';
import type { ImportProgressState } from '../types';
import { ImportExportProgressBar, ImportExportStatBadge } from './ImportExportProgressBar';
import { importProgressPercent } from '../utils/importExportFormatters';

type TFn = (key: string, vars?: Record<string, string | number>) => string;

export function ImportProgressSection({
  progress,
  onAbort,
  t,
}: {
  progress: ImportProgressState;
  onAbort: () => void;
  t: TFn;
}) {
  const pct = importProgressPercent(progress);
  return (
    <div className="rounded-xl border border-noorix-border p-4 flex flex-col gap-3">
      <p className="text-[13px] font-bold text-noorix-muted uppercase tracking-[0.05em] mb-2">{t('importPhaseImporting')}</p>
      <ImportExportProgressBar pct={pct} />
      <div className="flex items-center justify-between text-[13px] text-noorix-muted">
        <span>{t('importProgressOfRows', { current: progress.current, total: progress.total })}</span>
        <span>{pct}%</span>
      </div>
      <div className="flex flex-wrap gap-3">
        <ImportExportStatBadge count={progress.succeeded} label={t('importStatSucceeded')} color="#16a34a" />
        {progress.failed > 0 && (
          <ImportExportStatBadge count={progress.failed} label={t('importStatFailed')} color="var(--noorix-accent-red)" />
        )}
        {(progress.warnings || []).length > 0 && (
          <ImportExportStatBadge
            count={(progress.warnings || []).length}
            label={t('importStatServerWarnings')}
            color="var(--noorix-accent-amber)"
          />
        )}
      </div>
      <Button variant="danger" size="sm" className="self-start" onClick={onAbort}>
        {t('importAbort')}
      </Button>
    </div>
  );
}
