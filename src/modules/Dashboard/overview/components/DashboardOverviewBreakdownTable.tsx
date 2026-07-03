import React from 'react';
import { ColorSwatch, FmtNum } from '../../../../ui';
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

/** أعمدة متساوية — ثلاثة أو أربعة — مع محاذاة وسط */
const GRID_3 = 'grid-cols-3';
const GRID_4 = 'grid-cols-4';

const thClass = (compact: boolean) =>
  cn(
    'text-center font-semibold text-noorix-muted',
    compact ? 'px-1 py-1 text-[9px]' : 'px-2 py-1.5 text-[10px]',
  );

const tdClass = (compact: boolean) =>
  cn('text-center', compact ? 'px-1 py-1' : 'px-2 py-2');

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

  const gridClass = showCustomers ? GRID_4 : GRID_3;

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
            'border-b border-noorix-border text-center',
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
      <div className={compact ? 'px-1.5 py-1.5' : 'px-2 py-2'}>
        <div
          className={cn(
            'grid items-center border-b border-noorix-border',
            gridClass,
            compact ? 'pb-1' : 'pb-1.5',
          )}
        >
          <span className={thClass(compact)}>{labelHeader}</span>
          <span className={thClass(compact)}>{t('total')}</span>
          <span className={thClass(compact)}>%</span>
          {showCustomers ? <span className={thClass(compact)}>{t('customers')}</span> : null}
        </div>
        {rows.map((row, idx) => (
          <div
            key={row.key}
            className={cn(
              'grid items-center',
              gridClass,
              idx > 0 && 'border-t border-noorix-border',
            )}
          >
            <div className={cn(tdClass(compact), 'min-w-0')}>
              <div className="mx-auto flex max-w-full items-center justify-center gap-1.5">
                {row.color ? (
                  <ColorSwatch
                    className={cn('shrink-0 rounded-full', compact ? 'h-1.5 w-1.5' : 'h-2 w-2')}
                    color={row.color}
                    aria-hidden
                  />
                ) : null}
                <span
                  className={cn(
                    'truncate font-semibold text-noorix-text',
                    compact ? 'text-[10px]' : 'text-[11px]',
                  )}
                  title={row.label}
                >
                  {row.label}
                </span>
              </div>
            </div>
            <div className={tdClass(compact)}>
              <span
                dir="ltr"
                className={cn(
                  'inline-flex items-center justify-center gap-0.5 nx-font-numbers font-bold text-nx-sales',
                  compact ? 'text-[10px]' : 'text-[12px]',
                )}
              >
                <FmtNum n={row.amount} />
                {showCurrency ? <span className="nx-sar">SR</span> : null}
              </span>
            </div>
            <div className={tdClass(compact)}>
              <span
                dir="ltr"
                className={cn(
                  'inline-block nx-font-numbers font-bold',
                  compact ? 'text-[10px] text-noorix-blue' : 'text-[12px] text-nx-sales',
                )}
              >
                {row.pct}%
              </span>
            </div>
            {showCustomers ? (
              <div className={tdClass(compact)}>
                <span
                  dir="ltr"
                  className={cn(
                    'inline-block nx-font-numbers font-medium text-noorix-text',
                    compact ? 'text-[10px]' : 'text-[11px]',
                  )}
                >
                  <FmtNum n={row.customers ?? 0} />
                </span>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
