import React from 'react';
import { useTranslation } from '../../../../i18n/useTranslation';
import { amountText } from '../../../Reports/reportHelpers';
import { FmtNum, MetricCard } from '../../../../ui';
import { cn } from '../../../../ui/cn';
import { KPI_CARD_SPARKLINE_COLORS } from '../../../../constants/kpiCardTheme';
import {
  getCardValue,
  getPctStringForCard,
  type PlReportLike,
} from '../utils/dashboardOverviewCalculations';
import type { DashboardOverviewFilter } from '../types';
import type { KpiInsightFooterMap } from '../utils/dashboardOverviewKpiInsightFooters';
import { DashboardOverviewKpiCardFooter } from './DashboardOverviewKpiCardFooter';
import { formatPercentLabel } from '../../../../shared/reporting/plDisplaySelectors';
import {
  formatSalesShiftSharePercent,
  salesShiftPeriodGrandTotal,
  salesShiftSharePercent,
  type SalesShiftPeriodTotals,
} from '../utils/dashboardSalesShiftTotals';

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
  salesShiftPeriodTotals: SalesShiftPeriodTotals | null;
  kpiInsightFooters: KpiInsightFooterMap;
};

function RevenueShiftSummary({
  totals,
  t,
}: {
  totals: SalesShiftPeriodTotals | null;
  t: (key: string) => string;
}) {
  if (!totals) return null;

  const grandTotal = salesShiftPeriodGrandTotal(totals);
  const rows = [
    { key: 'morning' as const, label: t('salesShiftMorning'), value: totals.morning },
    { key: 'evening' as const, label: t('salesShiftEvening'), value: totals.evening },
  ].filter((row) => row.value.amount > 0);

  if (rows.length === 0) return null;

  return (
    <MetricCard.Section className="mt-1 px-4 pb-1">
      <div className="rounded-lg border border-noorix-border bg-noorix-bg-muted/25 px-2.5 py-2">
        <div className="mb-1.5 text-[10px] font-semibold text-noorix-muted">
          {t('dashboardSalesByShift')}
        </div>
        <div className="flex flex-col divide-y divide-noorix-border/80">
          {rows.map((row) => {
            const pct = salesShiftSharePercent(row.value.amount, grandTotal);
            return (
              <div key={row.key} className="flex items-center justify-between gap-2 py-1.5">
                <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-noorix-muted">
                  {row.label}
                </span>
                <span dir="ltr" className="shrink-0 text-[11px] font-bold text-nx-sales nx-font-numbers">
                  <FmtNum n={row.value.amount} /> <span className="nx-sar text-[8px]">SR</span>
                </span>
                <span dir="ltr" className="w-10 shrink-0 text-end text-[10px] font-bold text-noorix-blue nx-font-numbers">
                  {pct != null ? `${formatSalesShiftSharePercent(pct)}%` : '0%'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </MetricCard.Section>
  );
}

export function DashboardOverviewKpis({
  report,
  selectedMonth,
  cards,
  filter,
  year,
  salesShiftPeriodTotals,
  kpiInsightFooters,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className="nx-kpi-container">
      <div className="nx-kpi-grid nx-kpi-grid--dashboard">
        {cards.map((card) => {
          const rawVal = getCardValue(report, card.key, selectedMonth);
          const isProfit = card.key === 'netProfit';
          const isSales = card.key === 'sales';
          const pct = getPctStringForCard(report, card.key, selectedMonth);
          const pctNum = pct != null ? Number(pct) : null;

          const sparkColors = KPI_CARD_SPARKLINE_COLORS as Record<string, string>;
          const accentColor = sparkColors[card.key] || sparkColors.sales;

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
          const pctText = pctNum != null ? formatPercentLabel(pctNum) : null;
          const pctTitle = pctText != null ? `${pctLabelText}: ${arrow}${pctText}` : pctLabelText;

          const insightBundle =
            card.key === 'purchases' ||
            card.key === 'expenses' ||
            card.key === 'netProfit'
              ? kpiInsightFooters[card.key as 'purchases' | 'expenses' | 'netProfit']
              : undefined;

          const footerRows = insightBundle?.rows;
          const pctFallback = !isSales || !footerRows?.length ? (
            <div className="flex items-center justify-between gap-3 py-0.5 min-h-[28px]">
              <span className="min-w-0 flex-1 text-[10px] leading-snug text-noorix-muted text-start truncate">
                {pctLabelText}
              </span>
              {pctNum != null ? (
                <span
                  className={cn(
                    'inline-flex shrink-0 max-w-[55%] items-center justify-end truncate rounded px-2 py-0.5',
                    'text-[11px] font-bold nx-font-numbers ltr',
                    badgeClass,
                  )}
                  title={pctTitle}
                >
                  {arrow}{pctText}
                </span>
              ) : (
                <span className="shrink-0 text-[11px] font-medium text-noorix-muted">—</span>
              )}
            </div>
          ) : null;

          return (
            <MetricCard
              key={card.key}
              color={accentColor}
              className="flex h-full min-h-0 flex-col"
            >
              <MetricCard.Header
                label={card.label}
                subLabel={isSales ? undefined : t(card.formulaKey)}
              />
              <MetricCard.Value value={amountText(rawVal)} currency="SR" className="pb-1" />

              {isSales ? (
                <RevenueShiftSummary totals={salesShiftPeriodTotals} t={t} />
              ) : null}

              <DashboardOverviewKpiCardFooter
                periodLabel={periodLabel}
                rows={!isSales ? footerRows : undefined}
                fallback={isSales ? null : pctFallback}
              />
            </MetricCard>
          );
        })}
      </div>
    </div>
  );
}
