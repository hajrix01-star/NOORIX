import React from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { fmt } from '../../utils/format';
import type { AnalyticsStudioPayload } from './types';

export type AnalyticsKpiGridProps = {
  loading: boolean;
  error: Error | null;
  empty: boolean;
  noCompany: boolean;
  pickCompany?: boolean;
  noPermission: boolean;
  data: AnalyticsStudioPayload | undefined;
};

export default function AnalyticsKpiGrid({
  loading,
  error,
  empty,
  noCompany,
  pickCompany,
  noPermission,
  data,
}: AnalyticsKpiGridProps) {
  const { t } = useTranslation();

  if (noPermission) {
    return (
      <div className="rounded-lg border border-noorix-border bg-[var(--noorix-bg-surface)] p-6 text-[14px] text-noorix-muted">
        {t('analyticsStudioNoPermission')}
      </div>
    );
  }
  if (pickCompany) {
    return (
      <div className="rounded-lg border border-noorix-border bg-[var(--noorix-bg-surface)] p-6 text-[14px] text-noorix-muted">
        {t('analyticsStudioPickCompanyHint')}
      </div>
    );
  }
  if (noCompany) {
    return (
      <div className="rounded-lg border border-noorix-border bg-[var(--noorix-bg-surface)] p-6 text-[14px] text-noorix-muted">
        {t('analyticsStudioNoCompany')}
      </div>
    );
  }
  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-[96px] animate-pulse rounded-lg bg-[var(--noorix-bg-muted)]" />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-lg border border-noorix-border bg-[var(--noorix-bg-surface)] p-6 text-[14px] text-red-600">
        {error.message}
      </div>
    );
  }
  if (empty || !data) {
    return (
      <div className="rounded-lg border border-noorix-border bg-[var(--noorix-bg-surface)] p-6 text-[14px] text-noorix-muted">
        {t('analyticsStudioEmpty')}
      </div>
    );
  }

  const kpis = [
    { key: 'sales', label: t('analyticsStudioKpiSales'), value: data.kpis.totalSales },
    { key: 'purchases', label: t('analyticsStudioKpiPurchases'), value: data.kpis.totalPurchases },
    { key: 'outflow', label: t('analyticsStudioKpiOutflow'), value: data.kpis.totalOutflow },
    { key: 'net', label: t('analyticsStudioKpiNetFlow'), value: data.kpis.netInvoiceFlow },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {kpis.map((k) => (
        <div
          key={k.key}
          className="rounded-lg border border-noorix-border bg-[var(--noorix-bg-surface)] p-4 shadow-sm"
        >
          <div className="text-[12px] font-semibold text-noorix-muted">{k.label}</div>
          <div className="mt-2 text-right font-[family-name:var(--noorix-font-numbers)] text-[20px] font-bold tabular-nums">
            {fmt(Number(k.value), 2)} <span className="nx-sar text-[13px] font-semibold">SR</span>
          </div>
        </div>
      ))}
      <div className="rounded-lg border border-noorix-border bg-[var(--noorix-bg-surface)] p-4 shadow-sm sm:col-span-2 lg:col-span-4">
        <div className="text-[12px] font-semibold text-noorix-muted">{t('analyticsStudioInvoiceCount')}</div>
        <div className="mt-1 text-[18px] font-bold tabular-nums">{data.kpis.totalInvoices}</div>
        <div className="mt-2 text-[11px] text-noorix-muted">{t('analyticsStudioSourceHint')}</div>
      </div>
    </div>
  );
}
