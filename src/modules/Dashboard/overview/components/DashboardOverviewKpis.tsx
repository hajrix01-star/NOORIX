import React from 'react';
import { useTranslation } from '../../../../i18n/useTranslation';
import { amountText } from '../../../Reports/reportHelpers';
import { FmtNum, MetricCard } from '../../../../ui';
import { cn } from '../../../../ui/cn';
import { KPI_CARD_SPARKLINE_COLORS } from '../../../../constants/kpiCardTheme';
import type {
  DashboardKpiCardMetric,
} from '../../../../types/api/domains/dashboard';
import type { DashboardOverviewFilter } from '../types';
import type { KpiFooterRow } from '../utils/dashboardOverviewKpiInsightFooters';
import { kpiFooterRowColorClass } from '../utils/dashboardOverviewKpiInsightFooters';
import { DashboardOverviewRevenueDailyAvgPanel } from './DashboardOverviewRevenueDailyAvgPanel';

type MetricKey = 'sales' | 'purchases' | 'expenses' | 'outflow' | 'grossProfit' | 'netProfit';

type Props = {
  kpiCardsByKey: Map<string, DashboardKpiCardMetric>;
  filter: DashboardOverviewFilter | undefined;
  year: number;
  revenueDailyAvgCalendar: number | null;
  revenueDailyAvgPrevMonthCalendar: number | null;
  customerDailyAvgCalendar: number | null;
  customerDailyAvgPrevMonthCalendar: number | null;
  basketAvgCalendar: number | null;
  basketAvgPrevMonthCalendar: number | null;
  basketAvgDeltaPct: number | null;
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
    <MetricCard.Footer className="mt-auto border-t border-noorix-border py-3.5">
      <span className="text-[11px] font-medium text-noorix-muted">{label}</span>
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
        'inline-flex items-baseline justify-center gap-1 text-[16px] font-extrabold nx-font-numbers',
        tone === 'profit' && value >= 0 ? 'text-noorix-green' : null,
        tone === 'profit' && value < 0 ? 'text-[color:var(--noorix-accent-red)]' : null,
        tone === 'cost' ? 'text-noorix-text' : null,
      )}
    >
      <FmtNum n={value} />
      <span className="nx-sar text-[12px]">SR</span>
    </span>
  );
}

function RatioValue({ row }: { row: KpiFooterRow | null | undefined }) {
  if (!row) return <span className="text-[12px] font-medium text-noorix-muted">-</span>;
  return (
    <span
      className={cn(
        'text-[12px] font-extrabold leading-tight nx-font-numbers ltr',
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
    <MetricCard.Section className="mt-4 px-4">
      <div className="overflow-hidden rounded-xl border border-noorix-border bg-noorix-bg-muted/25">
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(7rem,auto)_minmax(5rem,auto)] border-b border-noorix-border px-4 py-2.5 text-center text-[13px] font-bold text-noorix-muted">
          <span className="text-start">{itemLabel}</span>
          <span>{'SR'}</span>
          <span>{'%'}</span>
        </div>
        <div className="divide-y divide-noorix-border/80">
          {rows.map((row) => (
            <div
              key={row.key}
              className="grid grid-cols-[minmax(0,1fr)_minmax(7rem,auto)_minmax(5rem,auto)] items-center gap-3 px-4 py-2.5 text-center"
            >
              <span className="min-w-0 truncate text-start text-[14px] font-semibold text-noorix-muted">
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

export function DashboardOverviewKpis({
  kpiCardsByKey,
  filter,
  year,
  revenueDailyAvgCalendar,
  revenueDailyAvgPrevMonthCalendar,
  customerDailyAvgCalendar,
  customerDailyAvgPrevMonthCalendar,
  basketAvgCalendar,
  basketAvgPrevMonthCalendar,
  basketAvgDeltaPct,
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
  const directRatio = (metric: DashboardKpiCardMetric | undefined): KpiFooterRow | null => (
    metric?.pct == null ? null : {
      label: t('dashboardKpiFooterRatioToSales'),
      value: `${metric.pct.toFixed(1)}%`,
      color: 'muted',
    }
  );
  const purchasesRatio = directRatio(purchases);
  const expensesRatio = directRatio(expenses);
  const grossProfitRatio = directRatio(grossProfit);
  const netProfitRatio = directRatio(netProfit);

  return (
    <div className="nx-kpi-container">
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <MetricCard color={metricColor('sales')} className="flex min-h-[300px] flex-col">
          <MetricCard.Header
            label={t('revenueGroup')}
            subLabel={t('reportAmountBasisGrossShort')}
          />
          <MetricCard.Value
            value={amountText(sales?.value ?? 0)}
            currency="SR"
            size="executive"
            className="pt-5 pb-2"
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
          <FooterPeriod label={periodLabel} />
        </MetricCard>

        <MetricCard color={metricColor('expenses')} className="flex min-h-[300px] flex-col">
          <MetricCard.Header
            label={t('dashboardOperatingCostKpiTitle')}
            subLabel={t('dashboardOperatingCostKpiDesc')}
          />
          <MetricCard.Value
            value={amountText(outflow.value)}
            currency="SR"
            color="var(--noorix-accent-red)"
            size="executive"
            className="pt-5 pb-2"
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
                label: t('dashboardRecurringAndOtherExpenses'),
                metric: expenses,
                ratio: expensesRatio,
              },
            ]}
          />
          <FooterPeriod label={periodLabel} />
        </MetricCard>

        <MetricCard color={metricColor('netProfit')} className="flex min-h-[300px] flex-col">
          <MetricCard.Header
            label={t('dashboardOperatingResultTitle')}
            subLabel={t('dashboardOperatingResultDesc')}
          />
          <MetricCard.Value
            value={amountText(netProfit?.value ?? 0)}
            currency="SR"
            color={mainValueColor(netProfit, 'netProfit')}
            size="executive"
            className="pt-5 pb-2"
          />
          <ExecutiveRows
            itemLabel={t('reportItem')}
            tone="profit"
            rows={[
              {
                key: 'grossProfit',
                label: t('dashboardGrossAfterPurchases'),
                metric: grossProfit,
                ratio: grossProfitRatio,
              },
              {
                key: 'netProfit',
                label: t('dashboardOperatingResultTitle'),
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
