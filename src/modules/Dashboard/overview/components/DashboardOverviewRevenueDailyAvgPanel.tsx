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
    <span dir="ltr" className="inline-flex items-baseline justify-center gap-1 text-[13px] nx-font-numbers">
      <span className="font-extrabold">
        <FmtNum n={value} />
      </span>
      {variant === 'currency' ? (
        <span className="nx-sar text-[10px]">SR</span>
      ) : (
        <span className="text-[10px] font-medium text-noorix-muted">
          {t('dashboardSalesCustomerDailyAvgUnit')}
        </span>
      )}
    </span>
  );
}

function deltaValueText(deltaPct: number | null) {
  if (deltaPct == null) return <span className="text-noorix-muted">-</span>;
  return (
    <span dir="ltr" className="text-[12px] nx-font-numbers font-extrabold">
      {deltaPct > 0 ? '+' : ''}
      {formatDeltaPct(deltaPct)}%
    </span>
  );
}

function gridColumns(metricCount: number): React.CSSProperties {
  return {
    gridTemplateColumns: `minmax(5.75rem, 0.72fr) repeat(${metricCount}, minmax(0, 1fr))`,
  };
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
  const columns = gridColumns(metrics.length);

  return (
    <div
      className="mx-4 mt-3 overflow-hidden rounded-xl border border-noorix-border bg-noorix-bg-muted/25 text-center text-[12px]"
      role="table"
      aria-label={t('dashboardSalesDailyAvgActiveDays')}
    >
      <div
        className="grid border-b border-noorix-border text-noorix-muted"
        role="row"
        style={columns}
      >
        <div className="px-3 py-2.5 font-bold" role="columnheader">
          {t('dashboardMetricPeriod')}
        </div>
        {metrics.map((metric) => (
          <div key={metric.key} className="px-2.5 py-2.5 font-bold" role="columnheader">
            {t(metric.labelKey)}
          </div>
        ))}
      </div>
      <div className="divide-y divide-noorix-border/80" role="rowgroup">
        <div className="grid" role="row" style={columns}>
          <div className="px-3 py-2.5 font-semibold text-noorix-muted" role="cell">
            {t('dashboardCurrentMonth')}
          </div>
          {metrics.map((metric) => (
            <div key={metric.key} className="px-2.5 py-2.5 text-noorix-text" role="cell">
              {metricValueText(metric.current, metric.variant, t)}
            </div>
          ))}
        </div>
        <div className="grid" role="row" style={columns}>
          <div className="px-3 py-2.5 font-semibold text-noorix-muted" role="cell">
            {t('dashboardKpiFooterTrailingAvg')}
          </div>
          {metrics.map((metric) => (
            <div key={metric.key} className="px-2.5 py-2.5 text-noorix-muted" role="cell">
              {metricValueText(metric.prev, metric.variant, t)}
            </div>
          ))}
        </div>
        <div className="grid" role="row" style={columns}>
          <div className="px-3 py-2.5 font-semibold text-noorix-muted" role="cell">
            {t('dashboardMetricChange')}
          </div>
          {metrics.map((metric) => {
            const tone = resolveTone(metric.current, metric.prev, metric.deltaPct);
            return (
              <div
                key={metric.key}
                className={cn(
                  'px-2.5 py-2.5',
                  tone === 'up'
                    ? 'text-noorix-blue'
                    : tone === 'down'
                      ? 'text-noorix-red'
                      : 'text-noorix-muted',
                )}
                role="cell"
              >
                {deltaValueText(metric.deltaPct)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
