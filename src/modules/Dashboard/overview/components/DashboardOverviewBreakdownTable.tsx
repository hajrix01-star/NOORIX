import React from 'react';
import { FmtNum } from '../../../../ui';
import { cn } from '../../../../ui/cn';

export type DashboardBreakdownRow = {
  key: string;
  label: string;
  amount: number;
  pct: string;
  customers?: number;
  color?: string;
};

type Props = {
  title?: string;
  /** داخل كرت KPI (مبيعات) — هامش mx-4 */
  embedded?: boolean;
  /** جدول مضغوط داخل كرت الإيرادات */
  compact?: boolean;
  rows: DashboardBreakdownRow[];
  labelHeader: string;
  showCustomers?: boolean;
  showCurrency?: boolean;
  className?: string;
  t: (key: string) => string;
};

const GRID_WITH_CUSTOMERS =
  'grid-cols-[minmax(0,1fr)_minmax(4.75rem,auto)_minmax(2.25rem,auto)_minmax(3.25rem,auto)]';
const GRID_DEFAULT = 'grid-cols-[minmax(0,1fr)_minmax(5rem,auto)_minmax(2.75rem,auto)]';

export function DashboardOverviewBreakdownTable({
  title,
  embedded = false,
  compact = false,
  rows,
  labelHeader,
  showCustomers = false,
  showCurrency = false,
  className,
  t,
}: Props) {
  if (rows.length === 0) return null;

  const gridClass = showCustomers ? GRID_WITH_CUSTOMERS : GRID_DEFAULT;

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-noorix-border bg-noorix-bg-muted/25',
        embedded && 'mx-4 mt-2',
        className,
      )}
    >
      {title ? (
        <div
          className={cn(
            'border-b border-noorix-border',
            compact ? 'px-2.5 py-1.5' : 'px-3 py-2',
          )}
        >
          <span
            className={cn(
              'font-semibold text-noorix-muted',
              compact ? 'text-[9px]' : 'text-[10px]',
            )}
          >
            {title}
          </span>
        </div>
      ) : null}
      <div className={compact ? 'px-2 py-1.5' : 'px-3 py-2'}>
        <div
          className={cn(
            'grid items-center gap-x-2 border-b border-noorix-border text-end',
            compact ? 'pb-1' : 'pb-2',
            gridClass,
          )}
        >
          <span
            className={cn(
              'truncate font-semibold text-noorix-muted',
              compact ? 'text-[9px]' : 'text-[10px]',
            )}
          >
            {labelHeader}
          </span>
          <span className={cn('font-semibold text-noorix-muted', compact ? 'text-[9px]' : 'text-[10px]')}>
            {t('total')}
          </span>
          <span className={cn('font-semibold text-noorix-muted', compact ? 'text-[9px]' : 'text-[10px]')}>
            %
          </span>
          {showCustomers ? (
            <span className={cn('font-semibold text-noorix-muted', compact ? 'text-[9px]' : 'text-[10px]')}>
              {t('customers')}
            </span>
          ) : null}
        </div>
        {rows.map((row, idx) => (
          <div
            key={row.key}
            className={cn(
              'grid items-center gap-x-2 text-end',
              compact ? 'py-1' : 'py-2.5',
              gridClass,
              idx > 0 && 'border-t border-noorix-border',
            )}
          >
            <div className="flex min-w-0 items-center justify-end gap-1.5">
              {row.color ? (
                <span
                  className={cn('shrink-0 rounded-sm', compact ? 'h-1.5 w-1.5' : 'h-2 w-2')}
                  style={{ background: row.color }}
                  aria-hidden
                />
              ) : null}
              <span
                className={cn(
                  'truncate font-semibold text-noorix-text',
                  compact ? 'text-[10px]' : 'text-[11px]',
                )}
              >
                {row.label}
              </span>
            </div>
            <span
              dir="ltr"
              className={cn(
                'nx-font-numbers font-bold text-nx-sales',
                compact ? 'text-[10px]' : 'text-[12px]',
              )}
            >
              <FmtNum n={row.amount} />
              {showCurrency ? (
                <>
                  {' '}
                  <span className="nx-sar">SR</span>
                </>
              ) : null}
            </span>
            <span
              dir="ltr"
              className={cn(
                'nx-font-numbers font-bold',
                compact ? 'text-[10px] text-noorix-blue' : 'text-[12px] text-nx-sales',
              )}
            >
              {row.pct}%
            </span>
            {showCustomers ? (
              <span
                dir="ltr"
                className={cn(
                  'nx-font-numbers font-medium text-noorix-text',
                  compact ? 'text-[10px]' : 'text-[11px]',
                )}
              >
                <FmtNum n={row.customers ?? 0} />
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
