import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LabelList, Cell, PieChart, Pie } from 'recharts';
import { useTranslation } from '../../../../i18n/useTranslation';
import { formatCompactNumber, formatNumber } from '../../../../utils/money';
import { LoadingState, EmptyState } from '../../../../components/states';
import { DashboardPieTooltip } from './DashboardOverviewChartTooltips';

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

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="noorix-surface-card p-4 lg:p-5">
        <div className="text-[14px] font-bold text-noorix-text mb-0.5 max-lg:text-center lg:text-start">
          {t('periodAnalyticsTopSuppliers')}
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
                        style={{
                          background: 'var(--noorix-bg-surface)',
                          border: '1px solid var(--noorix-border)',
                          borderRadius: 6,
                          padding: '8px 12px',
                          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                          fontSize: 12,
                          minWidth: 160,
                        }}
                      >
                        <div style={{ fontWeight: 700, marginBottom: 4, color: d?.fill }}>{d?.name}</div>
                        <div
                          style={{
                            color: 'var(--noorix-text)',
                            fontWeight: 600,
                            fontFamily: 'var(--noorix-font-numbers)',
                          }}
                        >
                          {formatNumber(d?.value, lang, { minFractionDigits: 0, maxFractionDigits: 0 })}{' '}
                          <span className="nx-sar">SR</span>
                        </div>
                        <div style={{ color: 'var(--noorix-text-muted)', fontSize: 11, marginTop: 2 }}>
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
                    style={{ fontSize: 10, fill: 'var(--noorix-text-muted)', fontFamily: 'var(--noorix-font-numbers)' }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="noorix-surface-card p-4 lg:p-5 flex flex-col max-lg:items-center">
        <div className="text-[14px] font-bold text-noorix-text mb-0.5 w-full max-lg:text-center lg:text-start">
          {selectedMonth != null ? t('dashboardPurchasesByCategoryTitleMonth') : t('dashboardPurchasesByCategoryTitlePeriod')}
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
          <>
            <ResponsiveContainer width="100%" height={170}>
              <PieChart>
                <Pie
                  data={purchaseCategoriesPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={78}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {purchaseCategoriesPieData.map((entry, i) => (
                    <Cell key={`${entry.name}-${i}`} fill={entry.fill} />
                  ))}
                </Pie>
              <Tooltip content={(tp) => <DashboardPieTooltip {...(tp as any)} lang={lang} />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-1.5 mt-3 w-full max-lg:max-w-md">
              {purchaseCategoriesPieData.map((cat, idx) => (
                <div key={`${cat.name}-${idx}`} className="flex items-center justify-between gap-2 text-[12px]">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: cat.fill }} />
                    <span className="text-noorix-text truncate">{cat.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-bold text-noorix-text ltr">{formatNumber(cat.value, lang)}</span>
                    <span className="nx-sar">SR</span>
                    <span className="text-noorix-muted">({cat.pct}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
