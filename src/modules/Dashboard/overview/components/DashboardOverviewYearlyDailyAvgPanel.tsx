/**
 * المعدل اليومي لكل شهر — كرت MetricCard موحّد مع جدول (سطح المكتب) وبطاقات (جوال).
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

type RowProps = {
  row: YearMonthlyDailyAvgRow;
  isSelected: boolean;
  t: (key: string) => string;
};

function MonthBadge({ row, t }: { row: YearMonthlyDailyAvgRow; t: (key: string) => string }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <span className="text-[12px] font-semibold text-noorix-text">{row.monthLabel}</span>
      {row.isCurrentMonth ? (
        <span className="rounded-full bg-[color-mix(in_srgb,var(--color-nx-sales)_14%,transparent)] px-1.5 py-0.5 text-[9px] font-bold text-noorix-blue">
          {t('dashboardYearlyDailyAvgCurrentBadge')}
        </span>
      ) : null}
    </div>
  );
}

function AvgCell({ row }: { row: YearMonthlyDailyAvgRow }) {
  const hasValue = row.avgDaily != null;
  if (!hasValue) {
    return <span className="text-[12px] font-semibold text-noorix-muted">—</span>;
  }
  return (
    <span dir="ltr" className="inline-flex items-baseline gap-0.5 whitespace-nowrap">
      <FmtNum
        n={row.avgDaily!}
        className={cn('text-[12px] font-bold nx-font-numbers', valueToneClass(row.tone, true))}
      />
      <span className="nx-sar text-[10px] text-noorix-muted">SR</span>
    </span>
  );
}

function DeltaCell({ row }: { row: YearMonthlyDailyAvgRow }) {
  if (row.deltaPctVsPrev == null) {
    return <span className="text-[12px] font-semibold text-noorix-muted">—</span>;
  }
  return (
    <span
      dir="ltr"
      className={cn(
        'text-[12px] font-bold nx-font-numbers',
        deltaToneClass(row.deltaPctVsPrev),
      )}
    >
      {row.deltaPctVsPrev > 0 ? '+' : ''}
      {formatDeltaPct(row.deltaPctVsPrev)}%
    </span>
  );
}

function rowHighlightClass(row: YearMonthlyDailyAvgRow, isSelected: boolean): string {
  return cn(
    row.isCurrentMonth && 'bg-[color-mix(in_srgb,var(--color-nx-sales)_6%,transparent)]',
    isSelected && !row.isCurrentMonth && 'bg-noorix-bg-muted/40',
  );
}

function YearlyDailyAvgMobileRow({ row, isSelected, t }: RowProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 border-b border-noorix-border px-3 py-2.5 last:border-b-0',
        rowHighlightClass(row, isSelected),
      )}
    >
      <MonthBadge row={row} t={t} />
      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <div className="text-[9px] font-semibold text-noorix-muted leading-snug">
            {t('dashboardSalesDailyAvgActiveDays')}
          </div>
          <div className="mt-0.5 text-start">
            <AvgCell row={row} />
          </div>
        </div>
        <div className="min-w-0 text-end">
          <div className="text-[9px] font-semibold text-noorix-muted leading-snug">
            {t('dashboardWeeklySalesDelta')}
          </div>
          <div className="mt-0.5 flex justify-end">
            <DeltaCell row={row} />
          </div>
        </div>
      </div>
    </div>
  );
}

function YearlyDailyAvgDesktopTable({
  rows,
  selectedMonth,
  t,
}: {
  rows: YearMonthlyDailyAvgRow[];
  selectedMonth: number | null;
  t: (key: string) => string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-noorix-border bg-noorix-bg-muted/25">
      <table className="w-full text-[10px]">
        <thead>
          <tr className="text-noorix-muted border-b border-noorix-border">
            <th className="px-2.5 py-2 text-start font-semibold">{t('dashboardYearlyDailyAvgMonthCol')}</th>
            <th className="px-2.5 py-2 text-end font-semibold">{t('dashboardSalesDailyAvgActiveDays')}</th>
            <th className="px-2.5 py-2 text-end font-semibold w-[4.5rem]">
              {t('dashboardWeeklySalesDelta')}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isSelected = selectedMonth != null && selectedMonth === row.month;
            return (
              <tr
                key={row.month}
                className={cn('border-t border-noorix-border/80', rowHighlightClass(row, isSelected))}
              >
                <td className="px-2.5 py-2 align-middle">
                  <MonthBadge row={row} t={t} />
                </td>
                <td className="px-2.5 py-2 text-end align-middle">
                  <AvgCell row={row} />
                </td>
                <td className="px-2.5 py-2 text-end align-middle">
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
          {/* جوال — بطاقة لكل شهر */}
          <div className="md:hidden overflow-hidden rounded-lg border border-noorix-border bg-noorix-bg-muted/25">
            {rows.map((row) => (
              <YearlyDailyAvgMobileRow
                key={row.month}
                row={row}
                isSelected={selectedMonth != null && selectedMonth === row.month}
                t={t}
              />
            ))}
          </div>

          {/* سطح المكتب — جدول مضغوط */}
          <div className="hidden md:block">
            <YearlyDailyAvgDesktopTable rows={rows} selectedMonth={selectedMonth} t={t} />
          </div>
        </MetricCard.Section>
      </MetricCard>
    </div>
  );
}
