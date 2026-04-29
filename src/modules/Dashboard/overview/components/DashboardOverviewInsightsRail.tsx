/**
 * شريط تنبيهات رفيع أعلى نظرة عامة — قراءة فقط من حمولة الرؤى الموجودة.
 */
import React from 'react';
import Badge from '../../../../ui/Badge';
import { cn } from '../../../../ui/cn';
import type { DashboardInsightsUi } from '../types/dashboardInsightsDisplay';

type TFn = (key: string) => string;

const RAIL_MAX = 3;

function severityBadgeColor(severity: 'info' | 'warning' | 'critical'): 'blue' | 'amber' | 'red' {
  if (severity === 'critical') return 'red';
  if (severity === 'warning') return 'amber';
  return 'blue';
}

function metricBasisLabel(basis: string, t: TFn): string {
  if (basis === 'accounting_pl') return t('dashboardInsightsBasisAccounting');
  if (basis === 'operational_sales') return t('dashboardInsightsBasisOperational');
  if (basis === 'invoice_period') return t('dashboardInsightsBasisInvoicePeriod');
  return '';
}

function severityLabel(severity: 'info' | 'warning' | 'critical', t: TFn): string {
  if (severity === 'critical') return t('dashboardInsightsSeverityCritical');
  if (severity === 'warning') return t('dashboardInsightsSeverityWarning');
  return t('dashboardInsightsSeverityInfo');
}

function chipBorderClass(severity: 'info' | 'warning' | 'critical'): string {
  if (severity === 'critical') return 'border-s-red-500/80';
  if (severity === 'warning') return 'border-s-amber-500/80';
  return 'border-s-blue-500/70';
}

type Props = {
  lang: string;
  insightsUi: DashboardInsightsUi;
  t: TFn;
};

export function DashboardOverviewInsightsRail({ lang, insightsUi, t }: Props) {
  const isAr = lang === 'ar';
  if (!insightsUi.show) return null;

  const railAria = t('dashboardInsightsSectionTitle');

  if (insightsUi.state === 'loading') {
    return (
      <section className="min-w-0" aria-busy="true" aria-label={railAria}>
        <div
          className="h-8 max-w-xs rounded-md bg-noorix-bg-muted/45"
          title={t('dashboardInsightsLoadingHint')}
        />
      </section>
    );
  }

  if (insightsUi.state === 'empty') {
    return (
      <section className="min-w-0" aria-label={railAria}>
        <div
          className="inline-flex max-w-full items-center rounded-full border border-noorix-border/55 bg-noorix-bg-muted/15 px-2.5 py-1 text-[11px] font-medium text-noorix-muted"
          role="status"
        >
          {t('dashboardInsightsEmptyTitle')}
        </div>
      </section>
    );
  }

  const { items } = insightsUi;
  const railItems = items.slice(0, RAIL_MAX);

  if (railItems.length === 0) return null;

  return (
    <section className="min-w-0" aria-label={railAria}>
      <ul
        className={cn(
          'm-0 flex list-none flex-nowrap gap-2 overflow-x-auto overscroll-x-contain p-0 pb-0.5 md:flex-wrap md:overflow-visible md:pb-0',
          '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        )}
      >
        {railItems.map((item) => {
          const headline = isAr ? item.titleAr : item.titleEn;
          const detail = isAr ? item.detailAr : item.detailEn;
          const basisText = metricBasisLabel(item.metricBasis, t);
          const tooltip = [headline, detail].filter(Boolean).join('\n\n');
          return (
            <li key={item.id} className="max-w-[min(100%,22rem)] shrink-0">
              <div
                title={tooltip || undefined}
                className={cn(
                  'flex min-h-8 items-center gap-1.5 rounded-full border border-y border-e border-noorix-border/65 bg-noorix-bg-muted/20 py-1 ps-2 pe-2',
                  'border-s-[3px]',
                  chipBorderClass(item.severity),
                )}
              >
                <Badge color={severityBadgeColor(item.severity)} size="sm" dot className="shrink-0">
                  {severityLabel(item.severity, t)}
                </Badge>
                <span className="truncate text-[12px] font-semibold leading-tight text-noorix-text">{headline}</span>
                {basisText ? (
                  <Badge color="gray" size="sm" className="hidden shrink-0 sm:inline-flex">
                    {basisText}
                  </Badge>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
