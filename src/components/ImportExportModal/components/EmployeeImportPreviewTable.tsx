import React from 'react';
import type { ImportValidationResult } from '../types';

type TFn = (key: string, vars?: Record<string, string | number>) => string;

export function EmployeeImportPreviewTable({
  validationResults,
  parsedRows,
  t,
}: {
  validationResults: ImportValidationResult[];
  parsedRows: Record<string, unknown>[];
  t: TFn;
}) {
  const maxRows = 150;
  const slice = validationResults.slice(0, maxRows);
  const headers = [
    t('importPreviewColNum'),
    t('importPreviewColName'),
    t('importPreviewColJoinDate'),
    t('importPreviewColSalary'),
    t('importPreviewColStatus'),
    t('importPreviewColNotes'),
  ];
  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-noorix-border">
      <div className="bg-noorix-bg-muted text-[12px] font-bold text-noorix-muted py-2 px-3 border-b border-noorix-border">
        {t('importEmployeePreviewTitle', {
          shown: Math.min(slice.length, maxRows),
          total: validationResults.length,
        })}
      </div>
      <div className="overflow-auto max-h-[280px]">
        <table className="w-full text-[12px] border-collapse">
          <thead>
            <tr className="bg-noorix-surface sticky top-0 z-[1]">
              {headers.map((h) => (
                <th key={h} className="border-b border-noorix-border whitespace-nowrap py-2 px-2.5 text-right">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((r) => {
              const raw = parsedRows[r.rowNum - 2] || {};
              const nameStr = String(raw['الاسم بالعربية'] ?? raw['الاسم بالإنجليزية'] ?? raw.name ?? '').trim();
              const name = String((r.payload?.name ?? nameStr) || '—');
              const jdStr = String(raw['تاريخ الالتحاق'] ?? raw.joinDate ?? '').trim();
              const jd = String((r.payload?.joinDate ?? jdStr) || '—');
              const salRaw = r.payload?.basicSalary ?? raw['الراتب الأساسي'] ?? raw.basicSalary;
              const sal = salRaw === undefined || salRaw === null || salRaw === '' ? '—' : String(salRaw);
              const ok = r.valid;
              const note = ok
                ? r.warnings.length
                  ? r.warnings.join('؛ ')
                  : t('importPreviewEmptyNote')
                : r.errors.join('؛ ');
              return (
                <tr key={r.rowNum} style={{ background: ok ? 'transparent' : 'var(--noorix-red-6)' }}>
                  <td
                    className="border-b border-noorix-border py-[7px] px-2.5"
                    style={{ fontFamily: 'var(--noorix-font-numbers)' }}
                  >
                    {r.rowNum}
                  </td>
                  <td className="border-b border-noorix-border truncate py-[7px] px-2.5 max-w-[160px]">{name}</td>
                  <td
                    className="border-b border-noorix-border whitespace-nowrap py-[7px] px-2.5"
                    style={{ fontFamily: 'var(--noorix-font-numbers)' }}
                  >
                    {jd}
                  </td>
                  <td
                    className="border-b border-noorix-border py-[7px] px-2.5"
                    style={{ fontFamily: 'var(--noorix-font-numbers)' }}
                  >
                    {sal}
                  </td>
                  <td
                    className="border-b border-noorix-border font-bold py-[7px] px-2.5"
                    style={{ color: ok ? 'var(--noorix-accent-green)' : 'var(--noorix-accent-red)' }}
                  >
                    {ok ? t('importPreviewStatusOk') : t('importPreviewStatusBad')}
                  </td>
                  <td className="border-b border-noorix-border text-noorix-muted truncate py-[7px] px-2.5 max-w-[220px]" title={note}>
                    {note}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {validationResults.length > maxRows && (
        <div className="text-[11px] text-noorix-muted py-1.5 px-3 border-t border-noorix-border">
          {t('importPreviewMoreRows', { n: validationResults.length - maxRows })}
        </div>
      )}
    </div>
  );
}
