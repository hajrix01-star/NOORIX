import React from 'react';
import { FmtNum } from '../../../../ui';
import { cn } from '../../../../ui/cn';
import type { SalesShiftPeriodTotals } from '../utils/dashboardSalesShiftTotals';
import {
  formatSalesShiftSharePercent,
  salesShiftPeriodGrandTotal,
  salesShiftSharePercent,
} from '../utils/dashboardSalesShiftTotals';

type Props = {
  totals: SalesShiftPeriodTotals | null;
  t: (key: string) => string;
  /** جدول مضغوط بدل صفوف مزدوجة */
  compact?: boolean;
};

const ROWS: { key: keyof SalesShiftPeriodTotals; labelKey: string }[] = [
  { key: 'morning', labelKey: 'salesShiftMorning' },
  { key: 'evening', labelKey: 'salesShiftEvening' },
  { key: 'all', labelKey: 'salesShiftFullDay' },
];

export function DashboardOverviewSalesShiftPanel({ totals, t, compact = false }: Props) {
  if (!totals) return null;
  const visible = ROWS.filter((r) => totals[r.key].amount > 0);
  if (visible.length === 0) return null;

  const grandTotal = salesShiftPeriodGrandTotal(totals);

  if (compact) {
    return (
      <div className="overflow-hidden rounded-lg border border-noorix-border bg-noorix-bg-muted/25">
        <div className="px-2.5 py-1.5 border-b border-noorix-border">
          <span className="text-[9px] font-semibold text-noorix-muted">{t('dashboardSalesByShift')}</span>
        </div>
        <table className="w-full text-[10px]">
          <thead>
            <tr className="text-noorix-muted">
              <th className="px-2 py-1 text-start font-semibold">{t('salesShiftLabel')}</th>
              <th className="px-2 py-1 text-end font-semibold">{t('total')}</th>
              <th className="px-2 py-1 text-end font-semibold w-[2.5rem]">%</th>
              <th className="px-2 py-1 text-end font-semibold">{t('customers')}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const bucket = totals[row.key];
              const sharePct = salesShiftSharePercent(bucket.amount, grandTotal);
              return (
                <tr key={row.key} className="border-t border-noorix-border/80">
                  <td className="px-2 py-1 font-medium text-noorix-text truncate max-w-[5rem]">
                    {t(row.labelKey)}
                  </td>
                  <td dir="ltr" className="px-2 py-1 text-end font-bold text-nx-sales nx-font-numbers whitespace-nowrap">
                    <FmtNum n={bucket.amount} />
                  </td>
                  <td dir="ltr" className="px-2 py-1 text-end font-semibold text-noorix-blue nx-font-numbers">
                    {sharePct != null ? `${formatSalesShiftSharePercent(sharePct)}%` : '—'}
                  </td>
                  <td dir="ltr" className="px-2 py-1 text-end text-noorix-muted nx-font-numbers">
                    <FmtNum n={bucket.customers} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="mx-4 mt-2 overflow-hidden rounded-lg border border-noorix-border bg-noorix-bg-muted/25">
      <div className="px-3 py-2 border-b border-noorix-border">
        <span className="text-[10px] font-semibold text-noorix-muted">{t('dashboardSalesByShift')}</span>
      </div>
      {visible.map((row, idx) => {
        const bucket = totals[row.key];
        const sharePct = salesShiftSharePercent(bucket.amount, grandTotal);
        const shareLabel =
          sharePct != null ? `${formatSalesShiftSharePercent(sharePct)}%` : null;
        return (
          <div
            key={row.key}
            className={cn('px-3 py-2.5', idx > 0 && 'border-t border-noorix-border')}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold text-noorix-muted truncate">{t(row.labelKey)}</span>
              <div dir="ltr" className="flex shrink-0 items-center gap-2">
                {shareLabel ? (
                  <span
                    className="text-[10px] font-bold text-noorix-blue nx-font-numbers"
                    title={t('dashboardShiftShareOfSales')}
                  >
                    {shareLabel}
                  </span>
                ) : null}
                <span className="text-[12px] font-bold text-nx-sales nx-font-numbers">
                  <FmtNum n={bucket.amount} /> <span className="nx-sar">SR</span>
                </span>
              </div>
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
