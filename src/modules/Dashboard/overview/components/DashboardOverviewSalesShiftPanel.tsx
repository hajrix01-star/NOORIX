import React, { useMemo } from 'react';
import type { DashboardSalesShiftTotals } from '../../../../types/api/domains/dashboard';
import { formatSalesShiftSharePercent } from '../utils/dashboardSalesShiftTotals';
import {
  DashboardOverviewBreakdownTable,
  type DashboardBreakdownRow,
} from './DashboardOverviewBreakdownTable';

type Props = {
  totals: DashboardSalesShiftTotals | null;
  t: (key: string) => string;
  /** جدول مضغوط داخل كرت الإيرادات */
  compact?: boolean;
};

const ROWS: { key: keyof DashboardSalesShiftTotals; labelKey: string }[] = [
  { key: 'morning', labelKey: 'salesShiftMorning' },
  { key: 'evening', labelKey: 'salesShiftEvening' },
  { key: 'all', labelKey: 'salesShiftFullDay' },
];

export function DashboardOverviewSalesShiftPanel({ totals, t, compact = false }: Props) {
  const tableRows = useMemo((): DashboardBreakdownRow[] => {
    if (!totals) return [];
    const active = ROWS.filter((r) => totals[r.key].amount > 0);
    if (active.length === 0) return [];
    return active.map((r) => {
      const bucket = totals[r.key];
      return {
        key: r.key,
        label: t(r.labelKey),
        amount: bucket.amount,
        pct: bucket.sharePct != null ? formatSalesShiftSharePercent(bucket.sharePct) : '0',
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
