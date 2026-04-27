import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { useTranslation } from '../../i18n/useTranslation';
import { fmt } from '../../utils/format';
import type { AnalyticsStudioPayload } from './types';
import { KPI_RECHARTS_COLORS } from '../../constants/kpiCardTheme';

export type AnalyticsChartsGridProps = {
  loading: boolean;
  error: boolean;
  empty: boolean;
  data: AnalyticsStudioPayload | undefined;
};

export default function AnalyticsChartsGrid({ loading, error, empty, data }: AnalyticsChartsGridProps) {
  const { t, lang } = useTranslation();

  const kindChart = useMemo(() => {
    if (!data?.mergedPeriodBlock?.totalsByKind) return [];
    const rows: { kind: string; amount: number }[] = [];
    for (const [kind, v] of Object.entries(data.mergedPeriodBlock.totalsByKind)) {
      const row = v as { totalAmount?: string; invoiceCount?: number };
      const n = Number(row.totalAmount || 0);
      if (n !== 0) rows.push({ kind, amount: n });
    }
    return rows.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  }, [data]);

  const purchaseCats = data?.mergedPeriodBlock?.purchaseCategoryBreakdown ?? [];

  if (loading) {
    return <div className="h-[280px] animate-pulse rounded-lg bg-[var(--noorix-bg-muted)]" />;
  }
  if (error || empty || !data) {
    return null;
  }

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-2">
      <div className="rounded-lg border border-noorix-border bg-[var(--noorix-bg-surface)] p-4">
        <div className="mb-3 text-[14px] font-bold">{t('analyticsStudioChartByKind')}</div>
        {kindChart.length === 0 ? (
          <div className="py-8 text-center text-[13px] text-noorix-muted">{t('analyticsStudioEmpty')}</div>
        ) : (
          <div className="h-[260px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={kindChart} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--noorix-border)" />
                <XAxis dataKey="kind" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v: number) => fmt(v, 0)} width={56} />
                <Tooltip
                  formatter={(value: any) => [`${fmt(Number(value), 2)} SR`, t('analyticsStudioAmount')]}
                  labelFormatter={(label: any) => String(label ?? '')}
                />
                <Bar dataKey="amount" fill={KPI_RECHARTS_COLORS.sales} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-noorix-border bg-[var(--noorix-bg-surface)] p-4">
        <div className="mb-3 text-[14px] font-bold">{t('analyticsStudioChartPurchaseCategories')}</div>
        {purchaseCats.length === 0 ? (
          <div className="py-8 text-center text-[13px] text-noorix-muted">{t('analyticsStudioEmpty')}</div>
        ) : (
          <div className="max-h-[280px] overflow-y-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-noorix-border bg-[var(--noorix-bg-muted)]">
                  <th className="p-2 text-start font-bold">{t('analyticsStudioCategory')}</th>
                  <th className="p-2 text-end font-bold">{t('analyticsStudioAmount')}</th>
                </tr>
              </thead>
              <tbody>
                {purchaseCats.map((row: (typeof purchaseCats)[number]) => (
                  <tr key={`${row.nameAr}-${row.amount}`} className="border-b border-noorix-border">
                    <td className="p-2">{lang === 'en' ? row.nameEn || row.nameAr : row.nameAr}</td>
                    <td className="p-2 text-end tabular-nums font-[family-name:var(--noorix-font-numbers)]">
                      {fmt(Number(row.amount), 2)} <span className="nx-sar text-[11px]">SR</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
