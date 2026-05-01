/**
 * متوسط يومي المبيعات لكل جزء أسبوعي داخل الشهر (1–7، 8–14، …) مقارنة بمرجع.
 */
import React from 'react';
import { useTranslation } from '../../../../i18n/useTranslation';
import { FmtNum } from '../../../../ui';
import { cn } from '../../../../ui/cn';

export type WeeklySalesWeekRow = {
  weekIndex: number;
  dayStart: number;
  dayEnd: number;
  avgDailyCurrent: number;
  avgDailyBaseline: number;
  deltaPct: number | null;
};

export type WeeklySalesWeekData = {
  rows: WeeklySalesWeekRow[];
  baselineLabel: string;
};

type Props = {
  selectedMonth: number | null;
  compareMode: 'mom' | 'yoy';
  onCompareModeChange: (mode: 'mom' | 'yoy') => void;
  data: WeeklySalesWeekData | null;
  isLoading: boolean;
};

export function DashboardOverviewWeeklySalesPanel({
  selectedMonth,
  compareMode,
  onCompareModeChange,
  data,
  isLoading,
}: Props) {
  const { t } = useTranslation();

  if (selectedMonth == null) return null;

  const pill = (active: boolean) =>
    cn(
      'rounded-md px-3 py-1.5 text-[12px] font-semibold transition-colors',
      active
        ? 'bg-noorix-blue text-white shadow-sm'
        : 'text-noorix-muted hover:bg-[var(--noorix-surface-2)]',
    );

  return (
    <section
      className="overflow-hidden rounded-xl border border-noorix-border bg-[var(--noorix-surface-1)] shadow-sm"
      aria-label={t('dashboardWeeklySalesTitle')}
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-noorix-border bg-[var(--noorix-surface-2)] px-4 py-3">
        <span className="h-8 w-1 shrink-0 rounded-full bg-noorix-blue" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="m-0 text-[13px] font-bold leading-snug text-noorix-text">{t('dashboardWeeklySalesTitle')}</h2>
          <p className="m-0 mt-0.5 text-[10px] font-medium text-noorix-muted">{t('dashboardWeeklySalesFormulaNote')}</p>
          {data?.baselineLabel ? (
            <p className="m-0 mt-1 text-[11px] font-semibold text-noorix-text/90">
              {t('dashboardWeeklySalesCompareRef')}
              {': '}
              <span className="text-noorix-muted">{data.baselineLabel}</span>
            </p>
          ) : null}
        </div>
        <div
          className="flex shrink-0 rounded-lg border border-noorix-border bg-[var(--noorix-surface-1)] p-0.5"
          role="group"
          aria-label={t('dashboardWeeklySalesCompareLabel')}
        >
          <button type="button" className={pill(compareMode === 'mom')} onClick={() => onCompareModeChange('mom')}>
            {t('dashboardWeeklySalesCompareMom')}
          </button>
          <button type="button" className={pill(compareMode === 'yoy')} onClick={() => onCompareModeChange('yoy')}>
            {t('dashboardWeeklySalesCompareYoy')}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto p-2 sm:p-4">
        {isLoading || !data ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-[var(--noorix-surface-2)]" />
            ))}
          </div>
        ) : (
          <table className="w-full min-w-[520px] border-collapse border border-noorix-border text-sm">
            <thead>
              <tr className="bg-[var(--noorix-table-header-bg)]">
                <th className="border border-noorix-border px-2 py-2.5 text-center text-xs font-bold">
                  {t('dashboardWeeklySalesWeekCol')}
                </th>
                <th className="border border-noorix-border px-2 py-2.5 text-center text-xs font-bold">
                  {t('dashboardWeeklySalesAvgDailyCurrent')}
                </th>
                <th className="border border-noorix-border px-2 py-2.5 text-center text-xs font-bold">
                  {t('dashboardWeeklySalesAvgDailyBaseline')}
                </th>
                <th className="border border-noorix-border px-2 py-2.5 text-center text-xs font-bold">
                  {t('dashboardWeeklySalesDelta')}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.weekIndex} className="bg-[var(--noorix-surface-1)]">
                  <td className="border border-noorix-border px-2 py-2 text-center text-[13px] font-medium text-noorix-text">
                    {t('dashboardWeeklySalesWeekRange', {
                      n: row.weekIndex,
                      from: row.dayStart,
                      to: row.dayEnd,
                    })}
                  </td>
                  <td className="border border-noorix-border px-2 py-2 text-center" dir="ltr">
                    <FmtNum
                      n={row.avgDailyCurrent}
                      maxDecimals={2}
                      className="font-semibold tabular-nums nx-font-numbers text-noorix-text"
                    />{' '}
                    <span className="nx-sar text-[11px] text-noorix-muted">SR</span>
                  </td>
                  <td className="border border-noorix-border px-2 py-2 text-center" dir="ltr">
                    <FmtNum
                      n={row.avgDailyBaseline}
                      maxDecimals={2}
                      className="font-semibold tabular-nums nx-font-numbers text-noorix-text"
                    />{' '}
                    <span className="nx-sar text-[11px] text-noorix-muted">SR</span>
                  </td>
                  <td className="border border-noorix-border px-2 py-2 text-center">
                    {row.deltaPct != null ? (
                      <span
                        className={cn(
                          'text-[13px] font-bold tabular-nums nx-font-numbers',
                          row.deltaPct > 0 ? 'text-[#3B6D11]' : row.deltaPct < 0 ? 'text-[#A32D2D]' : 'text-noorix-muted',
                        )}
                        dir="ltr"
                      >
                        {row.deltaPct > 0 ? '+' : ''}
                        {Math.round(row.deltaPct * 10) / 10}%
                      </span>
                    ) : (
                      <span className="text-[13px] font-semibold text-noorix-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
