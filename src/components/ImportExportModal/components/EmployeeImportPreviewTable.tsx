import React from 'react';
import type { ImportValidationResult } from '../types';
import { SimpleTable } from '../../../ui';
import type { SimpleTableColumn } from '../../../ui';

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
  const rows = slice.map((r) => {
    const raw = parsedRows[r.rowNum - 2] || {};
    const nameStr = String(raw['الاسم بالعربية'] ?? raw['الاسم بالإنجليزية'] ?? raw.name ?? '').trim();
    const joinDateStr = String(raw['تاريخ الالتحاق'] ?? raw.joinDate ?? '').trim();
    const salaryRaw = r.payload?.basicSalary ?? raw['الراتب الأساسي'] ?? raw.basicSalary;
    const ok = r.valid;
    return {
      rowNum: r.rowNum,
      name: String((r.payload?.name ?? nameStr) || '—'),
      joinDate: String((r.payload?.joinDate ?? joinDateStr) || '—'),
      salary: salaryRaw === undefined || salaryRaw === null || salaryRaw === '' ? '—' : String(salaryRaw),
      ok,
      status: ok ? t('importPreviewStatusOk') : t('importPreviewStatusBad'),
      note: ok
        ? r.warnings.length
          ? r.warnings.join('؛ ')
          : t('importPreviewEmptyNote')
        : r.errors.join('؛ '),
    };
  });
  const columns: SimpleTableColumn<(typeof rows)[number]>[] = [
    {
      key: 'rowNum',
      label: headers[0],
      render: (v) => <span className="nx-cell-num">{String(v)}</span>,
    },
    {
      key: 'name',
      label: headers[1],
      render: (v) => <span className="block max-w-[160px] truncate">{String(v)}</span>,
    },
    {
      key: 'joinDate',
      label: headers[2],
      render: (v) => <span className="nx-cell-num whitespace-nowrap">{String(v)}</span>,
    },
    {
      key: 'salary',
      label: headers[3],
      numeric: true,
      render: (v) => <span className="nx-cell-num">{String(v)}</span>,
    },
    {
      key: 'status',
      label: headers[4],
      render: (_v, row) => (
        <span className={`font-bold ${row.ok ? 'text-noorix-green' : 'text-noorix-red'}`}>
          {row.status}
        </span>
      ),
    },
    {
      key: 'note',
      label: headers[5],
      render: (v) => (
        <span className="block max-w-[220px] truncate text-noorix-muted" title={String(v)}>
          {String(v)}
        </span>
      ),
    },
  ];
  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-noorix-border">
      <div className="bg-noorix-bg-muted text-[12px] font-bold text-noorix-muted py-2 px-3 border-b border-noorix-border">
        {t('importEmployeePreviewTitle', {
          shown: Math.min(slice.length, maxRows),
          total: validationResults.length,
        })}
      </div>
      <div>
        <SimpleTable
          columns={columns}
          data={rows}
          tableMinWidth={640}
          maxHeight={280}
          compact
          stickyHeader
          frameClassName="border-0 rounded-none shadow-none"
          getRowStyle={(row) => (row.ok ? undefined : { background: 'var(--noorix-red-6)' })}
        />
      </div>
      {validationResults.length > maxRows && (
        <div className="text-[11px] text-noorix-muted py-1.5 px-3 border-t border-noorix-border">
          {t('importPreviewMoreRows', { n: validationResults.length - maxRows })}
        </div>
      )}
    </div>
  );
}
