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
  monthLabel: string;
  revenueMtd: number | null;
  revenueMtdPrev: number | null;
  revenueActiveDays: number | null;
  customerMtd: number | null;
  customerActiveDays: number | null;
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
  t,
}: {
  current: number | null;
  prev: number | null;
  t: Props['t'];
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
      title={t('dashboardSalesDailyAvgCompareHint')}
    >
      {deltaPct > 0 ? '↑ ' : deltaPct < 0 ? '↓ ' : ''}
      {deltaPct > 0 ? '+' : ''}
      {formatDeltaPct(deltaPct)}%
    </span>
  );
}

function MiniStat({
  label,
  value,
  unit,
  suffix,
}: {
  label: string;
  value: number | null;
  unit: 'currency' | 'count';
  suffix?: string;
}) {
  if (value == null) return null;
  return (
    <div className="min-w-0 rounded-md border border-noorix-border/80 bg-noorix-bg-muted/30 px-2 py-1.5">
      <div className="truncate text-[9px] font-semibold text-noorix-muted leading-tight">{label}</div>
      <div dir="ltr" className="mt-0.5 flex items-baseline gap-0.5 text-start nx-font-numbers">
        <span className="truncate text-[12px] font-bold text-noorix-text">
          <FmtNum n={value} />
        </span>
        {unit === 'currency' ? (
          <span className="nx-sar shrink-0 text-[9px]">SR</span>
        ) : (
          <span className="shrink-0 text-[9px] text-noorix-muted">{suffix}</span>
        )}
      </div>
    </div>
  );
}

export function DashboardOverviewRevenueMonthBody({
  mtdEndDay,
  monthLabel,
  revenueMtd,
  revenueMtdPrev,
  revenueActiveDays,
  customerMtd,
  customerActiveDays,
  salesShiftPeriodTotals,
  t,
}: Props) {
  const [shiftsOpen, setShiftsOpen] = useState(false);
  const hasMtd = revenueMtd != null;
  const hasSecondary =
    revenueActiveDays != null || customerMtd != null || customerActiveDays != null;

  if (!hasMtd && !hasSecondary && !salesShiftPeriodTotals) return null;

  return (
    <div className="mx-4 mt-2 flex flex-col gap-2">
      {hasMtd ? (
        <div className="rounded-lg border border-noorix-border bg-[color-mix(in_srgb,var(--color-nx-sales)_6%,transparent)] px-3 py-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] font-semibold text-noorix-muted leading-snug">
                {t('dashboardRevenueMtdLabel', { from: 1, to: mtdEndDay, month: monthLabel })}
              </div>
              <div className="text-[9px] text-noorix-muted mt-0.5">{t('dashboardRevenueMtdHint')}</div>
            </div>
            <DeltaBadge current={revenueMtd} prev={revenueMtdPrev} t={t} />
          </div>
          <div dir="ltr" className="mt-1 flex items-baseline gap-1 text-nx-sales nx-font-numbers">
            <span className="text-[18px] font-black leading-none">
              <FmtNum n={revenueMtd!} />
            </span>
            <span className="nx-sar text-[11px]">SR</span>
          </div>
          {revenueMtdPrev != null ? (
            <div className="mt-1 flex items-center justify-between gap-2 text-[9px] text-noorix-muted">
              <span>{t('dashboardKpiFooterTrailingAvg')}</span>
              <span dir="ltr" className="font-medium nx-font-numbers">
                <FmtNum n={revenueMtdPrev} /> <span className="nx-sar">SR</span>
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      {hasSecondary ? (
        <div className="grid grid-cols-2 gap-1.5">
          <MiniStat
            label={t('dashboardRevenueActiveDaysAvg')}
            value={revenueActiveDays}
            unit="currency"
          />
          <MiniStat
            label={t('dashboardSalesCustomerDailyAvg')}
            value={customerMtd ?? customerActiveDays}
            unit="count"
            suffix={t('dashboardSalesCustomerDailyAvgUnit')}
          />
        </div>
      ) : null}

      <div className="md:hidden">
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-lg border border-noorix-border bg-noorix-bg-muted/25 px-3 py-2 text-[10px] font-semibold text-noorix-muted"
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
