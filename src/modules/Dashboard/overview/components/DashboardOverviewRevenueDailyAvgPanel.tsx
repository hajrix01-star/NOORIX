import React from 'react';
import { FmtNum } from '../../../../ui';
import { cn } from '../../../../ui/cn';
import {
  compareRevenueDailyAvgTone,
  revenueDailyAvgDeltaPct,
} from '../utils/dashboardOverviewBuilders';

type Props = {
  revenueCurrent: number | null;
  revenuePrev: number | null;
  customerCurrent: number | null;
  customerPrev: number | null;
  basketCurrent: number | null;
  basketPrev: number | null;
  basketDeltaPct: number | null;
  t: (key: string) => string;
};

type MetricCell = {
  key: string;
  labelKey: string;
  current: number | null;
  prev: number | null;
  variant: 'currency' | 'count';
  deltaPct: number | null;
};

function formatDeltaPct(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  if (Object.is(rounded, -0)) return '0';
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(1);
}

function resolveDeltaPct(current: number | null, prev: number | null, override?: number | null): number | null {
  if (override !== undefined) return override;
  return current != null && prev != null ? revenueDailyAvgDeltaPct(current, prev) : null;
}

function resolveTone(current: number | null, prev: number | null, deltaPct: number | null) {
  if (deltaPct != null) {
    if (deltaPct > 0) return 'up';
    if (deltaPct < 0) return 'down';
  }
  return compareRevenueDailyAvgTone(current, prev);
}

function metricValueText(value: number | null, variant: 'currency' | 'count', t: (key: string) => string) {
  if (value == null) return <span className="text-noorix-muted">-</span>;
  return (
    <span dir="ltr" className="inline-flex items-baseline justify-center gap-1 nx-font-numbers">
      <span className="font-bold">
        <FmtNum n={value} />
      </span>
      {variant === 'currency' ? (
        <span className="nx-sar text-[9px]">SR</span>
      ) : (
        <span className="text-[9px] font-medium text-noorix-muted">
          {t('dashboardSalesCustomerDailyAvgUnit')}
        </span>
      )}
    </span>
  );
}

function deltaValueText(deltaPct: number | null) {
  if (deltaPct == null) return <span className="text-noorix-muted">-</span>;
  return (
    <span dir="ltr" className="nx-font-numbers font-bold">
      {deltaPct > 0 ? '+' : ''}
      {formatDeltaPct(deltaPct)}%
    </span>
  );
}

export function DashboardOverviewRevenueDailyAvgPanel({
  revenueCurrent,
  revenuePrev,
  customerCurrent,
  customerPrev,
  basketCurrent,
  basketPrev,
  basketDeltaPct,
  t,
}: Props) {
  const allMetrics: MetricCell[] = [
    {
      key: 'revenue',
      labelKey: 'dashboardSalesDailyAvgActiveDays',
      current: revenueCurrent,
      prev: revenuePrev,
      variant: 'currency',
      deltaPct: resolveDeltaPct(revenueCurrent, revenuePrev),
    },
    {
      key: 'customers',
      labelKey: 'dashboardSalesCustomerDailyAvg',
      current: customerCurrent,
      prev: customerPrev,
      variant: 'count',
      deltaPct: resolveDeltaPct(customerCurrent, customerPrev),
    },
    {
      key: 'basket',
      labelKey: 'dashboardSalesBasketAvg',
      current: basketCurrent,
      prev: basketPrev,
      variant: 'currency',
      deltaPct: resolveDeltaPct(basketCurrent, basketPrev, basketDeltaPct),
    },
  ];
  const metrics = allMetrics.filter((metric) => metric.current != null || metric.prev != null);
  if (metrics.length === 0) return null;

  return (
    <div className="mx-4 mt-2 overflow-hidden rounded-lg border border-noorix-border bg-noorix-bg-muted/25">
      <table className="w-full table-fixed border-collapse text-center text-[10px]">
        <thead>
          <tr className="border-b border-noorix-border text-noorix-muted">
            <th className="w-[23%] px-2 py-2 font-semibold">{t('dashboardMetricPeriod')}</th>
            {metrics.map((metric) => (
              <th key={metric.key} className="px-1.5 py-2 font-semibold">
                {t(metric.labelKey)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-noorix-border/80">
          <tr>
            <td className="px-2 py-2 text-noorix-muted">{t('dashboardCurrentMonth')}</td>
            {metrics.map((metric) => (
              <td key={metric.key} className="px-1.5 py-2 text-noorix-text">
                {metricValueText(metric.current, metric.variant, t)}
              </td>
            ))}
          </tr>
          <tr>
            <td className="px-2 py-2 text-noorix-muted">{t('dashboardKpiFooterTrailingAvg')}</td>
            {metrics.map((metric) => (
              <td key={metric.key} className="px-1.5 py-2 text-noorix-muted">
                {metricValueText(metric.prev, metric.variant, t)}
              </td>
            ))}
          </tr>
          <tr>
            <td className="px-2 py-2 text-noorix-muted">{t('dashboardMetricChange')}</td>
            {metrics.map((metric) => {
              const tone = resolveTone(metric.current, metric.prev, metric.deltaPct);
              return (
                <td
                  key={metric.key}
                  className={cn(
                    'px-1.5 py-2',
                    tone === 'up'
                      ? 'text-noorix-blue'
                      : tone === 'down'
                        ? 'text-noorix-red'
                        : 'text-noorix-muted',
                  )}
                >
                  {deltaValueText(metric.deltaPct)}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
