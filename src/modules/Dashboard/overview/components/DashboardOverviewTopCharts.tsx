import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LabelList, Cell } from 'recharts';
import { useTranslation } from '../../../../i18n/useTranslation';
import { formatCompactNumber, formatNumber } from '../../../../utils/money';
import { LoadingState, EmptyState } from '../../../../components/states';
import { DashboardOverviewBreakdownTable } from './DashboardOverviewBreakdownTable';

const TOP_SUPPLIER_LABEL_STYLE: React.CSSProperties = {
  fontSize: 10,
  fill: 'var(--noorix-text-muted)',
  fontFamily: 'var(--noorix-font-numbers)',
};

type TopSuppliersRow = {
  name: string;
  value: number;
  count: number;
  pct: string;
  fill: string;
};

type CatRow = { name: string; value: number; pct: string; fill: string };

type Props = {
  lang: string;
  supplierFrom: string;
  supplierTo: string;
  isPeriodLoading: boolean;
  topSuppliersChartData: TopSuppliersRow[];
  purchaseCategoriesPieData: CatRow[];
  selectedMonth: number | null;
  periodPurchaseTotal: number;
};

export function DashboardOverviewTopCharts({
  lang,
  supplierFrom,
  supplierTo,
  isPeriodLoading,
  topSuppliersChartData,
  purchaseCategoriesPieData,
  selectedMonth,
  periodPurchaseTotal,
}: Props) {
  const { t } = useTranslation();
  const operationalLabel = lang === 'ar' ? 'تحليل تشغيلي' : 'Operational analysis';

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
      <div className="noorix-surface-card p-4 lg:p-5">
        <div className="mb-0.5 flex flex-wrap items-center gap-2 max-lg:justify-center lg:justify-start">
          <span className="text-[14px] font-bold text-noorix-text">{t('periodAnalyticsTopSuppliers')}</span>
          <span className="rounded-full bg-noorix-bg-muted px-2 py-0.5 text-[11px] font-semibold text-noorix-muted">
            {operationalLabel}
          </span>
        </div>
        <div className="text-[12px] text-noorix-muted mb-4 max-lg:text-center lg:text-start">
          {supplierFrom} — {supplierTo}
        </div>
        {isPeriodLoading ? (
          <div className="h-[220px] flex items-center justify-center">
            <LoadingState />
          </div>
        ) : topSuppliersChartData.length === 0 ? (
          <EmptyState
            className="h-[220px]"
            icon={
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            }
          >
            {t('noDataInPeriod')}
          </EmptyState>
        ) : (
          <div dir="ltr">
            <ResponsiveContainer width="100%" height={Math.max(220, topSuppliersChartData.length * 40)}>
              <BarChart layout="vertical" data={topSuppliersChartData} margin={{ top: 0, right: 56, left: 0, bottom: 0 }}>
                <XAxis
                  type="number"
                  tickFormatter={(v: number) => formatCompactNumber(v, lang)}
                  tick={{ fontSize: 10, fill: 'var(--noorix-text-muted)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={140}
                  tick={{ fontSize: 11, fill: 'var(--noorix-text)', fontFamily: 'var(--noorix-font-primary)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]?.payload as TopSuppliersRow;
                    return (
                      <div
                        className="min-w-[160px] rounded-md border border-noorix-border bg-noorix-surface py-2 px-3 text-[12px] shadow-[0_4px_16px_rgba(0,0,0,0.12)]"
                      >
                        <div style={{ fontWeight: 700, marginBottom: 4, color: d?.fill }}>{d?.name}</div>
                        <div
                          className="font-semibold text-noorix-text nx-font-numbers"
                        >
                          {formatNumber(d?.value, lang, { minFractionDigits: 0, maxFractionDigits: 0 })}{' '}
                          <span className="nx-sar">SR</span>
                        </div>
                        <div className="mt-0.5 text-[11px] text-noorix-muted">
                          {d?.count} {lang === 'ar' ? 'فاتورة' : 'inv.'} · {d?.pct}%
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={20}>
                  {topSuppliersChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                  <LabelList
                    dataKey="value"
                    position="right"
                    formatter={(v) =>
                      formatNumber(
                        typeof v === 'number' ? v : Number(v),
                        lang,
                        { minFractionDigits: 0, maxFractionDigits: 0 },
                      )
                    }
                    style={TOP_SUPPLIER_LABEL_STYLE}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="noorix-surface-card p-4 lg:p-5 flex flex-col max-lg:items-center">
        <div className="mb-0.5 flex w-full flex-wrap items-center gap-2 max-lg:justify-center lg:justify-start">
          <span className="text-[14px] font-bold text-noorix-text">
            {selectedMonth != null ? t('dashboardPurchasesByCategoryTitleMonth') : t('dashboardPurchasesByCategoryTitlePeriod')}
          </span>
          <span className="rounded-full bg-noorix-bg-muted px-2 py-0.5 text-[11px] font-semibold text-noorix-muted">
            {operationalLabel}
          </span>
        </div>
        <div className="text-[12px] text-noorix-muted mb-1 w-full max-lg:text-center lg:text-start">
          {supplierFrom} — {supplierTo}
        </div>
        <div className="text-[12px] text-noorix-muted mb-4 w-full max-lg:text-center lg:text-start">
          {t('dashboardPurchasesTotalForPeriod')}:{' '}
          {isPeriodLoading ? (
            '…'
          ) : (
            <>
              <span className="font-bold text-noorix-text ltr">{formatNumber(periodPurchaseTotal, lang)}</span>{' '}
              <span className="nx-sar">SR</span>
            </>
          )}
        </div>
        {isPeriodLoading ? (
          <div className="h-[170px] flex items-center justify-center">
            <LoadingState />
          </div>
        ) : purchaseCategoriesPieData.length === 0 ? (
          <EmptyState className="h-[170px] text-[12px] px-1">
            {t('dashboardNoPurchasesByCategory')}
          </EmptyState>
        ) : (
          <DashboardOverviewBreakdownTable
            className="w-full"
            labelHeader={t('category')}
            rows={purchaseCategoriesPieData.map((cat, idx) => ({
              key: `${cat.name}-${idx}`,
              label: cat.name,
              amount: cat.value,
              pct: cat.pct,
              color: cat.fill,
            }))}
            showCurrency
            t={t}
          />
        )}
      </div>
    </div>
  );
}
