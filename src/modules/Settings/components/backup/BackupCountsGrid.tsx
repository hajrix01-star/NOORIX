import React from 'react';
import { statLabel, sortedCountEntries } from './backupTabHelpers';

/**
 * عرض جدول أعداد الكيانات في تقرير النسخة
 */
export function BackupCountsGrid({ counts, t, lang: _lang }: any) {
  const rows = sortedCountEntries(counts);
  if (!rows.length) {
    return (
      <p className="m-0 text-[13px] text-noorix-muted">—</p>
    );
  }
  const total = rows.reduce((s: any, [, n]: any) => s + (Number(n) || 0), 0);
  return (
    <div className="grid gap-0">
      <div className="mb-2">
        <div className="text-[12px] font-extrabold text-noorix-muted">
          {t('backupReportCounts')}
        </div>
        <div className="text-[12px] text-noorix-muted mt-1">
          {t('backupReportTotalRows')}:{' '}
          <strong dir="ltr">{total.toLocaleString('en-GB')}</strong>
        </div>
      </div>
      {rows.map(([key, val]: any) => (
        <div
          key={key}
          className="flex flex-col gap-1 min-[380px]:flex-row min-[380px]:items-baseline min-[380px]:justify-between min-[380px]:gap-3 text-[13px] py-2 border-b border-noorix-border min-w-0"
        >
          <span className="text-noorix-text min-w-0 break-words">{statLabel(t, key)}</span>
          <span dir="ltr" className="font-semibold tabular-nums shrink-0 min-[380px]:text-end">
            {Number(val).toLocaleString('en-GB')}
          </span>
        </div>
      ))}
    </div>
  );
}
