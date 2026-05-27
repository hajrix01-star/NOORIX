/**
 * المعدل اليومي لكل شهر — كرت MetricCard؛ جدول بحدود وعناوين وأعمدة (شهر | معدل | تغيّر).
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

const TH_CELL =
  'border border-noorix-border bg-noorix-bg-muted px-2 py-1.5 text-[10px] font-bold text-noorix-text';
const TD_CELL = 'border border-noorix-border px-2 py-1.5 align-middle text-[11px]';

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
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <span className="font-semibold text-noorix-text">{row.monthLabel}</span>
      {row.isCurrentMonth ? (
        <span className="rounded-full bg-[color-mix(in_srgb,var(--color-nx-sales)_14%,transparent)] px-1.5 py-0.5 text-[9px] font-bold text-noorix-blue whitespace-nowrap">
          {t('dashboardYearlyDailyAvgCurrentBadge')}
        </span>
      ) : null}
    </div>
  );
}

function AvgCell({ row }: { row: YearMonthlyDailyAvgRow }) {
  if (row.avgDaily == null) {
    return <span className="font-semibold text-noorix-muted">—</span>;
  }
  return (
    <span dir="ltr" className="inline-flex items-baseline justify-end gap-0.5 whitespace-nowrap nx-font-numbers">
      <FmtNum
        n={row.avgDaily}
        className={cn('font-bold', valueToneClass(row.tone, true))}
      />
      <span className="nx-sar text-[9px] text-noorix-muted">SR</span>
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
      className={cn('font-bold whitespace-nowrap nx-font-numbers tabular-nums', deltaToneClass(row.deltaPctVsPrev))}
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
    <div className="overflow-x-auto rounded-lg border border-noorix-border bg-noorix-bg-muted/25">
      <table className="w-full min-w-[17rem] border-collapse text-[10px]">
        <thead>
          <tr>
            <th scope="col" className={cn(TH_CELL, 'text-start min-w-[5.5rem]')}>
              {t('dashboardYearlyDailyAvgMonthCol')}
            </th>
            <th scope="col" className={cn(TH_CELL, 'text-end whitespace-nowrap')}>
              {t('dashboardSalesDailyAvgActiveDays')}
            </th>
            <th scope="col" className={cn(TH_CELL, 'text-end w-[4.25rem] whitespace-nowrap')}>
              {t('dashboardWeeklySalesDelta')}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isSelected = selectedMonth != null && selectedMonth === row.month;
            return (
              <tr key={row.month} className={rowHighlightClass(row, isSelected)}>
                <td className={cn(TD_CELL, 'text-start')}>
                  <MonthCell row={row} t={t} />
                </td>
                <td className={cn(TD_CELL, 'text-end')}>
                  <AvgCell row={row} />
                </td>
                <td className={cn(TD_CELL, 'text-end')}>
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
    <div className="nx-kpi-container w-full" aria-label={t('dashboardYearlyDailyAvgTitle')}>
      <MetricCard color={accentColor} className="flex w-full flex-col">
        <MetricCard.Header
          label={`${t('dashboardYearlyDailyAvgTitle')} — ${year}`}
          subLabel={t('dashboardYearlyDailyAvgFormulaNote')}
        />

        <MetricCard.Section className="pb-3 pt-0">
          <YearlyDailyAvgTable rows={rows} selectedMonth={selectedMonth} t={t} />
        </MetricCard.Section>
      </MetricCard>
    </div>
  );
}
