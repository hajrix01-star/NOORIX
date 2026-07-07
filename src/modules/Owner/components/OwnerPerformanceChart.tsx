import React from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTranslation } from '../../../i18n/useTranslation';
import { Button, ChartState, ColorSwatch, RuntimeStyleBox, cn } from '../../../ui';
import { useUiDir } from '../../../hooks/useUiDir';
import { useIsNarrow700 } from '../../../ui';
import { formatCompactNumber, formatMoney } from '../../../utils/money';
import type { OwnerCompanySeries, OwnerOverviewChartPoint, OwnerOverviewMetric } from '../types';

const OWNER_METRIC_BUTTON_CLASSES: Record<OwnerOverviewMetric, string> = {
  sales: 'nx-owner-metric--sales',
  purchases: 'nx-owner-metric--purchases',
  expenses: 'nx-owner-metric--expenses',
  netProfit: 'nx-owner-metric--net-profit',
};

const OWNER_METRIC_DOT_CLASSES: Record<OwnerOverviewMetric, string> = {
  sales: 'nx-owner-dot--sales',
  purchases: 'nx-owner-dot--purchases',
  expenses: 'nx-owner-dot--expenses',
  netProfit: 'nx-owner-dot--net-profit',
};

function ChartTooltip({
  active,
  payload,
  label,
  companySeries,
  lang,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{
    dataKey?: string | number;
    name?: string;
    value?: number;
    color?: string;
  }>;
  label?: string | number;
  companySeries: OwnerCompanySeries[];
  lang: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[140px] rounded-md border border-noorix-border bg-noorix-surface py-2 px-3 text-[12px] shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
      <div className="mb-[5px] text-[11px] font-bold text-noorix-text">
        {label != null ? String(label) : ''}
      </div>
      {payload.map((point) => {
        const dataKey = String(point.dataKey ?? '');
        const company = companySeries.find((item) => item.key === dataKey);
        return (
          <RuntimeStyleBox
            key={dataKey}
            className="mt-0.5 flex justify-between gap-3 font-semibold"
            color={point.color}
          >
            <span>{company?.label ?? point.name}</span>
            <span className="nx-font-numbers">
              {formatMoney(point.value, lang)} <span className="nx-sar">SR</span>
            </span>
          </RuntimeStyleBox>
        );
      })}
    </div>
  );
}

type OwnerPerformanceChartProps = {
  chartGrain: string;
  setChartGrain: (grain: string) => void;
  chartMetric: OwnerOverviewMetric;
  setChartMetric: (metric: OwnerOverviewMetric) => void;
  monthlyPerformance: Record<OwnerOverviewMetric, OwnerOverviewChartPoint[]>;
  dailyPerformance: OwnerOverviewChartPoint[];
  companySeries: OwnerCompanySeries[];
  chartSubtitle: string;
};

export function OwnerPerformanceChart({
  chartGrain,
  setChartGrain,
  chartMetric,
  setChartMetric,
  monthlyPerformance,
  dailyPerformance,
  companySeries,
  chartSubtitle,
}: OwnerPerformanceChartProps) {
  const { t, lang } = useTranslation();
  const uiDir = useUiDir();
  const isMobile = useIsNarrow700();
  const performanceData = chartGrain === 'daily' ? dailyPerformance : monthlyPerformance[chartMetric];
  const metrics: { key: OwnerOverviewMetric; label: string }[] = [
    { key: 'sales', label: t('annualSales') },
    { key: 'purchases', label: t('annualPurchases') },
    { key: 'expenses', label: t('annualExpenses') },
    { key: 'netProfit', label: t('ownerTotalNetProfit') },
  ];

  return (
    <div className={cn('noorix-surface-card', isMobile ? 'p-3' : 'p-5')}>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div>
          <div className="text-[14px] font-bold text-noorix-text">{t('ownerMonthlySales')}</div>
          <div className="text-[12px] text-noorix-muted mt-0.5">{chartSubtitle}</div>
        </div>
        <ChartControls
          chartGrain={chartGrain}
          setChartGrain={setChartGrain}
          chartMetric={chartMetric}
          setChartMetric={setChartMetric}
          metrics={metrics}
          uiDir={uiDir}
        />
      </div>

      {performanceData.length > 0 ? (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart
            data={performanceData}
            margin={{ top: 4, right: 4, left: -10, bottom: 0 }}
            barCategoryGap={chartGrain === 'monthly' ? '22%' : '12%'}
            barGap={3}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--noorix-border)" opacity={0.6} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: 'var(--noorix-text-muted)', fontFamily: 'var(--noorix-font-primary)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(value: number) => formatCompactNumber(value, lang)}
              tick={{ fontSize: 10, fill: 'var(--noorix-text-muted)' }}
              axisLine={false}
              tickLine={false}
              width={46}
            />
            <Tooltip
              content={(props) => (
                <ChartTooltip
                  active={props.active}
                  payload={
                    props.payload as
                      | ReadonlyArray<{
                          dataKey?: string | number;
                          name?: string;
                          value?: number;
                          color?: string;
                        }>
                      | undefined
                  }
                  label={props.label}
                  companySeries={companySeries}
                  lang={lang}
                />
              )}
            />
            {companySeries.map((series) => (
              <Bar
                key={series.key}
                dataKey={series.key}
                name={series.label}
                fill={series.color}
                fillOpacity={0.9}
                radius={[4, 4, 0, 0]}
                maxBarSize={chartGrain === 'monthly' ? 28 : 12}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <ChartState kind="noData" className="min-h-[240px] border-0 bg-transparent">
          {t('noData')}
        </ChartState>
      )}

      <div className="flex flex-wrap gap-4 mt-4 border-t border-noorix-border pt-3">
        {companySeries.map((series) => (
          <div key={series.key} className="flex items-center gap-1.5">
            <ColorSwatch className="w-2.5 h-2.5 rounded-sm shrink-0" color={series.color} />
            <span className="text-[12px]">{series.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

type ChartControlsProps = {
  chartGrain: string;
  setChartGrain: (grain: string) => void;
  chartMetric: OwnerOverviewMetric;
  setChartMetric: (metric: OwnerOverviewMetric) => void;
  metrics: { key: OwnerOverviewMetric; label: string }[];
  uiDir: string;
};

function ChartControls({
  chartGrain,
  setChartGrain,
  chartMetric,
  setChartMetric,
  metrics,
  uiDir,
}: ChartControlsProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div
        role="tablist"
        dir={uiDir}
        className="inline-flex shrink-0 items-stretch rounded-lg border border-noorix-border bg-noorix-bg-muted p-0.5"
      >
        <Button
          type="button"
          role="tab"
          aria-selected={chartGrain === 'monthly'}
          variant="raw"
          size="auto"
          className={cn(
            'min-h-9 rounded-md px-3 py-1.5 text-[12px] font-semibold sm:min-h-8 sm:py-1',
            chartGrain === 'monthly'
              ? 'bg-noorix-surface text-noorix-text shadow-sm'
              : 'text-noorix-muted hover:bg-noorix-surface/60 hover:text-noorix-text',
          )}
          onClick={() => setChartGrain('monthly')}
        >
          {t('dashboardTimelineMonthly')}
        </Button>
        <Button
          type="button"
          role="tab"
          aria-selected={chartGrain === 'daily'}
          variant="raw"
          size="auto"
          className={cn(
            'min-h-9 rounded-md px-3 py-1.5 text-[12px] font-semibold sm:min-h-8 sm:py-1',
            chartGrain === 'daily'
              ? 'bg-noorix-surface text-noorix-text shadow-sm'
              : 'text-noorix-muted hover:bg-noorix-surface/60 hover:text-noorix-text',
          )}
          onClick={() => setChartGrain('daily')}
        >
          {t('dashboardTimelineDaily')}
        </Button>
      </div>

      {metrics.map((metric) => {
        const disabled = chartGrain === 'daily' && metric.key !== 'sales';
        const active = !disabled && chartMetric === metric.key;
        return (
          <Button
            type="button"
            variant="raw"
            size="auto"
            key={metric.key}
            onClick={() => !disabled && setChartMetric(metric.key)}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded border transition-all duration-150 select-none',
              active ? OWNER_METRIC_BUTTON_CLASSES[metric.key] : 'border-noorix-border bg-transparent text-noorix-muted',
              disabled ? 'cursor-not-allowed opacity-[0.35] text-noorix-border' : 'cursor-pointer',
            )}
          >
            <span
              className={cn(
                'inline-block h-2.5 w-2.5 shrink-0 rounded-sm',
                active ? OWNER_METRIC_DOT_CLASSES[metric.key] : 'bg-noorix-border',
              )}
            />
            {metric.label}
          </Button>
        );
      })}
    </div>
  );
}
