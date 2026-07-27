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

function formatDeltaPct(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  if (Object.is(rounded, -0)) return '0';
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(1);
}

type MetricRowProps = {
  labelKey: string;
  current: number | null;
  prev: number | null;
  t: (key: string) => string;
  variant: 'currency' | 'count';
  showDivider?: boolean;
  deltaPctOverride?: number | null;
};

function DailyAvgMetricRow({
  labelKey,
  current,
  prev,
  t,
  variant,
  showDivider = false,
  deltaPctOverride,
}: MetricRowProps) {
  if (current == null && prev == null) return null;

  const tone = compareRevenueDailyAvgTone(current, prev);
  const deltaPct =
    deltaPctOverride !== undefined
      ? deltaPctOverride
      : current != null && prev != null
        ? revenueDailyAvgDeltaPct(current, prev)
        : null;

  const valueClass =
    tone === 'up'
      ? 'text-noorix-blue'
      : tone === 'down'
        ? 'text-noorix-red'
        : 'text-noorix-text';

  const deltaBadgeClass =
    tone === 'up'
      ? 'bg-[color-mix(in_srgb,var(--color-nx-sales)_14%,transparent)] text-noorix-blue'
      : tone === 'down'
        ? 'bg-[color-mix(in_srgb,var(--color-nx-expenses)_14%,transparent)] text-noorix-red'
        : 'bg-noorix-bg-muted text-noorix-muted';

  return (
    <div className={cn('px-3 py-2.5', showDivider && 'border-t border-noorix-border')}>
      <div className="flex items-center justify-between gap-2 min-w-0">
        <span className="min-w-0 truncate text-[10px] font-semibold text-noorix-muted">
          {t(labelKey)}
        </span>
        {deltaPct != null ? (
          <span
            className={cn(
              'inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold nx-font-numbers ltr',
              deltaBadgeClass,
            )}
            title={t('dashboardKpiFooterChangeVsAvg')}
          >
            {deltaPct > 0 ? '↑ ' : deltaPct < 0 ? '↓ ' : ''}
            {deltaPct > 0 ? '+' : ''}
            {formatDeltaPct(deltaPct)}%
          </span>
        ) : null}
      </div>

      {current != null ? (
        <div
          dir="ltr"
          className={cn(
            'mt-1 flex min-w-0 items-baseline gap-1 text-start nx-font-numbers',
            valueClass,
          )}
        >
          <span className="truncate text-[15px] font-bold leading-tight">
            <FmtNum n={current} />
          </span>
          {variant === 'currency' ? (
            <span className="nx-sar shrink-0">SR</span>
          ) : (
            <span className="shrink-0 text-[10px] font-medium text-noorix-muted">
              {t('dashboardSalesCustomerDailyAvgUnit')}
            </span>
          )}
        </div>
      ) : null}

      {prev != null ? (
        <div className="mt-1.5 flex min-w-0 items-center justify-between gap-2 text-[10px] text-noorix-muted">
          <span className="shrink-0">{t('dashboardKpiFooterTrailingAvg')}</span>
          <span dir="ltr" className="min-w-0 truncate text-start font-medium nx-font-numbers">
            <FmtNum n={prev} />
            {variant === 'currency' ? (
              <> <span className="nx-sar">SR</span></>
            ) : (
              <span className="ms-0.5">{t('dashboardSalesCustomerDailyAvgUnit')}</span>
            )}
          </span>
        </div>
      ) : null}
    </div>
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
  const hasRevenue = revenueCurrent != null || revenuePrev != null;
  const hasCustomers = customerCurrent != null || customerPrev != null;
  const hasBasket = basketCurrent != null || basketPrev != null;
  if (!hasRevenue && !hasCustomers && !hasBasket) return null;

  return (
    <div className="mx-4 mt-2 overflow-hidden rounded-lg border border-noorix-border bg-noorix-bg-muted/25">
      {hasRevenue ? (
        <DailyAvgMetricRow
          labelKey="dashboardSalesDailyAvgActiveDays"
          current={revenueCurrent}
          prev={revenuePrev}
          t={t}
          variant="currency"
        />
      ) : null}
      {hasCustomers ? (
        <DailyAvgMetricRow
          labelKey="dashboardSalesCustomerDailyAvg"
          current={customerCurrent}
          prev={customerPrev}
          t={t}
          variant="count"
          showDivider={hasRevenue}
        />
      ) : null}
      {hasBasket ? (
        <DailyAvgMetricRow
          labelKey="dashboardSalesBasketAvg"
          current={basketCurrent}
          prev={basketPrev}
          t={t}
          variant="currency"
          showDivider={hasRevenue || hasCustomers}
          deltaPctOverride={basketDeltaPct}
        />
      ) : null}
    </div>
  );
}
