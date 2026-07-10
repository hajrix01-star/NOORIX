import React, { useMemo } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { MetricCard } from '../../../ui';
import { KPI_CARD_SPARKLINE_COLORS } from '../../../constants/kpiCardTheme';
import { EN_MONTHS } from '../../Reports/reportHelpers';
import { MONTH_NAMES_AR } from '../utils/ownerDashboardDisplay';
import type { OwnerOverviewKpi, OwnerOverviewMetric } from '../types';
import { formatPercentLabel } from '../../../shared/reporting/plDisplaySelectors';

type OwnerKpiCardsProps = {
  kpis: OwnerOverviewKpi[];
  year: number;
  selectedMonthNum: number | null;
};

const KPI_LABEL_KEYS: Record<OwnerOverviewMetric, string> = {
  sales: 'ownerTotalSales',
  purchases: 'annualPurchases',
  expenses: 'annualExpenses',
  netProfit: 'ownerTotalNetProfit',
};

const KPI_MONTH_LABEL_KEYS: Record<OwnerOverviewMetric, string> = {
  sales: 'revenueGroup',
  purchases: 'purchasesGroup',
  expenses: 'expensesGroup',
  netProfit: 'annualNetProfit',
};

const KPI_FOOTER_KEYS: Record<OwnerOverviewMetric, string> = {
  sales: 'dashboardKpiPctSales',
  purchases: 'purchasesToSalesRatio',
  expenses: 'expensesToSalesRatio',
  netProfit: 'dashboardKpiFooterNetProfitMarginLabel',
};

export function OwnerKpiCards({ kpis, selectedMonthNum }: OwnerKpiCardsProps) {
  const { t, lang } = useTranslation();

  const monthLabel =
    selectedMonthNum != null
      ? lang === 'ar'
        ? MONTH_NAMES_AR[selectedMonthNum - 1]
        : EN_MONTHS[selectedMonthNum - 1]
      : null;

  const cards = useMemo(
    () =>
      kpis.map((kpi) => ({
        ...kpi,
        label: monthLabel ? `${t(KPI_MONTH_LABEL_KEYS[kpi.key])} - ${monthLabel}` : t(KPI_LABEL_KEYS[kpi.key]),
        pctLabel: t(KPI_FOOTER_KEYS[kpi.key]),
      })),
    [kpis, monthLabel, t],
  );

  return (
    <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
      {cards.map((card) => {
        const isProfit = card.key === 'netProfit';
        const badgeClass =
          isProfit && card.percentOfSales != null
            ? card.percentOfSales >= 0
              ? 'bg-[#eaf3de] text-[#3B6D11]'
              : 'bg-[#FCEBEB] text-[#A32D2D]'
            : 'bg-noorix-bg-muted text-noorix-muted';
        const kpiSpark = KPI_CARD_SPARKLINE_COLORS as Record<string, string>;
        const accentColor = kpiSpark[card.key] || kpiSpark.sales;
        return (
          <MetricCard key={card.key} color={accentColor} className="min-h-[168px]">
            <MetricCard.Header label={card.label} />
            <MetricCard.Value value={card.total} currency="SR" />
            <MetricCard.Spark data={card.monthlyValues} color={accentColor} grow />
            <MetricCard.Footer className="mt-3 border-t border-noorix-border pt-3 pb-3">
              <span className="min-w-0 truncate text-[11px] font-medium text-noorix-muted">
                {card.pctLabel}
              </span>
              {card.percentOfSales != null ? (
                <span
                  className={`inline-flex max-w-[min(100%,140px)] shrink-0 items-center truncate rounded px-2 py-0.5 text-[11px] font-bold nx-font-numbers ltr ${badgeClass}`}
                >
                  {formatPercentLabel(card.percentOfSales)}
                </span>
              ) : card.key === 'sales' ? (
                <span className="text-[11px] font-medium text-noorix-muted">-</span>
              ) : null}
            </MetricCard.Footer>
          </MetricCard>
        );
      })}
    </div>
  );
}
