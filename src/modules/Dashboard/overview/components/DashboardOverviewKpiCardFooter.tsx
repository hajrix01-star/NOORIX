import React from 'react';
import { cn } from '../../../../ui/cn';
import type { KpiFooterRow } from '../utils/dashboardOverviewKpiInsightFooters';
import { kpiFooterRowColorClass } from '../utils/dashboardOverviewKpiInsightFooters';

type Props = {
  periodLabel: string;
  rows?: KpiFooterRow[];
  fallback?: React.ReactNode;
  timelineHint?: string;
  className?: string;
};

/** تذييل موحّد لكروت KPI — محاذاة ثابتة مع حد علوي */
export function DashboardOverviewKpiCardFooter({
  periodLabel,
  rows,
  fallback,
  timelineHint,
  className,
}: Props) {
  const hasRows = (rows?.length ?? 0) > 0;

  return (
    <div
      className={cn(
        'mt-auto shrink-0 border-t border-noorix-border',
        'mx-4 mb-3 pt-2.5 pb-1 flex flex-col gap-1.5',
        className,
      )}
    >
      <span className="text-[10px] font-medium leading-snug text-noorix-muted text-start">
        {periodLabel}
      </span>

      {hasRows ? (
        <div className="flex flex-col divide-y divide-noorix-border">
          {rows!.map((row, idx) => (
            <div
              key={`kpi-footer-row-${idx}`}
              className="flex items-center justify-between gap-3 py-1.5 min-h-[28px]"
              title={row.tooltip}
            >
              <span className="min-w-0 flex-1 text-[10px] leading-snug text-noorix-muted text-start truncate">
                {row.label}
              </span>
              <span
                className={cn(
                  'shrink-0 max-w-[55%] text-end text-[11px] font-bold leading-tight nx-font-numbers ltr',
                  kpiFooterRowColorClass(row.color),
                )}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>
      ) : (
        fallback
      )}

      {timelineHint ? (
        <p className="m-0 pt-0.5 text-[9px] leading-snug text-noorix-muted text-start border-t border-dashed border-noorix-border/80">
          {timelineHint}
        </p>
      ) : null}
    </div>
  );
}
