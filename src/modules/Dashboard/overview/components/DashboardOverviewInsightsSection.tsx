/**
 * قسم رؤى لوحة التحكم — قراءة فقط، لا يؤثر على KPI أو الرسوم البيانية.
 */
import React from 'react';
import Card from '../../../../ui/Card';
import Badge from '../../../../ui/Badge';
import Spinner from '../../../../ui/Spinner';
import type { DashboardInsightsUi } from '../types/dashboardInsightsDisplay';

type TFn = (key: string) => string;

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

type Props = {
  lang: string;
  insightsUi: DashboardInsightsUi;
  t: TFn;
};

export function DashboardOverviewInsightsSection({ lang, insightsUi, t }: Props) {
  const isAr = lang === 'ar';
  if (!insightsUi.show) return null;

  const title = t('dashboardInsightsSectionTitle');

  if (insightsUi.state === 'loading') {
    return (
      <section className="min-w-0" aria-busy="true" aria-label={title}>
        <Card padding="sm" className="border border-noorix-border/80 bg-noorix-bg-muted/30">
          <div className="flex flex-wrap items-center gap-3 px-1 py-1">
            <h2 className="text-[13px] font-bold text-noorix-text shrink-0">{title}</h2>
            <Spinner size="sm" color="muted" label={t('dashboardInsightsLoadingHint')} />
          </div>
        </Card>
      </section>
    );
  }

  const { items } = insightsUi;
  if (items.length === 0) return null;

  return (
    <section className="min-w-0" aria-label={title}>
      <Card padding="sm" className="border border-noorix-border/80">
        <h2 className="text-[13px] font-bold text-noorix-text mb-3">{title}</h2>
        <ul className="flex flex-col gap-2.5 list-none p-0 m-0">
          {items.map((item) => {
            const headline = isAr ? item.titleAr : item.titleEn;
            const detail = isAr ? item.detailAr : item.detailEn;
            const basisText = metricBasisLabel(item.metricBasis, t);
            return (
              <li
                key={item.id}
                className="rounded-lg border border-noorix-border/70 bg-noorix-bg-muted/25 px-3 py-2.5 text-[13px] leading-snug"
              >
                <div className="flex flex-wrap items-start gap-2 mb-1">
                  <Badge color={severityBadgeColor(item.severity)} size="sm">
                    {severityLabel(item.severity, t)}
                  </Badge>
                  {basisText ? (
                    <Badge color="gray" size="sm">
                      {basisText}
                    </Badge>
                  ) : null}
                </div>
                <p className="font-semibold text-noorix-text">{headline}</p>
                {detail ? <p className="text-noorix-muted mt-1 whitespace-pre-wrap">{detail}</p> : null}
              </li>
            );
          })}
        </ul>
      </Card>
    </section>
  );
}
