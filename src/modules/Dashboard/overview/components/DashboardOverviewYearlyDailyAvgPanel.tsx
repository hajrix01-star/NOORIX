/**
 * المعدل اليومي لكل شهر — كرت MetricCard؛ جدول عمودين (شهر | معدل+تغيّر) لارتفاع أقل.
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

const MONTH_SHORT_AR = [
  'ينا', 'فبر', 'مار', 'أبر', 'ماي', 'يون',
  'يول', 'أغس', 'سبت', 'أكت', 'نوف', 'ديس',
] as const;

const MONTH_SHORT_EN = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

function formatDeltaPct(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  if (Object.is(rounded, -0)) return '0';
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(1);
}

function monthShortLabel(row: YearMonthlyDailyAvgRow, lang: 'ar' | 'en'): string {
  const shorts = lang === 'ar' ? MONTH_SHORT_AR : MONTH_SHORT_EN;
  return shorts[row.month - 1] ?? row.monthLabel;
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

function MonthCell({
  row,
  lang,
  t,
}: {
  row: YearMonthlyDailyAvgRow;
  lang: 'ar' | 'en';
  t: (key: string) => string;
}) {
  const short = monthShortLabel(row, lang);
  return (
    <div className="flex min-w-0 items-center gap-1">
      <span
        className="truncate text-[11px] font-semibold text-noorix-text"
        title={row.monthLabel}
      >
        {short}
      </span>
      {row.isCurrentMonth ? (
        <span
          className="shrink-0 size-1.5 rounded-full bg-noorix-blue"
          title={t('dashboardYearlyDailyAvgCurrentBadge')}
          aria-label={t('dashboardYearlyDailyAvgCurrentBadge')}
        />
      ) : null}
    </div>
  );
}

function ValuesCell({ row }: { row: YearMonthlyDailyAvgRow }) {
  const hasAvg = row.avgDaily != null;

  if (!hasAvg) {
    return <span className="text-[11px] font-semibold text-noorix-muted">—</span>;
  }

  return (
    <div
      dir="ltr"
      className="flex min-w-0 flex-wrap items-baseline justify-end gap-x-2 gap-y-0.5"
    >
      <span className="inline-flex items-baseline gap-0.5 whitespace-nowrap">
        <FmtNum
          n={row.avgDaily!}
          className={cn('text-[11px] font-bold nx-font-numbers', valueToneClass(row.tone, true))}
        />
        <span className="nx-sar text-[9px] text-noorix-muted">SR</span>
      </span>
      {row.deltaPctVsPrev != null ? (
        <span
          className={cn(
            'text-[10px] font-bold nx-font-numbers whitespace-nowrap',
            deltaToneClass(row.deltaPctVsPrev),
          )}
        >
          {row.deltaPctVsPrev > 0 ? '+' : ''}
          {formatDeltaPct(row.deltaPctVsPrev)}%
        </span>
      ) : (
        <span className="text-[10px] font-semibold text-noorix-muted">—</span>
      )}
    </div>
  );
}

function YearlyDailyAvgTable({
  rows,
  selectedMonth,
  lang,
  t,
}: {
  rows: YearMonthlyDailyAvgRow[];
  selectedMonth: number | null;
  lang: 'ar' | 'en';
  t: (key: string) => string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-noorix-border bg-noorix-bg-muted/25">
      <table className="w-full table-fixed text-[10px]">
        <colgroup>
          <col className="w-[4.25rem] sm:w-[4.75rem]" />
          <col />
        </colgroup>
        <thead>
          <tr className="border-b border-noorix-border text-noorix-muted">
            <th className="px-2 py-1.5 text-start font-semibold">{t('dashboardYearlyDailyAvgMonthCol')}</th>
            <th className="px-2 py-1.5 text-end font-semibold">{t('dashboardYearlyDailyAvgValuesCol')}</th>
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
                <td className="px-2 py-1 align-middle">
                  <MonthCell row={row} lang={lang} t={t} />
                </td>
                <td className="px-2 py-1 align-middle">
                  <ValuesCell row={row} />
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
  const { t, lang } = useTranslation();

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
          <YearlyDailyAvgTable rows={rows} selectedMonth={selectedMonth} lang={lang} t={t} />
        </MetricCard.Section>
      </MetricCard>
    </div>
  );
}
