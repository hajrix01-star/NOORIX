import React from 'react';
import { useTranslation } from '../../../../i18n/useTranslation';
import { amountText } from '../../../Reports/reportHelpers';
import { FmtNum, MetricCard } from '../../../../ui';
import { cn } from '../../../../ui/cn';
import { KPI_CARD_SPARKLINE_COLORS } from '../../../../constants/kpiCardTheme';
import type { DashboardKpiCardMetric } from '../../../../types/api/domains/dashboard';
import type { DashboardOverviewFilter } from '../types';
import type { KpiInsightFooterMap } from '../utils/dashboardOverviewKpiInsightFooters';
import { DashboardOverviewKpiCardFooter } from './DashboardOverviewKpiCardFooter';
import { formatPercentLabel } from '../../../../shared/reporting/plDisplaySelectors';
import {
  formatSalesShiftSharePercent,
} from '../utils/dashboardSalesShiftTotals';
import type { DashboardSalesShiftTotals } from '../../../../types/api/domains/dashboard';
import { DashboardOverviewRevenueDailyAvgPanel } from './DashboardOverviewRevenueDailyAvgPanel';

type CardDef = {
  key: string;
  label: string;
  formulaKey: string;
  pctLabelKey: string;
};

type Props = {
  cards: CardDef[];
  kpiCardsByKey: Map<string, DashboardKpiCardMetric>;
  filter: DashboardOverviewFilter | undefined;
  year: number;
  salesShiftPeriodTotals: DashboardSalesShiftTotals | null;
  revenueDailyAvgCalendar: number | null;
  revenueDailyAvgPrevMonthCalendar: number | null;
  customerDailyAvgCalendar: number | null;
  customerDailyAvgPrevMonthCalendar: number | null;
  kpiInsightFooters: KpiInsightFooterMap;
};

function kpiSparklineColor(key: string): string {
  if (key === 'sales') return KPI_CARD_SPARKLINE_COLORS.sales;
  if (key === 'grossProfit') return KPI_CARD_SPARKLINE_COLORS.grossProfit;
  if (key === 'netProfit') return KPI_CARD_SPARKLINE_COLORS.netProfit;
  if (key === 'purchases') return KPI_CARD_SPARKLINE_COLORS.purchases;
  if (key === 'expenses') return KPI_CARD_SPARKLINE_COLORS.expenses;
  return KPI_CARD_SPARKLINE_COLORS.sales;
}

function badgeClassForTone(tone: DashboardKpiCardMetric['tone'] | undefined): string {
  if (tone === 'positive') return 'bg-[#eaf3de] text-[#3B6D11]';
  if (tone === 'negative') return 'bg-[#FCEBEB] text-[#A32D2D]';
  if (tone === 'cost') return 'bg-[#fff7ed] text-[#9a3412]';
  return 'bg-noorix-bg-muted text-noorix-muted';
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
    <MetricCard.Section className="mt-1 px-4 pb-1">
      <div className="rounded-lg border border-noorix-border bg-noorix-bg-muted/25 px-2.5 py-2">
        <div className="mb-1.5 text-[10px] font-semibold text-noorix-muted">
          {t('dashboardSalesByShift')}
        </div>
        <div className="flex flex-col divide-y divide-noorix-border/80">
          {rows.map((row) => {
            return (
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
            );
          })}
        </div>
      </div>
    </MetricCard.Section>
  );
}

export function DashboardOverviewKpis({
  cards,
  kpiCardsByKey,
  filter,
  year,
  salesShiftPeriodTotals,
  revenueDailyAvgCalendar,
  revenueDailyAvgPrevMonthCalendar,
  customerDailyAvgCalendar,
  customerDailyAvgPrevMonthCalendar,
  kpiInsightFooters,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className="nx-kpi-container">
      <div className="nx-kpi-grid nx-kpi-grid--dashboard">
        {cards.map((card) => {
          const metric = kpiCardsByKey.get(card.key);
          const rawVal = metric?.value ?? 0;
          const isSales = card.key === 'sales';
          const pctNum = metric?.pct ?? null;
          const pctText = pctNum != null ? formatPercentLabel(pctNum) : null;
          const pctLabelText = t(card.pctLabelKey);
          const pctTitle = pctText != null ? `${pctLabelText}: ${pctText}` : pctLabelText;
          const accentColor = kpiSparklineColor(card.key);
          const badgeClass = badgeClassForTone(metric?.tone);

          const insightBundle =
            card.key === 'purchases' ||
            card.key === 'expenses' ||
            card.key === 'grossProfit' ||
            card.key === 'netProfit'
              ? kpiInsightFooters[card.key as 'purchases' | 'expenses' | 'grossProfit' | 'netProfit']
              : undefined;

          const footerRows = insightBundle?.rows;
          const pctFallback = !isSales || !footerRows?.length ? (
            <div className="flex min-h-[28px] items-center justify-between gap-3 py-0.5">
              <span className="min-w-0 flex-1 truncate text-start text-[10px] leading-snug text-noorix-muted">
                {pctLabelText}
              </span>
              {pctText != null ? (
                <span
                  className={cn(
                    'inline-flex max-w-[55%] shrink-0 items-center justify-end truncate rounded px-2 py-0.5',
                    'text-[11px] font-bold nx-font-numbers ltr',
                    badgeClass,
                  )}
                  title={pctTitle}
                >
                  {pctText}
                </span>
              ) : (
                <span className="shrink-0 text-[11px] font-medium text-noorix-muted">-</span>
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
                subLabel={
                  isSales
                    ? t('reportAmountBasisGrossShort')
                    : `${t(card.formulaKey)} - ${t('reportAmountBasisGrossShort')}`
                }
              />
              <MetricCard.Value value={amountText(rawVal)} currency="SR" className="pb-1" />

              {isSales ? (
                <>
                  <DashboardOverviewRevenueDailyAvgPanel
                    revenueCurrent={revenueDailyAvgCalendar}
                    revenuePrev={revenueDailyAvgPrevMonthCalendar}
                    customerCurrent={customerDailyAvgCalendar}
                    customerPrev={customerDailyAvgPrevMonthCalendar}
                    t={t}
                  />
                  <RevenueShiftSummary totals={salesShiftPeriodTotals} t={t} />
                </>
              ) : null}

              <DashboardOverviewKpiCardFooter
                periodLabel={filter?.label || String(year)}
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
