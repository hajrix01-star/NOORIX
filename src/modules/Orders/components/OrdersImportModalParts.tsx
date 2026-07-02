import React from 'react';
import { Button, SimpleTable } from '../../../ui';
import type { SimpleTableColumn } from '../../../ui';

type RowStatus = 'new' | 'duplicate' | 'invalid';
type FilterType = 'all' | RowStatus;

type ParsedRow = {
  status: RowStatus;
  reason: string;
  nameAr: string;
  nameEn: string;
  category: string;
  sectionsSummary: string;
  variantsSummary: string;
  payload: Record<string, unknown> | null;
};

type TranslateFn = (key: string, vars?: unknown) => string;

export function StepIndicator({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="flex items-center gap-1 mb-5" aria-label="progress">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <React.Fragment key={i}>
            <div className={`flex items-center gap-1.5 text-[11px] whitespace-nowrap ${active ? 'text-noorix-primary font-semibold' : done ? 'text-noorix-primary' : 'text-noorix-muted'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 transition-colors ${done ? 'bg-noorix-primary text-white' : active ? 'border-2 border-noorix-primary text-noorix-primary' : 'border border-noorix-border text-noorix-muted'}`}>
                {done ? '✓' : i + 1}
              </span>
              <span className="hidden sm:inline">{label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-px transition-colors ${i < current ? 'bg-noorix-primary' : 'bg-noorix-border'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function StatusBadge({ status, label }: { status: RowStatus; label: string }) {
  const styles: Record<RowStatus, string> = {
    new: 'bg-green-50 border-green-200 text-green-700',
    duplicate: 'bg-amber-50 border-amber-200 text-amber-700',
    invalid: 'bg-red-50 border-red-200 text-red-700',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-semibold ${styles[status]}`}>
      {label}
    </span>
  );
}

export function OrdersImportProgress({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-10 h-10 border-[3px] border-noorix-primary border-t-transparent rounded-full animate-spin" />
      <p className="text-[13px] text-noorix-muted m-0">{label}</p>
    </div>
  );
}

export function OrdersImportDone({ result, t }: { result: { imported: number; skipped: number; invalid: number; error?: string } | null; t: TranslateFn }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-5">
      <span className="text-5xl leading-none select-none">{result?.error ? '❌' : '✅'}</span>
      <div className="text-center flex flex-col gap-1.5">
        <p className="text-[16px] font-semibold text-noorix-text m-0">{t('importDoneTitle')}</p>
        {result && (
          <div className="flex flex-col gap-1 text-[13px] mt-1">
            {result.imported > 0 && (
              <p className="text-green-700 m-0">✅ {t('importDoneImported', String(result.imported))}</p>
            )}
            {result.skipped > 0 && (
              <p className="text-amber-600 m-0">⏭ {t('importDoneSkipped', String(result.skipped))}</p>
            )}
            {result.invalid > 0 && (
              <p className="text-red-500 m-0">❌ {t('importDoneInvalid', String(result.invalid))}</p>
            )}
            {result.error && (
              <p className="text-red-600 m-0 text-[12px]">{result.error}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function OrdersImportPreview({
  t,
  isProducts,
  needsImportSections,
  importSectionsNode,
  counts,
  newCategoriesToCreate,
  filter,
  setFilter,
  filteredRows,
  skipDuplicates,
  setSkipDuplicates,
  toImportCount,
}: {
  t: TranslateFn;
  isProducts: boolean;
  needsImportSections: boolean;
  importSectionsNode: React.ReactNode;
  counts: Record<'total' | 'new' | 'duplicate' | 'invalid', number>;
  newCategoriesToCreate: string[];
  filter: FilterType;
  setFilter: (filter: FilterType) => void;
  filteredRows: ParsedRow[];
  skipDuplicates: boolean;
  setSkipDuplicates: (value: boolean) => void;
  toImportCount: number;
}) {
  const filterOpts: { key: FilterType; label: string; count: number }[] = [
    { key: 'all', label: t('importFilterAll'), count: counts.total },
    { key: 'new', label: t('importFilterNew'), count: counts.new },
    { key: 'duplicate', label: t('importFilterDuplicate'), count: counts.duplicate },
    { key: 'invalid', label: t('importFilterInvalid'), count: counts.invalid },
  ];
  const previewColumns: SimpleTableColumn<ParsedRow>[] = [
    {
      key: 'status',
      label: t('importColStatus'),
      width: 96,
      render: (_: unknown, row) => (
        <StatusBadge
          status={row.status}
          label={t(row.status === 'new' ? 'importStatusNew' : row.status === 'duplicate' ? 'importStatusDuplicate' : 'importStatusInvalid')}
        />
      ),
    },
    {
      key: 'nameAr',
      label: t('productNameAr'),
      render: (v, row) => (
        <span className="block max-w-[150px] truncate font-medium" title={row.nameAr}>
          {String(v || '')}
        </span>
      ),
    },
    {
      key: 'nameEn',
      label: t('productNameEn'),
      render: (v, row) => (
        <span className="block max-w-[120px] truncate text-noorix-muted" title={row.nameEn}>
          {String(v || '—')}
        </span>
      ),
    },
    ...(isProducts
      ? [
          {
            key: 'category',
            label: t('ordersCategories'),
            render: (v: unknown, row: ParsedRow) => (
              <span className="block max-w-[100px] truncate text-noorix-muted" title={row.category}>
                {String(v || '—')}
              </span>
            ),
          },
        ]
      : []),
    ...(isProducts && needsImportSections
      ? [
          {
            key: 'sectionsSummary',
            label: t('productSections'),
            render: (v: unknown, row: ParsedRow) => (
              <span className="block max-w-[100px] truncate text-noorix-muted" title={row.sectionsSummary}>
                {String(v || '—')}
              </span>
            ),
          },
        ]
      : []),
    ...(isProducts
      ? [
          {
            key: 'variantsSummary',
            label: t('ordersProductVariants'),
            render: (v: unknown) => <span className="text-noorix-muted">{String(v || '—')}</span>,
          },
        ]
      : []),
    {
      key: 'reason',
      label: t('importColReason'),
      render: (v, row) => (
        <span
          className={
            row.status === 'invalid'
              ? 'text-red-600'
              : row.status === 'duplicate'
                ? 'text-amber-600'
                : 'text-noorix-muted'
          }
        >
          {String(v || '—')}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {importSectionsNode}
      <div className="flex flex-wrap gap-2">
        {counts.new > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 border border-green-200 text-green-700 text-[12px] font-semibold">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block flex-shrink-0" />
            {counts.new} {t('importStatusNew')}
          </span>
        )}
        {counts.duplicate > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[12px] font-semibold">
            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block flex-shrink-0" />
            {counts.duplicate} {t('importStatusDuplicate')}
          </span>
        )}
        {counts.invalid > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 border border-red-200 text-red-700 text-[12px] font-semibold">
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block flex-shrink-0" />
            {counts.invalid} {t('importStatusInvalid')}
          </span>
        )}
        {isProducts && newCategoriesToCreate.length > 0 && (
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[12px] font-semibold cursor-help"
            title={newCategoriesToCreate.join('، ')}
          >
            <span className="text-[11px]">✨</span>
            {t('importNewCategoriesBadge', String(newCategoriesToCreate.length))}
          </span>
        )}
      </div>

      <div className="flex gap-0 border-b border-noorix-border overflow-x-auto">
        {filterOpts.map(({ key, label, count }) => {
          if (count === 0 && key !== 'all') return null;
          return (
            <Button
              key={key}
              type="button"
              variant="raw"
              size="auto"
              onClick={() => setFilter(key)}
              className={`px-4 py-2 text-[12px] font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${
                filter === key
                  ? 'border-noorix-primary text-noorix-primary'
                  : 'border-transparent text-noorix-muted hover:text-noorix-text'
              }`}
            >
              {label}
              <span className={`ms-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${filter === key ? 'bg-noorix-primary/10' : 'bg-noorix-bg-muted'}`}>
                {count}
              </span>
            </Button>
          );
        })}
      </div>

      <div className="rounded-lg border border-noorix-border">
        <SimpleTable
          columns={previewColumns}
          data={filteredRows}
          tableMinWidth={480}
          maxHeight={320}
          compact
          stickyHeader
          frameClassName="border-0 rounded-none shadow-none"
          emptyMessage={t('ordersNoSearchResults')}
          getRowClassName={(row) =>
            row.status === 'invalid'
              ? 'bg-red-50/30'
              : row.status === 'duplicate'
                ? 'bg-amber-50/20'
                : undefined
          }
        />
      </div>

      {counts.duplicate > 0 && (
        <label className="flex items-center gap-2.5 cursor-pointer text-[12px] text-noorix-text select-none w-fit">
          <input
            type="checkbox"
            checked={!skipDuplicates}
            onChange={(e) => setSkipDuplicates(!e.target.checked)}
            className="cursor-pointer w-3.5 h-3.5"
          />
          <span>{t('importOverwriteDuplicates')} <span className="text-noorix-muted">({counts.duplicate})</span></span>
        </label>
      )}

      {toImportCount === 0 && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-700 px-3 py-2 text-[12px]">
          {t('importNothingToImport')}
        </div>
      )}
    </div>
  );
}

export function OrdersImportFooter({
  phase,
  onClose,
  onBack,
  onImport,
  toImportCount,
  importSectionsOk,
  t,
}: {
  phase: string;
  onClose: () => void;
  onBack: () => void;
  onImport: () => void;
  toImportCount: number;
  importSectionsOk: boolean;
  t: TranslateFn;
}) {
  if (phase === 'upload') {
    return (
      <div className="flex justify-end">
        <Button variant="ghost" onClick={onClose}>{t('cancel')}</Button>
      </div>
    );
  }
  if (phase === 'parsing' || phase === 'importing') return null;
  if (phase === 'preview') {
    return (
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" onClick={onBack}>{t('importBackBtn')}</Button>
        <Button
          variant="primary"
          onClick={onImport}
          disabled={toImportCount === 0 || !importSectionsOk}
        >
          {t('importConfirmBtn', String(toImportCount))}
        </Button>
      </div>
    );
  }
  if (phase === 'done') {
    return (
      <div className="flex justify-end">
        <Button variant="primary" onClick={onClose}>{t('importCloseBtn')}</Button>
      </div>
    );
  }
  return null;
}
