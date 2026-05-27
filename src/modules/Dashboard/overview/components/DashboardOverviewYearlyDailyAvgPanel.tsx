/**
 * المعدل اليومي لكل شهر — جدول بحدود يتسع داخل الكرت (نِسَب أعمدة ثابتة، بدون قصّ RTL).
 */
import React from 'react';
import { useTranslation } from '../../../../i18n/useTranslation';
import { FmtNum, MetricCard } from '../../../../ui';
import { cn } from '../../../../ui/cn';
import { KPI_CARD_SPARKLINE_COLORS } from '../../../../constants/kpiCardTheme';
import type { YearMonthlyDailyAvgRow } from '../utils/dashboardOverviewBuilders';

type Props = {
  year: number;
  rows: YearMonthlyDailyAvgRow[];
  selectedMonth: number | null;
};

/** شهر | مبيعات | معدل | تغيّر */
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
    <div className="flex min-w-0 items-center gap-1">
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

function SalesCell({ row }: { row: YearMonthlyDailyAvgRow }) {
  if (row.totalSales == null) {
    return <span className="font-semibold text-noorix-muted">—</span>;
  }
  return (
    <span dir="ltr" className="inline-flex max-w-full items-baseline justify-center gap-0.5 whitespace-nowrap nx-font-numbers">
      <FmtNum n={row.totalSales} className="font-bold text-noorix-text" />
      <span className="nx-sar text-[8px] text-noorix-muted">SR</span>
    </span>
  );
}

function AvgCell({ row }: { row: YearMonthlyDailyAvgRow }) {
  if (row.avgDaily == null) {
    return <span className="font-semibold text-noorix-muted">—</span>;
  }
  return (
    <span dir="ltr" className="inline-flex max-w-full items-baseline justify-center gap-0.5 whitespace-nowrap nx-font-numbers">
      <FmtNum n={row.avgDaily} className={cn('font-bold', valueToneClass(row.tone, true))} />
      <span className="nx-sar text-[8px] text-noorix-muted">SR</span>
    </span>
  );
}

function DeltaCell({ row }: { row: YearMonthlyDailyAvgRow }) {
  if (row.deltaPctVsPrev == null) {
    return <span className="font-semibold text-noorix-muted nx-font-numbers">—</span>;
  }
  return (
    <span
      dir="ltr"
      className={cn(
        'font-bold whitespace-nowrap nx-font-numbers tabular-nums',
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
    <div className="w-full min-w-0 rounded-lg border border-noorix-border bg-noorix-bg-muted/25">
      <table className="w-full table-fixed border-collapse text-[10px]">
        <colgroup>
          <col style={{ width: COL_MONTH }} />
          <col style={{ width: COL_SALES }} />
          <col style={{ width: COL_AVG }} />
          <col style={{ width: COL_DELTA }} />
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className={cn(TH_CELL, 'px-1.5 text-start')}>
              {t('dashboardYearlyDailyAvgMonthCol')}
            </th>
            <th scope="col" className={cn(TH_CELL, 'px-1 text-end')}>
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
                  <SalesCell row={row} />
                </td>
                <td className={cn(TD_CELL, 'px-1 text-center')}>
                  <AvgCell row={row} />
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

  const accentColor = KPI_CARD_SPARKLINE_COLORS.sales;

  return (
    <div className="nx-kpi-container w-full min-w-0" aria-label={t('dashboardYearlyDailyAvgTitle')}>
      <MetricCard color={accentColor} className="flex w-full min-w-0 flex-col overflow-hidden">
        <MetricCard.Header
          label={`${t('dashboardYearlyDailyAvgTitle')} — ${year}`}
          subLabel={t('dashboardYearlyDailyAvgFormulaNote')}
        />

        <MetricCard.Section className="min-w-0 px-2 pb-3 pt-0 sm:px-4">
          <YearlyDailyAvgTable rows={rows} selectedMonth={selectedMonth} t={t} />
        </MetricCard.Section>
      </MetricCard>
    </div>
  );
}
