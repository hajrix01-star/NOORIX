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
  currentMonthLabel: string;
  prevMonthLabel: string;
  currentMonthSalesTotal: number;
  prevMonthSalesTotal: number;
  revenueDailyAvg: number | null;
  revenueDailyAvgPrev: number | null;
  customerDailyAvg: number | null;
  customerDailyAvgPrev: number | null;
  salesShiftPeriodTotals: SalesShiftPeriodTotals | null;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

type CompareRow = {
  key: string;
  label: string;
  current: number | null;
  prev: number | null;
  unit: 'currency' | 'count';
};

function formatDeltaPct(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  if (Object.is(rounded, -0)) return '0';
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(1);
}

function DeltaCell({ current, prev }: { current: number | null; prev: number | null }) {
  const deltaPct =
    current != null && prev != null ? revenueDailyAvgDeltaPct(current, prev) : null;
  if (deltaPct == null) {
    return <span className="text-noorix-muted">—</span>;
  }
  const tone = compareRevenueDailyAvgTone(current, prev);
  const toneClass =
    tone === 'up'
      ? 'text-noorix-blue'
      : tone === 'down'
        ? 'text-noorix-red'
        : 'text-noorix-muted';
  return (
    <span className={cn('font-bold nx-font-numbers ltr', toneClass)}>
      {deltaPct > 0 ? '↑ ' : deltaPct < 0 ? '↓ ' : ''}
      {deltaPct > 0 ? '+' : ''}
      {formatDeltaPct(deltaPct)}%
    </span>
  );
}

function ValueCell({
  value,
  unit,
  t,
}: {
  value: number | null;
  unit: CompareRow['unit'];
  t: Props['t'];
}) {
  if (value == null) {
    return <span className="text-noorix-muted">—</span>;
  }
  if (unit === 'currency') {
    return (
      <span className="font-bold text-nx-sales nx-font-numbers">
        <FmtNum n={value} /> <span className="nx-sar text-[8px]">SR</span>
      </span>
    );
  }
  return (
    <span className="font-bold text-noorix-text nx-font-numbers">
      <FmtNum n={value} />
      <span className="text-[8px] font-normal text-noorix-muted ms-0.5">
        {t('dashboardSalesCustomerDailyAvgUnit')}
      </span>
    </span>
  );
}

function CompareTable({
  mtdEndDay,
  currentMonthLabel,
  prevMonthLabel,
  rows,
  t,
}: {
  mtdEndDay: number;
  currentMonthLabel: string;
  prevMonthLabel: string;
  rows: CompareRow[];
  t: Props['t'];
}) {
  const visible = rows.filter((r) => r.current != null || r.prev != null);
  if (visible.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-noorix-border bg-[color-mix(in_srgb,var(--color-nx-sales)_4%,transparent)]">
      <table className="w-full text-[10px] border-collapse">
        <thead>
          <tr className="border-b border-noorix-border bg-noorix-bg-muted/35">
            <th className="w-[28%] px-2 py-1.5 text-center font-semibold text-noorix-muted" />
            <th className="px-2 py-1.5 text-center font-semibold text-noorix-text">
              <span className="block truncate">{currentMonthLabel}</span>
              <span className="nx-font-numbers block text-[8px] font-normal text-noorix-muted ltr">
                1–{mtdEndDay}
              </span>
            </th>
            <th className="px-2 py-1.5 text-center font-semibold text-noorix-text">
              <span className="block truncate">{prevMonthLabel}</span>
              <span className="nx-font-numbers block text-[8px] font-normal text-noorix-muted ltr">
                1–{mtdEndDay}
              </span>
            </th>
            <th className="w-[3.25rem] px-2 py-1.5 text-center font-semibold text-noorix-muted">
              {t('dashboardWeeklySalesDelta')}
            </th>
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => (
            <tr key={row.key} className="border-t border-noorix-border/80">
              <td className="truncate px-2 py-1.5 text-center font-medium text-noorix-muted">
                {row.label}
              </td>
              <td dir="ltr" className="whitespace-nowrap px-2 py-1.5 text-center">
                <ValueCell value={row.current} unit={row.unit} t={t} />
              </td>
              <td dir="ltr" className="whitespace-nowrap px-2 py-1.5 text-center text-noorix-muted">
                <ValueCell value={row.prev} unit={row.unit} t={t} />
              </td>
              <td dir="ltr" className="whitespace-nowrap px-2 py-1.5 text-center">
                <DeltaCell current={row.current} prev={row.prev} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DashboardOverviewRevenueMonthBody({
  mtdEndDay,
  currentMonthLabel,
  prevMonthLabel,
  currentMonthSalesTotal,
  prevMonthSalesTotal,
  revenueDailyAvg,
  revenueDailyAvgPrev,
  customerDailyAvg,
  customerDailyAvgPrev,
  salesShiftPeriodTotals,
  t,
}: Props) {
  const [shiftsOpen, setShiftsOpen] = useState(false);

  const compareRows: CompareRow[] = [
    {
      key: 'sales',
      label: t('dashboardRevenueCompareSales'),
      current: currentMonthSalesTotal > 0 ? currentMonthSalesTotal : null,
      prev: prevMonthSalesTotal > 0 ? prevMonthSalesTotal : null,
      unit: 'currency',
    },
    {
      key: 'dailyAvg',
      label: t('dashboardSalesDailyAvgActiveDays'),
      current: revenueDailyAvg,
      prev: revenueDailyAvgPrev,
      unit: 'currency',
    },
    {
      key: 'customers',
      label: t('dashboardSalesCustomerDailyAvg'),
      current: customerDailyAvg,
      prev: customerDailyAvgPrev,
      unit: 'count',
    },
  ];

  const hasCompare = compareRows.some((r) => r.current != null || r.prev != null);
  if (!hasCompare && !salesShiftPeriodTotals) return null;

  return (
    <div className="mx-4 mt-1 flex flex-col gap-1.5 pb-0.5">
      {hasCompare ? (
        <CompareTable
          mtdEndDay={mtdEndDay}
          currentMonthLabel={currentMonthLabel}
          prevMonthLabel={prevMonthLabel}
          rows={compareRows}
          t={t}
        />
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
