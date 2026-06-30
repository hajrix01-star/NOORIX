import React from 'react';
import { useTranslation } from '../../../../i18n/useTranslation';
import { FmtNum } from '../../../../ui';
import { cn } from '../../../../ui/cn';
import type { YearMonthlyDailyAvgRow } from '../utils/dashboardOverviewBuilders';

type Props = {
  year: number;
  rows: YearMonthlyDailyAvgRow[];
  selectedMonth: number | null;
};

const COL_MONTH = '22%';
const COL_SALES = '28%';
const COL_AVG = '32%';
const COL_DELTA = '18%';

const TH_CELL =
  'border border-noorix-border bg-noorix-bg-muted py-1 text-[9px] font-bold leading-tight text-noorix-text';
const TD_CELL = 'border border-noorix-border py-1 align-middle text-[10px] leading-tight';

function formatDeltaPct(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  if (Object.is(rounded, -0)) return '0';
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(1);
}

function valueToneClass(tone: YearMonthlyDailyAvgRow['tone'], hasValue: boolean): string {
  if (!hasValue) return 'text-noorix-muted';
  if (tone === 'up') return 'text-noorix-blue';
  if (tone === 'down') return 'text-noorix-red';
  return 'text-noorix-text';
}

function deltaToneClass(delta: number | null): string {
  if (delta == null) return 'text-noorix-muted';
  if (delta > 0) return 'text-noorix-blue';
  if (delta < 0) return 'text-noorix-red';
  return 'text-noorix-muted';
}

function rowHighlightClass(row: YearMonthlyDailyAvgRow, isSelected: boolean): string {
  return cn(
    row.isCurrentMonth && 'bg-[color-mix(in_srgb,var(--color-nx-sales)_6%,transparent)]',
    isSelected && !row.isCurrentMonth && 'bg-noorix-bg-muted/40',
  );
}

function MonthCell({ row, t }: { row: YearMonthlyDailyAvgRow; t: (key: string) => string }) {
  return (
    <div className="flex min-w-0 items-center justify-center gap-1">
      <span className="whitespace-nowrap text-[10px] font-semibold text-noorix-text" title={row.monthLabel}>
        {row.monthLabel}
      </span>
      {row.isCurrentMonth ? (
        <>
          <span
            className="size-1.5 shrink-0 rounded-full bg-noorix-blue sm:hidden"
            title={t('dashboardYearlyDailyAvgCurrentBadge')}
            aria-label={t('dashboardYearlyDailyAvgCurrentBadge')}
          />
          <span className="hidden shrink-0 rounded bg-[color-mix(in_srgb,var(--color-nx-sales)_14%,transparent)] px-1 py-px text-[8px] font-bold leading-none text-noorix-blue sm:inline">
            {t('dashboardYearlyDailyAvgCurrentBadge')}
          </span>
        </>
      ) : null}
    </div>
  );
}

function AvgHeader({ t }: { t: (key: string) => string }) {
  return (
    <>
      <span className="sm:hidden">{t('dashboardYearlyDailyAvgAvgColShort')}</span>
      <span className="hidden sm:inline">{t('dashboardSalesDailyAvgActiveDays')}</span>
    </>
  );
}

function MoneyValue({
  value,
  className,
}: {
  value: number | null;
  className?: string;
}) {
  if (value == null) {
    return <span className="font-semibold text-noorix-muted">-</span>;
  }
  return (
    <span dir="ltr" className="inline-flex max-w-full items-baseline justify-center gap-0.5 whitespace-nowrap nx-font-numbers">
      <FmtNum n={value} className={cn('font-bold', className)} />
      <span className="nx-sar text-[8px] text-noorix-muted">SR</span>
    </span>
  );
}

function DeltaCell({ row }: { row: YearMonthlyDailyAvgRow }) {
  if (row.deltaPctVsPrev == null) {
    return <span className="font-semibold text-noorix-muted nx-font-numbers">-</span>;
  }
  return (
    <span
      dir="ltr"
      className={cn(
        'whitespace-nowrap font-bold tabular-nums nx-font-numbers',
        deltaToneClass(row.deltaPctVsPrev),
      )}
    >
      {row.deltaPctVsPrev > 0 ? '+' : ''}
      {formatDeltaPct(row.deltaPctVsPrev)}%
    </span>
  );
}

function YearlyDailyAvgTable({
  rows,
  selectedMonth,
  t,
}: {
  rows: YearMonthlyDailyAvgRow[];
  selectedMonth: number | null;
  t: (key: string) => string;
}) {
  return (
    <div className="w-full min-w-0 overflow-hidden rounded-lg border border-noorix-border bg-noorix-bg-muted/25">
      <table className="w-full table-fixed border-collapse text-[10px]">
        <colgroup>
          <col style={{ width: COL_MONTH }} />
          <col style={{ width: COL_SALES }} />
          <col style={{ width: COL_AVG }} />
          <col style={{ width: COL_DELTA }} />
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className={cn(TH_CELL, 'px-1.5 text-center')}>
              {t('dashboardYearlyDailyAvgMonthCol')}
            </th>
            <th scope="col" className={cn(TH_CELL, 'px-1 text-center')}>
              {t('dashboardYearlyDailyAvgSalesCol')}
            </th>
            <th scope="col" className={cn(TH_CELL, 'px-1 text-center')}>
              <AvgHeader t={t} />
            </th>
            <th scope="col" className={cn(TH_CELL, 'px-1 text-center')}>
              {t('dashboardWeeklySalesDelta')}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isSelected = selectedMonth != null && selectedMonth === row.month;
            return (
              <tr key={row.month} className={rowHighlightClass(row, isSelected)}>
                <td className={cn(TD_CELL, 'px-1.5 text-center')}>
                  <MonthCell row={row} t={t} />
                </td>
                <td className={cn(TD_CELL, 'px-1 text-center')}>
                  <MoneyValue value={row.totalSales} className="text-noorix-text" />
                </td>
                <td className={cn(TD_CELL, 'px-1 text-center')}>
                  <MoneyValue
                    value={row.avgDaily}
                    className={valueToneClass(row.tone, row.avgDaily != null)}
                  />
                </td>
                <td className={cn(TD_CELL, 'px-1 text-center')}>
                  <DeltaCell row={row} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function DashboardOverviewYearlyDailyAvgPanel({ year, rows, selectedMonth }: Props) {
  const { t } = useTranslation();

  if (rows.length === 0) return null;

  return (
    <section className="noorix-surface-card min-w-0 overflow-hidden p-0" aria-label={t('dashboardYearlyDailyAvgTitle')}>
      <div className="flex flex-wrap items-center gap-2 border-b border-noorix-border bg-noorix-bg-muted/40 px-2 py-2.5 sm:gap-3 sm:px-3 sm:py-3">
        <span className="h-7 w-1 shrink-0 rounded-full bg-noorix-blue sm:h-8" aria-hidden />
        <h2 className="m-0 min-w-0 flex-1 text-[12px] font-bold leading-snug text-noorix-text sm:text-[13px]">
          {t('dashboardYearlyDailyAvgTitle')} - {year}
        </h2>
      </div>

      <div className="p-3 sm:p-4">
        <YearlyDailyAvgTable rows={rows} selectedMonth={selectedMonth} t={t} />
      </div>
    </section>
  );
}
