import React, { useState } from 'react';
import { FmtNum } from '../../../../ui';
import { cn } from '../../../../ui/cn';
import {
  compareRevenueDailyAvgTone,
  revenueDailyAvgDeltaPct,
} from '../utils/dashboardOverviewBuilders';
import { DashboardOverviewSalesShiftPanel } from './DashboardOverviewSalesShiftPanel';
import type { SalesShiftPeriodTotals } from '../utils/dashboardSalesShiftTotals';

type Props = {
  mtdEndDay: number;
  revenueDailyAvg: number | null;
  revenueDailyAvgPrev: number | null;
  customerDailyAvg: number | null;
  customerDailyAvgPrev: number | null;
  salesShiftPeriodTotals: SalesShiftPeriodTotals | null;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

function formatDeltaPct(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  if (Object.is(rounded, -0)) return '0';
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(1);
}

function DeltaBadge({
  current,
  prev,
}: {
  current: number | null;
  prev: number | null;
}) {
  const deltaPct =
    current != null && prev != null ? revenueDailyAvgDeltaPct(current, prev) : null;
  if (deltaPct == null) return null;
  const tone = compareRevenueDailyAvgTone(current, prev);
  const badgeClass =
    tone === 'up'
      ? 'bg-[color-mix(in_srgb,var(--color-nx-sales)_14%,transparent)] text-noorix-blue'
      : tone === 'down'
        ? 'bg-[color-mix(in_srgb,var(--color-nx-expenses)_14%,transparent)] text-noorix-red'
        : 'bg-noorix-bg-muted text-noorix-muted';
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold nx-font-numbers ltr',
        badgeClass,
      )}
    >
      {deltaPct > 0 ? '↑ ' : deltaPct < 0 ? '↓ ' : ''}
      {deltaPct > 0 ? '+' : ''}
      {formatDeltaPct(deltaPct)}%
    </span>
  );
}

export function DashboardOverviewRevenueMonthBody({
  mtdEndDay,
  revenueDailyAvg,
  revenueDailyAvgPrev,
  customerDailyAvg,
  customerDailyAvgPrev,
  salesShiftPeriodTotals,
  t,
}: Props) {
  const [shiftsOpen, setShiftsOpen] = useState(false);
  const hasRevenueAvg = revenueDailyAvg != null;
  const hasCustomerAvg = customerDailyAvg != null;

  if (!hasRevenueAvg && !hasCustomerAvg && !salesShiftPeriodTotals) return null;

  return (
    <div className="mx-4 mt-1 flex flex-col gap-1.5 pb-0.5">
      {(hasRevenueAvg || hasCustomerAvg) ? (
        <div className="grid grid-cols-2 gap-1.5">
          {hasRevenueAvg ? (
            <div className="min-w-0 rounded-lg border border-noorix-border bg-[color-mix(in_srgb,var(--color-nx-sales)_6%,transparent)] px-2.5 py-1.5">
              <div className="flex items-center justify-between gap-1">
                <span className="truncate text-[9px] font-semibold text-noorix-muted">
                  {t('dashboardSalesDailyAvgActiveDays')}
                  <span className="nx-font-numbers ltr font-normal"> · 1–{mtdEndDay}</span>
                </span>
                <DeltaBadge current={revenueDailyAvg} prev={revenueDailyAvgPrev} />
              </div>
              <div dir="ltr" className="mt-0.5 flex items-baseline gap-0.5 text-nx-sales nx-font-numbers">
                <span className="text-[16px] font-black leading-none">
                  <FmtNum n={revenueDailyAvg!} />
                </span>
                <span className="nx-sar text-[10px]">SR</span>
              </div>
              {revenueDailyAvgPrev != null ? (
                <div dir="ltr" className="mt-0.5 text-[9px] text-noorix-muted nx-font-numbers truncate">
                  <FmtNum n={revenueDailyAvgPrev} /> <span className="nx-sar">SR</span>
                </div>
              ) : null}
            </div>
          ) : (
            <div />
          )}

          {hasCustomerAvg ? (
            <div className="min-w-0 rounded-md border border-noorix-border/80 bg-noorix-bg-muted/30 px-2.5 py-1.5">
              <div className="truncate text-[9px] font-semibold text-noorix-muted">
                {t('dashboardSalesCustomerDailyAvg')}
              </div>
              <div dir="ltr" className="mt-0.5 flex items-baseline gap-0.5 nx-font-numbers">
                <span className="text-[16px] font-bold text-noorix-text">
                  <FmtNum n={customerDailyAvg!} />
                </span>
                <span className="text-[9px] text-noorix-muted">{t('dashboardSalesCustomerDailyAvgUnit')}</span>
              </div>
              {customerDailyAvgPrev != null ? (
                <div dir="ltr" className="mt-0.5 text-[9px] text-noorix-muted nx-font-numbers truncate">
                  <FmtNum n={customerDailyAvgPrev} />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="md:hidden">
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-lg border border-noorix-border bg-noorix-bg-muted/25 px-3 py-1.5 text-[10px] font-semibold text-noorix-muted"
          onClick={() => setShiftsOpen((o) => !o)}
          aria-expanded={shiftsOpen}
        >
          <span>{t('dashboardShiftDetailsToggle')}</span>
          <span className="ltr">{shiftsOpen ? '▲' : '▼'}</span>
        </button>
        {shiftsOpen ? (
          <div className="mt-1">
            <DashboardOverviewSalesShiftPanel totals={salesShiftPeriodTotals} t={t} compact />
          </div>
        ) : null}
      </div>

      <div className="hidden md:block">
        <DashboardOverviewSalesShiftPanel totals={salesShiftPeriodTotals} t={t} compact />
      </div>
    </div>
  );
}
