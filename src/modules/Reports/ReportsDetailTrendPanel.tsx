import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  LabelList,
} from 'recharts';
import { KPI_RECHARTS_COLORS } from '../../constants/kpiCardTheme';
import { MetricCard } from '../../ui';
import { fmt } from '../../utils/format';
import { isEmptyMetric, metricCardAmountValue, percentText } from './reportHelpers';
import type {
  ReportTrendData,
  ReportsDetailData,
  TooltipProps,
  TranslateFn,
  TrendChartRow,
  TrendPoint,
} from './reportsDetailModel';

type ReportsDetailTrendPanelProps = {
  t: TranslateFn;
  trendIsError: boolean;
  trendErrorMessage?: string;
  trendLoading: boolean;
  trend: ReportTrendData | undefined;
  trendChartData: TrendChartRow[];
  averageAmount: string;
  peakPoint: TrendPoint | null;
  data: ReportsDetailData;
  displayContextAmount: string | number | null | undefined;
};

export function ReportsDetailTrendPanel({
  t,
  trendIsError,
  trendErrorMessage,
  trendLoading,
  trend,
  trendChartData,
  averageAmount,
  peakPoint,
  data,
  displayContextAmount,
}: ReportsDetailTrendPanelProps) {
  return (
    <>
      {trendIsError && (
        <div className="p-4 mb-2 rounded-xl text-noorix-amber border border-noorix-amber/30 bg-noorix-amber/10 text-[13px]">
          {trendErrorMessage || t('reportTrendLoadError')}
        </div>
      )}
      {trendLoading && !trend && !trendIsError && (
        <div className="py-6 text-center text-noorix-muted text-[13px]">{t('loading')}</div>
      )}
      {trend && (
        <div className="noorix-surface-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <div className="text-[14px] font-extrabold">{t('reportTrend')}</div>
              <div className="mt-1 text-noorix-muted text-[12px]">{t('reportTimeline')}</div>
            </div>
            <div className="text-[12px] text-noorix-muted">
              {t('reportSalesShareYear')}: <strong className="nx-font-numbers">{percentText(trend.percentOfSalesYear)}</strong>
            </div>
          </div>
          <div className="grid gap-2.5 mb-3 [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]">
            <MetricCard color="var(--color-nx-purchases)">
              <MetricCard.Header label={t('reportMonthlyAverage')} />
              <MetricCard.Value value={metricCardAmountValue(averageAmount)} currency="SR" />
            </MetricCard>
            <MetricCard color="var(--color-nx-profit)">
              <MetricCard.Header label={t('reportTopMonth')} />
              <MetricCard.Value value={peakPoint?.label || '—'} />
              <MetricCard.Section>
                <span className="text-[12px] text-noorix-muted inline-flex items-baseline gap-x-1">
                  {peakPoint != null && !isEmptyMetric(peakPoint.amount) ? (
                    <>
                      <span className="nx-font-numbers">{fmt(Number(peakPoint.amount))}</span>
                      <span className="nx-sar">SR</span>
                    </>
                  ) : (
                    '—'
                  )}
                </span>
              </MetricCard.Section>
            </MetricCard>
            <MetricCard color="var(--color-nx-sales)">
              <MetricCard.Header label={t('selectedMonth')} />
              <MetricCard.Value value={data.monthLabel || t('allMonths')} />
              <MetricCard.Section>
                <span className="text-[12px] text-noorix-muted inline-flex items-baseline gap-x-1">
                  {!isEmptyMetric(displayContextAmount) ? (
                    <>
                      <span className="nx-font-numbers">{fmt(Number(displayContextAmount))}</span>
                      <span className="nx-sar">SR</span>
                    </>
                  ) : (
                    '—'
                  )}
                </span>
              </MetricCard.Section>
            </MetricCard>
          </div>
          <div className="mt-1 rounded-xl border border-noorix-border bg-noorix-bg-muted/40 p-2 sm:p-4" dir="ltr">
            <div className="mb-2 text-[11px] font-semibold text-noorix-muted sm:text-[12px]">
              {t('reportTrendChartCaption')}
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={trendChartData} margin={{ top: 24, right: 6, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--noorix-border)" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: 'var(--noorix-text-muted)' }}
                  axisLine={{ stroke: 'var(--noorix-border)' }}
                  tickLine={false}
                  interval={0}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'var(--noorix-text-muted)' }}
                  tickFormatter={(value: number) => fmt(value, 0)}
                  width={44}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'color-mix(in srgb, var(--color-nx-sales) 8%, transparent)' }}
                  content={({ active, payload }: TooltipProps) => {
                    if (!active || !payload?.length) return null;
                    const point = payload[0]?.payload;
                    return (
                      <div className="rounded-lg border border-noorix-border bg-noorix-surface px-3 py-2 shadow-md text-[12px]">
                        <div className="mb-1 font-bold text-noorix-text">{point?.name}</div>
                        <div className="nx-font-numbers font-semibold text-noorix-text">
                          {fmt(point?.rawAmount)} <span className="nx-sar">SR</span>
                        </div>
                        <div className="mt-1 text-[11px] text-nx-profit">
                          {t('reportSalesShare')}: {point?.pctStr}
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={52}>
                  {trendChartData.map((entry) => (
                    <Cell
                      key={entry.key}
                      fill={entry.rawAmount >= 0 ? KPI_RECHARTS_COLORS.grossProfit : KPI_RECHARTS_COLORS.expenses}
                      stroke={entry.isSelected ? KPI_RECHARTS_COLORS.sales : 'transparent'}
                      strokeWidth={entry.isSelected ? 2 : 0}
                    />
                  ))}
                  <LabelList
                    dataKey="pctStr"
                    position="top"
                    style={{
                      fontSize: 10,
                      fill: 'var(--noorix-text-muted)',
                      fontFamily: 'var(--noorix-font-numbers)',
                    }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </>
  );
}

