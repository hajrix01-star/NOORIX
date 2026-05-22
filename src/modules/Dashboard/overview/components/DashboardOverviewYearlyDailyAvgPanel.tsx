/**
 * المعدل اليومي لكل شهر من يناير حتى الشهر الحالي (أو نهاية سنة سابقة).
 */
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

export function DashboardOverviewYearlyDailyAvgPanel({ year, rows, selectedMonth }: Props) {
  const { t } = useTranslation();

  if (rows.length === 0) return null;

  return (
    <section
      className="overflow-hidden rounded-xl border border-noorix-border bg-[var(--noorix-surface-1)] shadow-sm"
      aria-label={t('dashboardYearlyDailyAvgTitle')}
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-noorix-border bg-[var(--noorix-surface-2)] px-4 py-3">
        <span className="h-8 w-1 shrink-0 rounded-full bg-nx-sales" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="m-0 text-[13px] font-bold leading-snug text-noorix-text">
            {t('dashboardYearlyDailyAvgTitle')} — {year}
          </h2>
          <p className="m-0 mt-0.5 text-[10px] font-medium text-noorix-muted">
            {t('dashboardYearlyDailyAvgFormulaNote')}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto p-2 sm:p-4">
        <table className="w-full min-w-[320px] border-collapse border border-noorix-border text-sm">
          <thead>
            <tr className="bg-[var(--noorix-table-header-bg)]">
              <th className="border border-noorix-border px-2 py-2.5 text-start text-xs font-bold">
                {t('dashboardYearlyDailyAvgMonthCol')}
              </th>
              <th className="border border-noorix-border px-2 py-2.5 text-center text-xs font-bold">
                {t('dashboardSalesDailyAvgActiveDays')}
              </th>
              <th className="border border-noorix-border px-2 py-2.5 text-center text-xs font-bold">
                {t('dashboardWeeklySalesDelta')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isSelected = selectedMonth != null && selectedMonth === row.month;
              const hasValue = row.avgDaily != null;

              return (
                <tr
                  key={row.month}
                  className={cn(
                    'bg-[var(--noorix-surface-1)]',
                    row.isCurrentMonth && 'bg-[color-mix(in_srgb,var(--color-nx-sales)_6%,transparent)]',
                    isSelected && !row.isCurrentMonth && 'bg-noorix-bg-muted/50',
                  )}
                >
                  <td className="border border-noorix-border px-2 py-2 text-[13px] font-medium text-noorix-text">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span>{row.monthLabel}</span>
                      {row.isCurrentMonth ? (
                        <span className="rounded-full bg-[color-mix(in_srgb,var(--color-nx-sales)_14%,transparent)] px-1.5 py-0.5 text-[9px] font-bold text-noorix-blue">
                          {t('dashboardYearlyDailyAvgCurrentBadge')}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="border border-noorix-border px-2 py-2 text-center" dir="ltr">
                    {hasValue ? (
                      <FmtNum
                        n={row.avgDaily!}
                        className={cn(
                          'font-semibold tabular-nums nx-font-numbers',
                          valueToneClass(row.tone, true),
                        )}
                      />
                    ) : (
                      <span className="text-[13px] font-semibold text-noorix-muted">—</span>
                    )}{' '}
                    {hasValue ? (
                      <span className="nx-sar text-[11px] text-noorix-muted">SR</span>
                    ) : null}
                  </td>
                  <td className="border border-noorix-border px-2 py-2 text-center">
                    {row.deltaPctVsPrev != null ? (
                      <span
                        className={cn(
                          'text-[13px] font-bold tabular-nums nx-font-numbers',
                          row.deltaPctVsPrev > 0
                            ? 'text-noorix-blue'
                            : row.deltaPctVsPrev < 0
                              ? 'text-noorix-red'
                              : 'text-noorix-muted',
                        )}
                        dir="ltr"
                      >
                        {row.deltaPctVsPrev > 0 ? '+' : ''}
                        {formatDeltaPct(row.deltaPctVsPrev)}%
                      </span>
                    ) : (
                      <span className="text-[13px] font-semibold text-noorix-muted">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
