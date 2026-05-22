import React from 'react';
import { FmtNum } from '../../../../ui';
import { cn } from '../../../../ui/cn';
import {
  compareRevenueDailyAvgTone,
  revenueDailyAvgDeltaPct,
} from '../utils/dashboardOverviewBuilders';

type Props = {
  current: number | null;
  prev: number | null;
  t: (key: string) => string;
};

function formatDeltaPct(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  if (Object.is(rounded, -0)) return '0';
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(1);
}

export function DashboardOverviewRevenueDailyAvgPanel({ current, prev, t }: Props) {
  if (current == null && prev == null) return null;

  const tone = compareRevenueDailyAvgTone(current, prev);
  const deltaPct =
    current != null && prev != null ? revenueDailyAvgDeltaPct(current, prev) : null;

  const currentValueClass =
    tone === 'up'
      ? 'text-noorix-blue'
      : tone === 'down'
        ? 'text-noorix-red'
        : 'text-noorix-text';

  const currentRowClass =
    tone === 'up'
      ? 'bg-[color-mix(in_srgb,var(--color-nx-sales)_10%,transparent)]'
      : tone === 'down'
        ? 'bg-[color-mix(in_srgb,var(--color-nx-expenses)_10%,transparent)]'
        : 'bg-noorix-bg-muted/40';

  const deltaBadgeClass =
    tone === 'up'
      ? 'bg-[color-mix(in_srgb,var(--color-nx-sales)_14%,transparent)] text-noorix-blue'
      : tone === 'down'
        ? 'bg-[color-mix(in_srgb,var(--color-nx-expenses)_14%,transparent)] text-noorix-red'
        : 'bg-noorix-bg-muted text-noorix-muted';

  return (
    <div className="mx-4 mt-2 overflow-hidden rounded-lg border border-noorix-border">
      {current != null ? (
        <div
          className={cn(
            'flex items-center justify-between gap-2 px-3 py-2',
            currentRowClass,
            prev != null ? 'border-b border-noorix-border' : '',
          )}
        >
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[11px] font-semibold leading-snug text-noorix-text">
              {t('dashboardSalesDailyAvgActiveDays')}
            </span>
            {prev != null ? (
              <span className="text-[10px] leading-snug text-noorix-muted">
                {t('dashboardSalesDailyAvgCompareHint')}
              </span>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            {deltaPct != null ? (
              <span
                className={cn(
                  'inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold nx-font-numbers ltr',
                  deltaBadgeClass,
                )}
                title={t('dashboardKpiFooterChangeVsAvg')}
              >
                {deltaPct > 0 ? '↑ ' : deltaPct < 0 ? '↓ ' : ''}
                {deltaPct > 0 ? '+' : ''}
                {formatDeltaPct(deltaPct)}%
              </span>
            ) : null}
            <span
              className={cn(
                'text-[15px] font-bold leading-none nx-font-numbers ltr whitespace-nowrap',
                currentValueClass,
              )}
            >
              <FmtNum n={current} /> <span className="nx-sar">SR</span>
            </span>
          </div>
        </div>
      ) : null}

      {prev != null ? (
        <div className="flex items-center justify-between gap-2 bg-noorix-surface px-3 py-1.5">
          <span className="text-[10px] font-medium text-noorix-muted">
            {t('dashboardKpiFooterTrailingAvg')}
          </span>
          <span className="text-[13px] font-semibold text-noorix-muted nx-font-numbers ltr whitespace-nowrap">
            <FmtNum n={prev} /> <span className="nx-sar">SR</span>
          </span>
        </div>
      ) : null}
    </div>
  );
}
