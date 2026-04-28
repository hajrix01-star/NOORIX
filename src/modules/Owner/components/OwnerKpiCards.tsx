import React from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { MetricCard } from '../../../ui';
import { KPI_CARD_SPARKLINE_COLORS } from '../../../constants/kpiCardTheme';
import { EN_MONTHS } from '../../Reports/reportHelpers';
import type { OwnerKpiTotals, OwnerMonthlyBucket } from '../types';

type CardKey = 'sales' | 'purchases' | 'expenses' | 'netProfit';

type OwnerKpiCardsProps = {
  aggregated: OwnerKpiTotals;
  aggregatedMonthly: OwnerMonthlyBucket[];
  year: number;
  selectedMonthNum: number | null;
};

export function OwnerKpiCards({ aggregated, aggregatedMonthly, year, selectedMonthNum }: OwnerKpiCardsProps) {
  const { t } = useTranslation();
  const cards: { key: CardKey; label: string; value: number }[] = [
    { key: 'sales', label: t('ownerTotalSales'), value: aggregated.totalSales },
    { key: 'purchases', label: t('annualPurchases'), value: aggregated.totalPurchases },
    { key: 'expenses', label: t('annualExpenses'), value: aggregated.totalExpenses },
    { key: 'netProfit', label: t('ownerTotalNetProfit'), value: aggregated.totalNetProfit },
  ];

  return (
    <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
      {cards.map((card) => {
        const pctNum =
          card.key !== 'sales' && aggregated.totalSales > 0
            ? Number(((card.value / aggregated.totalSales) * 100).toFixed(1))
            : null;
        const isProfit = card.key === 'netProfit';
        const badgeClass =
          isProfit && pctNum != null
            ? pctNum >= 0
              ? 'bg-[#eaf3de] text-[#3B6D11]'
              : 'bg-[#FCEBEB] text-[#A32D2D]'
            : 'bg-noorix-bg-muted text-noorix-muted';
        const arrow = isProfit && pctNum != null ? (pctNum >= 0 ? '↑ ' : '↓ ') : '';
        const kpiSpark = KPI_CARD_SPARKLINE_COLORS as Record<string, string>;
        const accentColor = kpiSpark[card.key] || kpiSpark.sales;
        return (
          <MetricCard key={card.key} color={accentColor} className="min-h-[168px]">
            <MetricCard.Header label={card.label} />
            <MetricCard.Value value={card.value} currency="SR" />
            <MetricCard.Spark data={aggregatedMonthly.map((m) => m[card.key])} color={accentColor} grow />
            <MetricCard.Footer className="mt-3 border-t border-noorix-border pt-3 pb-3">
              <span className="min-w-0 truncate text-[11px] font-medium text-noorix-muted">
                {year}
                {selectedMonthNum ? ` — ${EN_MONTHS[selectedMonthNum - 1]}` : ''}
              </span>
              {pctNum != null ? (
                <span
                  className={`inline-flex max-w-[min(100%,140px)] shrink-0 items-center truncate rounded px-2 py-0.5 text-[11px] font-bold ${badgeClass}`}
                >
                  {arrow}
                  {Math.abs(pctNum)}%
                </span>
              ) : (
                <span className="text-[11px] font-medium text-noorix-muted">100%</span>
              )}
            </MetricCard.Footer>
          </MetricCard>
        );
      })}
    </div>
  );
}
