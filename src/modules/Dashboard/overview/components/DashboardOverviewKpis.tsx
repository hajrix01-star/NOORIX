import React from 'react';
import { useTranslation } from '../../../../i18n/useTranslation';
import { amountText } from '../../../Reports/reportHelpers';
import { FmtNum, MetricCard } from '../../../../ui';
import { cn } from '../../../../ui/cn';
import { KPI_CARD_SPARKLINE_COLORS } from '../../../../constants/kpiCardTheme';
import type {
  DashboardKpiCardMetric,
  DashboardSalesShiftTotals,
} from '../../../../types/api/domains/dashboard';
import type { DashboardOverviewFilter } from '../types';
import type {
  KpiFooterRow,
  KpiInsightFooterMap,
} from '../utils/dashboardOverviewKpiInsightFooters';
import { kpiFooterRowColorClass } from '../utils/dashboardOverviewKpiInsightFooters';
import {
  formatSalesShiftSharePercent,
} from '../utils/dashboardSalesShiftTotals';
import { DashboardOverviewRevenueDailyAvgPanel } from './DashboardOverviewRevenueDailyAvgPanel';

type MetricKey = 'sales' | 'purchases' | 'expenses' | 'outflow' | 'grossProfit' | 'netProfit';

type Props = {
  kpiCardsByKey: Map<string, DashboardKpiCardMetric>;
  filter: DashboardOverviewFilter | undefined;
  year: number;
  salesShiftPeriodTotals: DashboardSalesShiftTotals | null;
  revenueDailyAvgCalendar: number | null;
  revenueDailyAvgPrevMonthCalendar: number | null;
  customerDailyAvgCalendar: number | null;
  customerDailyAvgPrevMonthCalendar: number | null;
  basketAvgCalendar: number | null;
  basketAvgPrevMonthCalendar: number | null;
  basketAvgDeltaPct: number | null;
  kpiInsightFooters: KpiInsightFooterMap;
};

type ExecutiveRow = {
  key: string;
  label: string;
  metric: DashboardKpiCardMetric | undefined;
  ratio?: KpiFooterRow | null;
};

function metricColor(key: MetricKey): string {
  if (key === 'sales') return KPI_CARD_SPARKLINE_COLORS.sales;
  if (key === 'grossProfit') return KPI_CARD_SPARKLINE_COLORS.grossProfit;
  if (key === 'netProfit') return KPI_CARD_SPARKLINE_COLORS.netProfit;
  if (key === 'purchases') return KPI_CARD_SPARKLINE_COLORS.purchases;
  return KPI_CARD_SPARKLINE_COLORS.expenses;
}

function metricValue(metrics: Map<string, DashboardKpiCardMetric>, key: MetricKey): number {
  return metrics.get(key)?.value ?? 0;
}

function mainValueColor(metric: DashboardKpiCardMetric | undefined, key: MetricKey): string | undefined {
  if (!metric) return undefined;
  if (metric.tone === 'negative') return 'var(--noorix-accent-red)';
  if (key === 'netProfit' && metric.value < 0) return 'var(--noorix-accent-red)';
  if (key === 'grossProfit' || key === 'netProfit') return metricColor(key);
  return undefined;
}

function FooterPeriod({ label }: { label: string }) {
  return (
    <MetricCard.Footer className="mt-auto border-t border-noorix-border py-3">
      <span className="text-[10px] font-medium text-noorix-muted">{label}</span>
    </MetricCard.Footer>
  );
}

function AmountValue({
  metric,
  tone,
}: {
  metric: DashboardKpiCardMetric | undefined;
  tone?: 'default' | 'profit' | 'cost';
}) {
  const value = metric?.value ?? 0;
  return (
    <span
      dir="ltr"
      className={cn(
        'inline-flex items-baseline justify-center gap-1 text-[12px] font-bold nx-font-numbers',
        tone === 'profit' && value >= 0 ? 'text-noorix-green' : null,
        tone === 'profit' && value < 0 ? 'text-[color:var(--noorix-accent-red)]' : null,
        tone === 'cost' ? 'text-noorix-text' : null,
      )}
    >
      <FmtNum n={value} />
      <span className="nx-sar text-[9px]">SR</span>
    </span>
  );
}

function RatioValue({ row }: { row: KpiFooterRow | null | undefined }) {
  if (!row) return <span className="text-[11px] font-medium text-noorix-muted">-</span>;
  return (
    <span
      className={cn(
        'text-[11px] font-bold leading-tight nx-font-numbers ltr',
        kpiFooterRowColorClass(row.color),
      )}
      title={row.tooltip}
    >
      {row.value}
    </span>
  );
}

function ExecutiveRows({
  itemLabel,
  rows,
  tone,
}: {
  itemLabel: string;
  rows: ExecutiveRow[];
  tone?: 'profit' | 'cost';
}) {
  if (rows.length === 0) return null;
  return (
    <MetricCard.Section className="mt-3 px-4">
      <div className="overflow-hidden rounded-lg border border-noorix-border bg-noorix-bg-muted/25">
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(5.5rem,auto)_minmax(4.5rem,auto)] border-b border-noorix-border px-3 py-2 text-center text-[10px] font-semibold text-noorix-muted">
          <span className="text-start">{itemLabel}</span>
          <span>{'SR'}</span>
          <span>{'%'}</span>
        </div>
        <div className="divide-y divide-noorix-border/80">
          {rows.map((row) => (
            <div
              key={row.key}
              className="grid grid-cols-[minmax(0,1fr)_minmax(5.5rem,auto)_minmax(4.5rem,auto)] items-center gap-2 px-3 py-2 text-center"
            >
              <span className="min-w-0 truncate text-start text-[11px] font-semibold text-noorix-muted">
                {row.label}
              </span>
              <AmountValue metric={row.metric} tone={tone} />
              <RatioValue row={row.ratio} />
            </div>
          ))}
        </div>
      </div>
    </MetricCard.Section>
  );
}

function RevenueShiftSummary({
  totals,
  t,
}: {
  totals: DashboardSalesShiftTotals | null;
  t: (key: string) => string;
}) {
  if (!totals) return null;

  const rows = [
    { key: 'morning' as const, label: t('salesShiftMorning'), value: totals.morning },
    { key: 'evening' as const, label: t('salesShiftEvening'), value: totals.evening },
  ].filter((row) => row.value.amount > 0);

  if (rows.length === 0) return null;

  return (
    <MetricCard.Section className="mt-2 px-4 pb-1">
      <div className="rounded-lg border border-noorix-border bg-noorix-bg-muted/25 px-2.5 py-2">
        <div className="mb-1.5 text-[10px] font-semibold text-noorix-muted">
          {t('dashboardSalesByShift')}
        </div>
        <div className="flex flex-col divide-y divide-noorix-border/80">
          {rows.map((row) => (
            <div key={row.key} className="flex items-center justify-between gap-2 py-1.5">
              <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-noorix-muted">
                {row.label}
              </span>
              <span dir="ltr" className="shrink-0 text-[11px] font-bold text-nx-sales nx-font-numbers">
                <FmtNum n={row.value.amount} /> <span className="nx-sar text-[8px]">SR</span>
              </span>
              <span dir="ltr" className="w-10 shrink-0 text-end text-[10px] font-bold text-noorix-blue nx-font-numbers">
                {row.value.sharePct != null ? `${formatSalesShiftSharePercent(row.value.sharePct)}%` : '0%'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </MetricCard.Section>
  );
}

export function DashboardOverviewKpis({
  kpiCardsByKey,
  filter,
  year,
  salesShiftPeriodTotals,
  revenueDailyAvgCalendar,
  revenueDailyAvgPrevMonthCalendar,
  customerDailyAvgCalendar,
  customerDailyAvgPrevMonthCalendar,
  basketAvgCalendar,
  basketAvgPrevMonthCalendar,
  basketAvgDeltaPct,
  kpiInsightFooters,
}: Props) {
  const { t } = useTranslation();
  const periodLabel = filter?.label || String(year);
  const sales = kpiCardsByKey.get('sales');
  const purchases = kpiCardsByKey.get('purchases');
  const expenses = kpiCardsByKey.get('expenses');
  const outflow = kpiCardsByKey.get('outflow') ?? {
    key: 'outflow',
    pct: null,
    tone: 'cost' as const,
    value: metricValue(kpiCardsByKey, 'outflow'),
  };
  const grossProfit = kpiCardsByKey.get('grossProfit');
  const netProfit = kpiCardsByKey.get('netProfit');
  const purchasesRatio = kpiInsightFooters.purchases?.rows[0] ?? null;
  const expensesRatio = kpiInsightFooters.expenses?.rows[0] ?? null;
  const grossProfitRatio = kpiInsightFooters.grossProfit?.rows[0] ?? null;
  const netProfitRatio = kpiInsightFooters.netProfit?.rows[0] ?? null;

  return (
    <div className="nx-kpi-container">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <MetricCard color={metricColor('sales')} className="flex h-full min-h-0 flex-col">
          <MetricCard.Header
            label={t('revenueGroup')}
            subLabel={t('reportAmountBasisGrossShort')}
          />
          <MetricCard.Value
            value={amountText(sales?.value ?? 0)}
            currency="SR"
            className="pb-1"
          />
          <DashboardOverviewRevenueDailyAvgPanel
            revenueCurrent={revenueDailyAvgCalendar}
            revenuePrev={revenueDailyAvgPrevMonthCalendar}
            customerCurrent={customerDailyAvgCalendar}
            customerPrev={customerDailyAvgPrevMonthCalendar}
            basketCurrent={basketAvgCalendar}
            basketPrev={basketAvgPrevMonthCalendar}
            basketDeltaPct={basketAvgDeltaPct}
            t={t}
          />
          <RevenueShiftSummary totals={salesShiftPeriodTotals} t={t} />
          <FooterPeriod label={periodLabel} />
        </MetricCard>

        <MetricCard color={metricColor('expenses')} className="flex h-full min-h-0 flex-col">
          <MetricCard.Header
            label={`${t('purchasesGroup')} + ${t('expensesGroup')}`}
            subLabel={t('reportAmountBasisGrossShort')}
          />
          <MetricCard.Value
            value={amountText(outflow.value)}
            currency="SR"
            color="var(--noorix-accent-red)"
            className="pb-1"
          />
          <ExecutiveRows
            itemLabel={t('reportItem')}
            tone="cost"
            rows={[
              {
                key: 'purchases',
                label: t('purchasesGroup'),
                metric: purchases,
                ratio: purchasesRatio,
              },
              {
                key: 'expenses',
                label: t('expensesGroup'),
                metric: expenses,
                ratio: expensesRatio,
              },
            ]}
          />
          <FooterPeriod label={periodLabel} />
        </MetricCard>

        <MetricCard color={metricColor('netProfit')} className="flex h-full min-h-0 flex-col">
          <MetricCard.Header
            label={t('annualNetProfit')}
            subLabel={`${t('annualGrossProfit')} / ${t('annualNetProfit')}`}
          />
          <MetricCard.Value
            value={amountText(netProfit?.value ?? 0)}
            currency="SR"
            color={mainValueColor(netProfit, 'netProfit')}
            className="pb-1"
          />
          <ExecutiveRows
            itemLabel={t('reportItem')}
            tone="profit"
            rows={[
              {
                key: 'grossProfit',
                label: t('annualGrossProfit'),
                metric: grossProfit,
                ratio: grossProfitRatio,
              },
              {
                key: 'netProfit',
                label: t('annualNetProfit'),
                metric: netProfit,
                ratio: netProfitRatio,
              },
            ]}
          />
          <FooterPeriod label={periodLabel} />
        </MetricCard>
      </div>
    </div>
  );
}
