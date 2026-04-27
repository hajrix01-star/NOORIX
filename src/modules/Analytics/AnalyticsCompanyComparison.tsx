import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useTranslation } from '../../i18n/useTranslation';
import { fmt } from '../../utils/format';
import type { AnalyticsStudioCompanyRow } from './types';
import { KPI_RECHARTS_COLORS } from '../../constants/kpiCardTheme';

export type AnalyticsCompanyComparisonProps = {
  loading: boolean;
  rows: AnalyticsStudioCompanyRow[];
};

export default function AnalyticsCompanyComparison({ loading, rows }: AnalyticsCompanyComparisonProps) {
  const { lang } = useTranslation();

  if (loading || rows.length <= 1) return null;

  const data = rows.map((r) => ({
    name: lang === 'en' ? r.nameEn || r.nameAr : r.nameAr,
    sales: Number(r.totalSales),
  }));

  return (
    <div className="mt-8 rounded-lg border border-noorix-border bg-[var(--noorix-bg-surface)] p-4">
      <div className="mb-3 text-[14px] font-bold">{lang === 'en' ? 'Sales by company' : 'المبيعات حسب الشركة'}</div>
      <div className="h-[240px] w-full min-w-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--noorix-border)" />
            <XAxis type="number" tickFormatter={(v: number) => fmt(v, 0)} />
            <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value: any) => [`${fmt(Number(value), 2)} SR`, '']} />
            <Bar dataKey="sales" fill={KPI_RECHARTS_COLORS.sales} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
