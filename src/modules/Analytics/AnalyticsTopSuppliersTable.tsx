import React from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { fmt } from '../../utils/format';

export type AnalyticsTopSuppliersTableProps = {
  loading: boolean;
  rows: Array<{ supplierId: string; nameAr: string; totalAmount: string; invoiceCount: number }>;
};

export default function AnalyticsTopSuppliersTable({ loading, rows }: AnalyticsTopSuppliersTableProps) {
  const { t } = useTranslation();

  if (loading) {
    return <div className="mt-2 h-[120px] animate-pulse rounded-lg bg-[var(--noorix-bg-muted)]" />;
  }
  if (!rows.length) {
    return <div className="mt-2 text-[13px] text-noorix-muted">{t('analyticsStudioEmpty')}</div>;
  }

  return (
    <div className="mt-2 overflow-x-auto rounded-lg border border-noorix-border">
      <table className="min-w-[480px] w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-noorix-border bg-[var(--noorix-bg-muted)]">
            <th className="p-3 text-start font-bold">{t('analyticsStudioSupplier')}</th>
            <th className="p-3 text-end font-bold">{t('analyticsStudioAmount')}</th>
            <th className="p-3 text-end font-bold">{t('analyticsStudioInvoices')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.supplierId} className="border-b border-noorix-border">
              <td className="p-3">{s.nameAr}</td>
              <td className="p-3 text-end tabular-nums font-[family-name:var(--noorix-font-numbers)]">
                {fmt(Number(s.totalAmount), 2)} <span className="nx-sar text-[11px]">SR</span>
              </td>
              <td className="p-3 text-end">{s.invoiceCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
