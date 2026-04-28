import React from 'react';
import { Button } from '../../../ui';
import type { ImportEntityType } from '../types';

type TFn = (key: string, vars?: Record<string, string | number>) => string;

export function ExportPanel({
  entityType,
  t,
  exporting,
  onExport,
}: {
  entityType: ImportEntityType;
  t: TFn;
  exporting: boolean;
  onExport: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-noorix-border p-4 flex flex-col gap-2.5">
        <p className="m-0 text-[14px] text-noorix-muted leading-[1.6]">{t('importExportIntro')}</p>
        {entityType === 'employees' && (
          <div className="mt-1">
            <p className="text-[13px] font-bold text-noorix-muted uppercase tracking-[0.05em] mb-2 mt-0">
              {t('importEmployeeExportColumnsTitle')}
            </p>
            <p className="m-0 text-[12px] text-noorix-muted leading-[1.65]">{t('importEmployeeExportColumnsList')}</p>
          </div>
        )}
        <div className="flex gap-2.5 flex flex-wrap">
          <Button variant="primary" onClick={onExport} disabled={exporting} loading={exporting}>
            {exporting ? t('importExporting') : t('importExportDownloadExcel')}
          </Button>
        </div>
      </div>
    </div>
  );
}
