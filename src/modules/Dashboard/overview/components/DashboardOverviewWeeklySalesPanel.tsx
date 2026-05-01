/**
 * لوحة متوسط المبيعات الأسبوعية + مقارنة (شهر سابق / سنة على سنة).
 */
import React from 'react';
import { useTranslation } from '../../../../i18n/useTranslation';
import { FmtNum } from '../../../../ui';
import { cn } from '../../../../ui/cn';

export type WeeklySalesComparison = {
  currentWeekly: number;
  baselineWeekly: number;
  deltaPct: number | null;
  baselineLabel: string;
};

type Props = {
  selectedMonth: number | null;
  compareMode: 'mom' | 'yoy';
  onCompareModeChange: (mode: 'mom' | 'yoy') => void;
  data: WeeklySalesComparison | null;
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

      <div className="p-4">
        {isLoading || !data ? (
          <div className="grid gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[72px] animate-pulse rounded-lg bg-[var(--noorix-surface-2)]" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3 sm:gap-6">
            <div className="flex flex-col gap-1 rounded-lg border border-noorix-border/90 bg-gradient-to-br from-noorix-blue/[0.08] to-transparent px-4 py-3">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-noorix-muted">
                {t('dashboardWeeklySalesCurrent')}
              </span>
              <div dir="ltr" className="flex flex-wrap items-baseline gap-x-1">
                <FmtNum n={data.currentWeekly} maxDecimals={2} className="text-[22px] font-bold tabular-nums text-noorix-text nx-font-numbers" />
                <span className="nx-sar text-[12px] font-semibold text-noorix-muted">SR</span>
              </div>
            </div>

            <div className="flex flex-col gap-1 rounded-lg border border-noorix-border px-4 py-3">
              <span className="text-[11px] font-semibold text-noorix-muted">{t('dashboardWeeklySalesBaseline')}</span>
              <span className="truncate text-[11px] text-noorix-text/90" title={data.baselineLabel}>
                {data.baselineLabel}
              </span>
              <div dir="ltr" className="flex flex-wrap items-baseline gap-x-1">
                <FmtNum n={data.baselineWeekly} maxDecimals={2} className="text-[18px] font-bold tabular-nums text-noorix-text nx-font-numbers" />
                <span className="nx-sar text-[12px] font-semibold text-noorix-muted">SR</span>
              </div>
            </div>

            <div className="flex flex-col justify-center gap-1 rounded-lg border border-noorix-border px-4 py-3">
              <span className="text-[11px] font-semibold text-noorix-muted">{t('dashboardWeeklySalesDelta')}</span>
              {data.deltaPct != null ? (
                <span
                  className={cn(
                    'text-[20px] font-bold tabular-nums nx-font-numbers',
                    data.deltaPct > 0 ? 'text-[#3B6D11]' : data.deltaPct < 0 ? 'text-[#A32D2D]' : 'text-noorix-muted',
                  )}
                  dir="ltr"
                >
                  {data.deltaPct > 0 ? '+' : ''}
                  {Math.round(data.deltaPct * 10) / 10}%
                </span>
              ) : (
                <span className="text-[18px] font-semibold text-noorix-muted">—</span>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
