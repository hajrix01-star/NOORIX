import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { useTranslation } from '../../../i18n/useTranslation';
import { Button, cn } from '../../../ui';
import { useUiDir } from '../../../hooks/useUiDir';
import { useIsNarrow700 } from '../../../hooks/useMediaQuery';
import { KPI_RECHARTS_COLORS } from '../../../constants/kpiCardTheme';
import { formatCompactNumber, formatMoney } from '../../../utils/money';
import type { OwnerCompanySeries, OwnerChartPoint } from '../types';
import type { CompanyListItem } from '../../../context/appTypes';

const METRIC_COLORS = {
  sales: KPI_RECHARTS_COLORS.sales,
  purchases: KPI_RECHARTS_COLORS.purchases,
  expenses: KPI_RECHARTS_COLORS.expenses,
  netProfit: KPI_RECHARTS_COLORS.netProfit,
};

type MetricFilterKey = 'sales' | 'purchases' | 'expenses';

type DailySalesQueryShape = {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
};

function ChartTooltip({
  active,
  payload,
  label,
  companyList,
  lang,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{
    dataKey?: string | number;
    name?: string;
    value?: number;
    color?: string;
  }> | undefined;
  label?: string | number;
  companyList: CompanyListItem[];
  lang: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: 'var(--noorix-bg-surface)',
        border: '1px solid var(--noorix-border)',
        borderRadius: 6,
        padding: '8px 12px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        fontSize: 12,
        minWidth: 140,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 5, color: 'var(--noorix-text)', fontSize: 11 }}>
        {label != null ? String(label) : ''}
      </div>
      {payload.map((p) => {
        const dataKey = String(p.dataKey ?? '');
        const company = companyList.find((c) => c.id === dataKey);
        const name = company
          ? lang === 'ar'
            ? company.nameAr || company.nameEn
            : company.nameEn || company.nameAr
          : p.name;
        return (
          <div
            key={dataKey}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              color: p.color,
              fontWeight: 600,
              marginTop: 2,
            }}
          >
            <span>{name}</span>
            <span style={{ fontFamily: 'var(--noorix-font-numbers)' }}>
              {formatMoney(p.value, lang)} <span className="nx-sar">SR</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function queryErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return '';
}

type OwnerPerformanceChartProps = {
  chartGrain: string;
  setChartGrain: (g: 'monthly' | 'daily' | string) => void;
  metricFilter: Set<string>;
  setMetricFilter: React.Dispatch<React.SetStateAction<Set<string>>>;
  toggleMetric: (key: string) => void;
  performanceData: OwnerChartPoint[];
  companySeries: OwnerCompanySeries[];
  companyList: CompanyListItem[];
  dailySalesQuery: DailySalesQueryShape;
  chartSubtitle: string;
};

export function OwnerPerformanceChart({
  chartGrain,
  setChartGrain,
  metricFilter,
  setMetricFilter,
  toggleMetric,
  performanceData,
  companySeries,
  companyList,
  dailySalesQuery,
  chartSubtitle,
}: OwnerPerformanceChartProps) {
  const { t, lang } = useTranslation();
  const uiDir = useUiDir();
  const isMobile = useIsNarrow700();

  const METRIC_FILTERS: { key: MetricFilterKey; label: string }[] = [
    { key: 'sales', label: t('annualSales') },
    { key: 'purchases', label: t('annualPurchases') },
    { key: 'expenses', label: t('annualExpenses') },
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
          metricFilter={metricFilter}
          setMetricFilter={setMetricFilter}
          toggleMetric={toggleMetric}
          METRIC_FILTERS={METRIC_FILTERS}
          uiDir={uiDir}
          lang={lang}
        />
      </div>

      {chartGrain === 'daily' && dailySalesQuery.isLoading && (
        <div className="text-center text-noorix-muted py-12">{t('loading')}</div>
      )}
      {chartGrain === 'daily' && dailySalesQuery.isError && (
        <div className="rounded-lg border border-noorix-border bg-noorix-bg-muted px-4 py-3 text-[13px] text-noorix-red">
          {queryErrorMessage(dailySalesQuery.error) || t('loadingError')}
        </div>
      )}

      {!(chartGrain === 'daily' && (dailySalesQuery.isLoading || dailySalesQuery.isError)) && (
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
              tickFormatter={(n: number) => formatCompactNumber(n, lang)}
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
                  companyList={companyList}
                  lang={lang}
                />
              )}
            />
            {companySeries.map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                fill={s.color}
                fillOpacity={0.9}
                radius={[4, 4, 0, 0]}
                maxBarSize={chartGrain === 'monthly' ? 28 : 12}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}

      <div className="flex flex-wrap gap-4 mt-4 border-t border-noorix-border pt-3">
        {companySeries.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
            <span className="text-[12px]">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

type ChartControlsProps = {
  chartGrain: string;
  setChartGrain: (g: string) => void;
  metricFilter: Set<string>;
  setMetricFilter: React.Dispatch<React.SetStateAction<Set<string>>>;
  toggleMetric: (key: string) => void;
  METRIC_FILTERS: { key: MetricFilterKey; label: string }[];
  uiDir: string;
  lang: string;
};

function ChartControls({
  chartGrain,
  setChartGrain,
  metricFilter,
  setMetricFilter,
  toggleMetric,
  METRIC_FILTERS,
  uiDir,
  lang,
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
          data-active={chartGrain === 'monthly' ? 'true' : 'false'}
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
          data-active={chartGrain === 'daily' ? 'true' : 'false'}
          onClick={() => setChartGrain('daily')}
        >
          {t('dashboardTimelineDaily')}
        </Button>
      </div>

      {chartGrain === 'monthly' && (() => {
        const allKeys = METRIC_FILTERS.map((f) => f.key);
        const isAllActive = allKeys.every((k) => metricFilter.has(k));
        return (
          <Button
            type="button"
            variant="raw"
            size="auto"
            onClick={() => setMetricFilter(isAllActive ? new Set(['sales']) : new Set(allKeys))}
            style={{
              borderColor: isAllActive ? 'var(--noorix-text)' : 'var(--noorix-border)',
              color: isAllActive ? 'var(--noorix-text)' : 'var(--noorix-text-muted)',
              background: isAllActive ? 'var(--noorix-bg-muted)' : 'transparent',
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded border transition-all duration-150 select-none cursor-pointer"
          >
            {lang === 'ar' ? 'الكل' : 'All'}
          </Button>
        );
      })()}
      {METRIC_FILTERS.map((f) => {
        const disabled = chartGrain === 'daily' && f.key !== 'sales';
        const active = !disabled && metricFilter.has(f.key);
        return (
          <Button
            type="button"
            variant="raw"
            size="auto"
            key={f.key}
            onClick={() => !disabled && toggleMetric(f.key)}
            style={{
              borderColor: active ? METRIC_COLORS[f.key] : 'var(--noorix-border)',
              color: active
                ? METRIC_COLORS[f.key]
                : disabled
                  ? 'var(--noorix-border)'
                  : 'var(--noorix-text-muted)',
              background: active ? `${METRIC_COLORS[f.key]}14` : 'transparent',
              opacity: disabled ? 0.35 : 1,
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded border transition-all duration-150 select-none"
          >
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ background: active ? METRIC_COLORS[f.key] : 'var(--noorix-border)' }}
            />
            {f.label}
          </Button>
        );
      })}
    </div>
  );
}
