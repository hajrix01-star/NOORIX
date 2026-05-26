import React from 'react';
import { FmtNum } from '../../../../ui';
import { cn } from '../../../../ui/cn';
import type { SalesShiftPeriodTotals } from '../utils/dashboardSalesShiftTotals';

type Props = {
  totals: SalesShiftPeriodTotals | null;
  t: (key: string) => string;
};

const ROWS: { key: keyof SalesShiftPeriodTotals; labelKey: string }[] = [
  { key: 'morning', labelKey: 'salesShiftMorning' },
  { key: 'evening', labelKey: 'salesShiftEvening' },
  { key: 'all', labelKey: 'salesShiftFullDay' },
];

export function DashboardOverviewSalesShiftPanel({ totals, t }: Props) {
  if (!totals) return null;
  const hasAny = ROWS.some((r) => totals[r.key].amount > 0);
  if (!hasAny) return null;

  return (
    <div className="mx-4 mt-2 overflow-hidden rounded-lg border border-noorix-border bg-noorix-bg-muted/25">
      <div className="px-3 py-2 border-b border-noorix-border">
        <span className="text-[10px] font-semibold text-noorix-muted">{t('dashboardSalesByShift')}</span>
      </div>
      {ROWS.map((row, idx) => {
        const bucket = totals[row.key];
        if (bucket.amount <= 0) return null;
        return (
          <div
            key={row.key}
            className={cn('px-3 py-2.5', idx > 0 && 'border-t border-noorix-border')}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold text-noorix-muted truncate">{t(row.labelKey)}</span>
              <span dir="ltr" className="shrink-0 text-[12px] font-bold text-nx-sales nx-font-numbers">
                <FmtNum n={bucket.amount} /> <span className="nx-sar">SR</span>
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-noorix-muted">
              <span>{t('customers')}</span>
              <span dir="ltr" className="font-medium nx-font-numbers">
                <FmtNum n={bucket.customers} />
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
