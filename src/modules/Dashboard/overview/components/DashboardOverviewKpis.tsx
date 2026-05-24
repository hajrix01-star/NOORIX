import React from 'react';
import { useTranslation } from '../../../../i18n/useTranslation';
import { amountText } from '../../../Reports/reportHelpers';
import { MetricCard } from '../../../../ui';
import { KPI_CARD_SPARKLINE_COLORS } from '../../../../constants/kpiCardTheme';
import {
  getCardValue,
  getMonthlyData,
  getPctStringForCard,
  type PlReportLike,
} from '../utils/dashboardOverviewCalculations';
import type { DashboardOverviewFilter } from '../types';
import type { KpiInsightFooterMap } from '../utils/dashboardOverviewKpiInsightFooters';
import { kpiFooterRowColorClass } from '../utils/dashboardOverviewKpiInsightFooters';
import { DashboardOverviewRevenueDailyAvgPanel } from './DashboardOverviewRevenueDailyAvgPanel';

type CardDef = {
  key: string;
  label: string;
  formulaKey: string;
  pctLabelKey: string;
};

type Props = {
  report: PlReportLike | null | undefined;
  selectedMonth: number | null;
  cards: CardDef[];
  filter: DashboardOverviewFilter | undefined;
  year: number;
  revenueDailyAvgActiveDays: number | null;
  revenueDailyAvgPrevMonthActiveDays: number | null;
  customerDailyAvgActiveDays: number | null;
  customerDailyAvgPrevMonthActiveDays: number | null;
  kpiInsightFooters: KpiInsightFooterMap;
};

export function DashboardOverviewKpis({
  report,
  selectedMonth,
  cards,
  filter,
  year,
  revenueDailyAvgActiveDays,
  revenueDailyAvgPrevMonthActiveDays,
  customerDailyAvgActiveDays,
  customerDailyAvgPrevMonthActiveDays,
  kpiInsightFooters,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className="nx-kpi-container">
      <div className="nx-kpi-grid">
        {cards.map((card) => {
          const rawVal = getCardValue(report, card.key, selectedMonth);
          const isProfit = card.key === 'grossProfit' || card.key === 'netProfit';
          const isSales = card.key === 'sales';
          const pct = getPctStringForCard(report, card.key, selectedMonth);
          const pctNum = pct != null ? Number(pct) : null;

          const sparkColors = KPI_CARD_SPARKLINE_COLORS as Record<string, string>;
          const accentColor = sparkColors[card.key] || sparkColors.sales;
          const sparkData = getMonthlyData(report, card.key);

          let badgeTone = 'neutral';
          let arrow = '';
          if (isSales && pctNum != null) {
            badgeTone = 'neutral';
            arrow = '';
          } else if (isProfit && pctNum != null) {
            if (pctNum > 0) { badgeTone = 'positive'; arrow = '↑ '; }
            else if (pctNum < 0) { badgeTone = 'negative'; arrow = '↓ '; }
          } else if (!isSales && pctNum != null) {
            badgeTone = 'zero';
            arrow = '↓ ';
          }

          const badgeClass =
            badgeTone === 'positive'
              ? 'bg-[#eaf3de] text-[#3B6D11]'
              : badgeTone === 'negative'
                ? 'bg-[#FCEBEB] text-[#A32D2D]'
                : 'bg-noorix-bg-muted text-noorix-muted';

          const periodLabel = filter?.label || String(year);
          const pctLabelText = t(card.pctLabelKey);
          const pctTitle = pctNum != null ? `${pctLabelText}: ${arrow}${Math.abs(pctNum)}%` : pctLabelText;

          const insightBundle =
            card.key === 'purchases' ||
            card.key === 'expenses' ||
            card.key === 'grossProfit' ||
            card.key === 'netProfit'
              ? kpiInsightFooters[card.key as 'purchases' | 'expenses' | 'grossProfit' | 'netProfit']
              : undefined;

          const hasRows = (insightBundle?.rows?.length ?? 0) > 0;

          return (
            <MetricCard key={card.key} color={accentColor} className="min-h-[188px]">
              <MetricCard.Header label={card.label} subLabel={t(card.formulaKey)} />
              {isSales && selectedMonth != null ? (
                <>
                  <MetricCard.Value value={amountText(rawVal)} currency="SR" />
                  <DashboardOverviewRevenueDailyAvgPanel
                    revenueCurrent={revenueDailyAvgActiveDays}
                    revenuePrev={revenueDailyAvgPrevMonthActiveDays}
                    customerCurrent={customerDailyAvgActiveDays}
                    customerPrev={customerDailyAvgPrevMonthActiveDays}
                    t={t}
                  />
                </>
              ) : (
                <MetricCard.Value value={amountText(rawVal)} currency="SR" />
              )}
              <MetricCard.Spark data={sparkData} color={accentColor} grow />

              <MetricCard.Footer className="mt-3 flex flex-col gap-1 border-t border-noorix-border pt-2 pb-2">
                <span className="text-[10px] font-medium text-noorix-muted">{periodLabel}</span>

                {hasRows ? (
                  /* ── جدول موحّد: نسبة + متوسط + تغيير ── */
                  <div className="flex flex-col divide-y divide-noorix-border mt-0.5">
                    {insightBundle!.rows.map((row, idx) => (
                      <div
                        key={`${card.key}-row-${idx}`}
                        className="flex items-center justify-between gap-2 py-[3px]"
                        title={row.tooltip}
                      >
                        <span className="text-[10px] text-noorix-muted truncate leading-snug">
                          {row.label}
                        </span>
                        <span
                          className={`shrink-0 text-[11px] font-bold nx-font-numbers ltr ${kpiFooterRowColorClass(row.color)}`}
                        >
                          {row.value}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* ── fallback: شارة النسبة العادية (للكروت بدون insights أو في الوضع السنوي) ── */
                  <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1 mt-0.5">
                    <span className="min-w-0 max-w-[min(100%,calc(100%-3.5rem))] text-[10px] leading-snug text-noorix-muted">
                      {pctLabelText}
                    </span>
                    {pctNum != null ? (
                      <span
                        className={`inline-flex max-w-[min(100%,140px)] shrink-0 items-center truncate rounded px-2 py-0.5 text-[11px] font-bold ${badgeClass}`}
                        title={pctTitle}
                      >
                        {arrow}{Math.abs(pctNum)}%
                      </span>
                    ) : (
                      <span className="shrink-0 text-[11px] font-medium text-noorix-muted">—</span>
                    )}
                  </div>
                )}
              </MetricCard.Footer>
            </MetricCard>
          );
        })}
      </div>
    </div>
  );
}
