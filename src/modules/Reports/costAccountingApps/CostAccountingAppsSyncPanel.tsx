import type { ChangeEvent, RefObject } from 'react';
import { Button, FileTrigger, InlineSelect, cn } from '../../../ui';
import { Field, SectionHeading } from './CostAccountingAppsUiParts';
import { lastDayOfMonth, ymdParts } from './costAccountingAppsScreenUtils';

type TranslateFn = (key: string, vars?: Record<string, unknown>) => string;

export function CostAccountingAppsSyncPanel({
  t,
  fileRef,
  importMonthOptions,
  importMonthSelectValue,
  importing,
  onImportSystem,
  onCsvPick,
  setImportFrom,
  setImportTo,
}: {
  t: TranslateFn;
  fileRef: RefObject<HTMLInputElement>;
  importMonthOptions: Array<{ value: string; label: string }>;
  importMonthSelectValue: string;
  importing: boolean;
  onImportSystem: () => void;
  onCsvPick: (event: ChangeEvent<HTMLInputElement>) => void;
  setImportFrom: (value: string) => void;
  setImportTo: (value: string) => void;
}) {
  return (
    <div className="noorix-print-hidden space-y-3 border-t border-noorix-border pt-5 print:hidden">
      <SectionHeading tone="green">{t('reportCostAppsZoneSync')}</SectionHeading>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <Field label={t('reportCostAppsImportMonth')} labelAlign="center" className="min-w-0 flex-1 sm:max-w-[min(100%,20rem)]">
          <InlineSelect
            className={cn(
              'min-h-10 w-full rounded-md border border-noorix-border bg-[var(--noorix-surface-1)] px-3 py-2 text-center text-sm font-semibold text-noorix-text',
            )}
            value={importMonthSelectValue}
            onChange={(event) => {
              const value = event.target.value;
              const [yearRaw, monthRaw] = value.split('-');
              const year = parseInt(yearRaw, 10);
              const month = parseInt(monthRaw, 10);
              if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return;
              setImportFrom(ymdParts(year, month, 1));
              setImportTo(ymdParts(year, month, lastDayOfMonth(year, month)));
            }}
          >
            {importMonthOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </InlineSelect>
        </Field>
        <div className="flex flex-wrap items-end justify-center gap-2 sm:justify-start">
          <Button type="button" variant="secondary" size="sm" disabled={importing} onClick={onImportSystem}>
            {importing ? t('loading') : t('reportCostAppsImportBtn')}
          </Button>
          <FileTrigger
            ref={fileRef}
            label={t('reportCostAppsCsvImport')}
            accept=".csv,text/csv"
            onChange={onCsvPick}
            buttonProps={{ variant: 'ghost', size: 'sm' }}
          />
        </div>
      </div>
    </div>
  );
}
