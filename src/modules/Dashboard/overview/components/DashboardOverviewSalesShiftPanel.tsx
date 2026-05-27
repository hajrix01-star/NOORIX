import React, { useMemo } from 'react';
import type { SalesShiftPeriodTotals } from '../utils/dashboardSalesShiftTotals';
import {
  formatSalesShiftSharePercent,
  salesShiftPeriodGrandTotal,
  salesShiftSharePercent,
} from '../utils/dashboardSalesShiftTotals';
import {
  DashboardOverviewBreakdownTable,
  type DashboardBreakdownRow,
} from './DashboardOverviewBreakdownTable';

type Props = {
  totals: SalesShiftPeriodTotals | null;
  t: (key: string) => string;
  /** جدول مضغوط داخل كرت الإيرادات */
  compact?: boolean;
};

const ROWS: { key: keyof SalesShiftPeriodTotals; labelKey: string }[] = [
  { key: 'morning', labelKey: 'salesShiftMorning' },
  { key: 'evening', labelKey: 'salesShiftEvening' },
  { key: 'all', labelKey: 'salesShiftFullDay' },
];

export function DashboardOverviewSalesShiftPanel({ totals, t, compact = false }: Props) {
  const tableRows = useMemo((): DashboardBreakdownRow[] => {
    if (!totals) return [];
    const active = ROWS.filter((r) => totals[r.key].amount > 0);
    if (active.length === 0) return [];
    const grandTotal = salesShiftPeriodGrandTotal(totals);
    return active.map((r) => {
      const bucket = totals[r.key];
      const sharePct = salesShiftSharePercent(bucket.amount, grandTotal);
      return {
        key: r.key,
        label: t(r.labelKey),
        amount: bucket.amount,
        pct: sharePct != null ? formatSalesShiftSharePercent(sharePct) : '0',
        customers: bucket.customers,
      };
    });
  }, [totals, t]);

  if (tableRows.length === 0) return null;

  return (
    <DashboardOverviewBreakdownTable
      embedded={!compact}
      compact={compact}
      title={t('dashboardSalesByShift')}
      labelHeader={t('salesShiftLabel')}
      rows={tableRows}
      showCustomers
      showCurrency={!compact}
      t={t}
    />
  );
}
