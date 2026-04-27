import React from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { fmt } from '../../utils/format';
import type { AnalyticsStudioCompanyRow } from './types';

export type AnalyticsDrilldownTableProps = {
  loading: boolean;
  rows: AnalyticsStudioCompanyRow[];
};

export default function AnalyticsDrilldownTable({ loading, rows }: AnalyticsDrilldownTableProps) {
  const { t, lang } = useTranslation();

  if (loading) {
    return <div className="mt-8 h-[160px] animate-pulse rounded-lg bg-[var(--noorix-bg-muted)]" />;
  }

  if (!rows.length) {
    return null;
  }

  return (
    <div className="mt-8 overflow-x-auto rounded-lg border border-noorix-border">
      <table className="min-w-[720px] w-full border-collapse text-[13px]" style={{ tableLayout: 'fixed' }}>
        <thead>
          <tr className="border-b border-noorix-border bg-[var(--noorix-bg-muted)]">
            <th className="p-3 text-start font-bold">{t('analyticsStudioDrilldownCompany')}</th>
            <th className="p-3 text-end font-bold">{t('analyticsStudioDrilldownSales')}</th>
            <th className="p-3 text-end font-bold">{t('analyticsStudioDrilldownPurchases')}</th>
            <th className="p-3 text-end font-bold">{t('analyticsStudioDrilldownOutflow')}</th>
            <th className="p-3 text-end font-bold">{t('analyticsStudioDrilldownEstimatedNet')}</th>
            <th className="p-3 text-end font-bold">{t('analyticsStudioDrilldownInvoices')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.companyId} className="border-b border-noorix-border">
              <td className="p-3 truncate" title={lang === 'en' ? r.nameEn || r.nameAr : r.nameAr}>
                {lang === 'en' ? r.nameEn || r.nameAr : r.nameAr}
              </td>
              <td className="p-3 text-end tabular-nums font-[family-name:var(--noorix-font-numbers)]">
                {fmt(Number(r.totalSales), 2)} <span className="nx-sar text-[11px]">SR</span>
              </td>
              <td className="p-3 text-end tabular-nums font-[family-name:var(--noorix-font-numbers)]">
                {fmt(Number(r.totalPurchases), 2)} <span className="nx-sar text-[11px]">SR</span>
              </td>
              <td className="p-3 text-end tabular-nums font-[family-name:var(--noorix-font-numbers)]">
                {fmt(Number(r.totalOutflow), 2)} <span className="nx-sar text-[11px]">SR</span>
              </td>
              <td className="p-3 text-end tabular-nums font-[family-name:var(--noorix-font-numbers)]">
                {fmt(Number(r.netInvoiceFlow), 2)} <span className="nx-sar text-[11px]">SR</span>
              </td>
              <td className="p-3 text-end tabular-nums">{r.totalInvoices}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
