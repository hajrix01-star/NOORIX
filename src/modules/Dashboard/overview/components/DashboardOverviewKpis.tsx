import React from 'react';
import { useTranslation } from '../../../../i18n/useTranslation';
import { amountText } from '../../../Reports/reportHelpers';
import { FmtNum, MetricCard } from '../../../../ui';
import { KPI_CARD_SPARKLINE_COLORS } from '../../../../constants/kpiCardTheme';
import { cn } from '../../../../ui/cn';
import {
  getCardValue,
  getMonthlyData,
  getPctStringForCard,
  type PlReportLike,
} from '../utils/dashboardOverviewCalculations';
import type { DashboardOverviewFilter } from '../types';
import type { KpiInsightFooterMap } from '../utils/dashboardOverviewKpiInsightFooters';
import { severityFooterValueClass } from '../utils/dashboardOverviewKpiInsightFooters';

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
  kpiInsightFooters: KpiInsightFooterMap;
};

export function DashboardOverviewKpis({
  report,
  selectedMonth,
  cards,
  filter,
  year,
  revenueDailyAvgActiveDays,
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
            if (pctNum > 0) {
              badgeTone = 'positive';
              arrow = '↑ ';
            } else if (pctNum < 0) {
              badgeTone = 'negative';
              arrow = '↓ ';
            }
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

          return (
            <MetricCard key={card.key} color={accentColor} className="min-h-[188px]">
              <MetricCard.Header label={card.label} subLabel={t(card.formulaKey)} />
              {isSales && revenueDailyAvgActiveDays != null ? (
                <div className="px-4 mt-1">
                  <div className="flex w-full min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <div
                      dir="ltr"
                      className="nx-font-numbers inline-flex shrink-0 items-baseline gap-x-1 text-[22px] font-bold leading-tight tracking-[-0.5px] text-noorix-text"
                      style={{ fontFamily: 'var(--noorix-font-numbers)' }}
                    >
                      {amountText(rawVal)}
                      <span className="nx-sar">SR</span>
                    </div>
                    <div className="flex min-w-0 flex-wrap items-baseline justify-end gap-x-1.5 text-end">
                      <span className="text-[11px] text-noorix-muted">{t('dashboardSalesDailyAvgActiveDays')}</span>
                      <span className="text-[15px] font-semibold text-noorix-blue nx-font-numbers ltr whitespace-nowrap">
                        <FmtNum n={revenueDailyAvgActiveDays} /> <span className="nx-sar">SR</span>
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <MetricCard.Value value={amountText(rawVal)} currency="SR" />
              )}
              <MetricCard.Spark data={sparkData} color={accentColor} grow />
              <MetricCard.Footer className="mt-3 flex flex-col gap-1.5 border-t border-noorix-border pt-3 pb-3">
                <span className="min-w-0 truncate text-[11px] font-medium text-noorix-muted">{periodLabel}</span>

                {insightBundle?.lines?.length ? (
                  <div className="flex flex-col gap-1">
                    {/* When all lines are compact, the ratio row is absent — show pctNum badge first */}
                    {insightBundle.lines.every((l) => l.compact) && (
                      <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
                        <span className="min-w-0 max-w-[min(100%,calc(100%-3.5rem))] text-[10px] leading-snug text-noorix-muted">
                          {pctLabelText}
                        </span>
                        {pctNum != null ? (
                          <span
                            className={`inline-flex max-w-[min(100%,140px)] shrink-0 items-center truncate rounded px-2 py-0.5 text-[11px] font-bold ${badgeClass}`}
                            title={pctTitle}
                          >
                            {arrow}
                            {Math.abs(pctNum)}%
                          </span>
                        ) : (
                          <span className="shrink-0 text-[11px] font-medium text-noorix-muted">—</span>
                        )}
                      </div>
                    )}
                    {insightBundle.lines.map((line, idx) => {
                      const footerLabel =
                        idx === 0
                          ? insightBundle.footerLabelKey
                            ? t(insightBundle.footerLabelKey)
                            : pctLabelText
                          : '';
                      const valueCn = cn(
                        'inline-flex max-w-full items-center justify-end truncate rounded px-2 py-0.5 text-[11px] font-bold nx-font-numbers',
                        severityFooterValueClass(line.severity),
                        line.compact && 'text-[10px]',
                      );
                      if (line.compact) {
                        return (
                          <div key={`${card.key}-ins-${idx}`} className="flex justify-end">
                            <span className={valueCn} title={line.title}>
                              {line.text}
                            </span>
                          </div>
                        );
                      }
                      return (
                        <div
                          key={`${card.key}-ins-${idx}`}
                          className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1"
                        >
                          <span className="min-w-0 max-w-[min(100%,calc(100%-3.5rem))] text-[10px] leading-snug text-noorix-muted">
                            {footerLabel}
                          </span>
                          <span className={cn(valueCn, 'shrink-0')} title={line.title}>
                            {line.text}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
                    <span className="min-w-0 max-w-[min(100%,calc(100%-3.5rem))] text-[10px] leading-snug text-noorix-muted">
                      {pctLabelText}
                    </span>
                    {pctNum != null ? (
                      <span
                        className={`inline-flex max-w-[min(100%,140px)] shrink-0 items-center truncate rounded px-2 py-0.5 text-[11px] font-bold ${badgeClass}`}
                        title={pctTitle}
                      >
                        {arrow}
                        {Math.abs(pctNum)}%
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
