/**
 * لوحة رؤى الاستوديو: صحة، نسب، تفصيل مبيعات (إن وُجد)، قوائم فرص/تنبيهات/رؤى.
 */
import React, { useMemo } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { Badge, cn, FmtNum } from '../../../ui';
import { amountText } from '../../Reports/reportHelpers';
import type { DashboardInsightsPayload } from '../../../services/reportingInsightsApi';

type Props = {
  payload: DashboardInsightsPayload | null | undefined;
  isLoading: boolean;
  isError: boolean;
  className?: string;
};

function severityBadgeColor(sev: string): 'red' | 'amber' | 'blue' {
  if (sev === 'critical') return 'red';
  if (sev === 'warning') return 'amber';
  return 'blue';
}

export function DashboardStudioInsightsPanel({ payload, isLoading, isError, className }: Props) {
  const { t, lang } = useTranslation();
  const isAr = lang === 'ar';

  const lists = useMemo(() => {
    if (!payload) return { opportunities: [] as unknown[], warnings: [] as unknown[], insights: [] as unknown[] };
    return {
      opportunities: Array.isArray(payload.opportunities) ? payload.opportunities : [],
      warnings: Array.isArray(payload.warnings) ? payload.warnings : [],
      insights: Array.isArray(payload.insights) ? payload.insights : [],
    };
  }, [payload]);

  const health = payload?.health as
    | { score?: number | null; band?: string; summaryAr?: string; summaryEn?: string }
    | undefined;
  const metrics = payload?.metrics as
    | {
        accounting?: Record<string, string | number | null | undefined>;
        operational?: { periodSalesFromSummaries?: number | null; activeSalesDaysInMonth?: number | null };
      }
    | undefined;
  const ratios = payload?.ratios as
    | { purchaseToSales?: number | null; expenseToSales?: number | null; netProfitMargin?: number | null }
    | undefined;
  const salesBreakdown = (payload as { salesBreakdown?: unknown[] } | null | undefined)?.salesBreakdown;

  const renderInsightLine = (raw: unknown, idx: number) => {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;
    const id = String(r.id ?? idx);
    const sev = String(r.severity ?? 'info');
    const title = isAr ? String(r.titleAr ?? r.id ?? '') : String(r.titleEn ?? r.id ?? '');
    const detail = isAr ? String(r.detailAr ?? '') : String(r.detailEn ?? '');
    return (
      <div
        key={id}
        className="rounded-lg border border-noorix-border bg-noorix-surface px-3 py-2.5 text-[12px] leading-snug"
      >
        <div className="flex flex-wrap items-start gap-2">
          <Badge color={severityBadgeColor(sev)} size="sm">
            {sev === 'critical'
              ? t('dashboardInsightsSeverityCritical')
              : sev === 'warning'
                ? t('dashboardInsightsSeverityWarning')
                : t('dashboardInsightsSeverityInfo')}
          </Badge>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-noorix-text">{title}</div>
            {detail.trim() ? <div className="mt-1 text-noorix-muted">{detail}</div> : null}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className="text-[14px] font-bold text-noorix-text">{t('dashboardStudioInsightsTitle')}</div>

      {isLoading && <div className="text-[13px] text-noorix-muted">{t('dashboardInsightsLoadingHint')}</div>}
      {isError && <div className="text-[13px] text-noorix-red">{t('loadDataFailed')}</div>}

      {!isLoading && !isError && payload && (
        <>
          {health && (health.summaryAr || health.summaryEn || health.score != null) ? (
            <div className="noorix-surface-card rounded-xl border border-noorix-border p-4">
              <div className="text-[12px] font-semibold text-noorix-muted">{t('dashboardStudioHealthTitle')}</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {health.score != null && Number.isFinite(Number(health.score)) ? (
                  <span className="text-[22px] font-bold text-noorix-text nx-font-numbers">{Number(health.score)}</span>
                ) : null}
                {health.band ? (
                  <Badge
                    color={health.band === 'green' ? 'green' : health.band === 'red' ? 'red' : 'amber'}
                    size="sm"
                  >
                    {health.band}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-2 text-[12px] text-noorix-muted m-0">
                {isAr ? health.summaryAr || health.summaryEn : health.summaryEn || health.summaryAr}
              </p>
            </div>
          ) : null}

          {metrics?.accounting ? (
            <div className="noorix-surface-card rounded-xl border border-noorix-border p-4">
              <div className="text-[12px] font-semibold text-noorix-muted mb-3">
                {t('dashboardStudioMetricsAccounting')}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {(['sales', 'purchases', 'expenses', 'grossProfit', 'netProfit'] as const).map((k) => {
                  const v = metrics.accounting?.[k];
                  const n = v != null && v !== '' ? Number(v) : NaN;
                  const label =
                    k === 'sales'
                      ? t('annualSales')
                      : k === 'purchases'
                        ? t('annualPurchases')
                        : k === 'expenses'
                          ? t('annualExpenses')
                          : k === 'grossProfit'
                            ? t('annualGrossProfit')
                            : t('annualNetProfit');
                  return (
                    <div key={k} className="rounded-lg bg-noorix-bg-muted/40 px-2.5 py-2">
                      <div className="text-[10px] font-medium uppercase tracking-wide text-noorix-muted">{label}</div>
                      <div className="mt-0.5 text-[13px] font-bold text-noorix-text nx-font-numbers ltr" dir="ltr">
                        {Number.isFinite(n) ? amountText(String(n)) : '—'}
                        <span className="nx-sar text-[11px]"> SR</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              {metrics.operational?.periodSalesFromSummaries != null ? (
                <div className="mt-3 border-t border-noorix-border pt-3 text-[12px] text-noorix-muted">
                  <span className="font-medium text-noorix-text">{t('dashboardInsightsBasisOperational')}: </span>
                  <span className="nx-font-numbers ltr font-semibold text-noorix-text" dir="ltr">
                    <FmtNum n={Number(metrics.operational.periodSalesFromSummaries)} />
                  </span>
                  {metrics.operational.activeSalesDaysInMonth != null ? (
                    <span className="ms-2">
                      ({t('dashboardStudioActiveSalesDays')}:{' '}
                      <FmtNum n={Number(metrics.operational.activeSalesDaysInMonth)} />)
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {ratios &&
          (ratios.purchaseToSales != null || ratios.expenseToSales != null || ratios.netProfitMargin != null) ? (
            <div className="noorix-surface-card rounded-xl border border-noorix-border p-4">
              <div className="text-[12px] font-semibold text-noorix-muted mb-2">{t('dashboardStudioRatiosTitle')}</div>
              <div className="flex flex-wrap gap-3 text-[12px]">
                {ratios.purchaseToSales != null && Number.isFinite(Number(ratios.purchaseToSales)) ? (
                  <span>
                    <span className="text-noorix-muted">{t('purchasesToSalesRatio')}: </span>
                    <span className="font-bold nx-font-numbers">{(Number(ratios.purchaseToSales) * 100).toFixed(1)}%</span>
                  </span>
                ) : null}
                {ratios.expenseToSales != null && Number.isFinite(Number(ratios.expenseToSales)) ? (
                  <span>
                    <span className="text-noorix-muted">{t('expensesToSalesRatio')}: </span>
                    <span className="font-bold nx-font-numbers">{(Number(ratios.expenseToSales) * 100).toFixed(1)}%</span>
                  </span>
                ) : null}
                {ratios.netProfitMargin != null && Number.isFinite(Number(ratios.netProfitMargin)) ? (
                  <span>
                    <span className="text-noorix-muted">{t('dashboardKpiFooterNetProfitMarginLabel')}: </span>
                    <span className="font-bold nx-font-numbers">{(Number(ratios.netProfitMargin) * 100).toFixed(1)}%</span>
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}

          {Array.isArray(salesBreakdown) && salesBreakdown.length > 0 ? (
            <div className="noorix-surface-card rounded-xl border border-noorix-border p-4">
              <div className="text-[12px] font-semibold text-noorix-muted mb-2">{t('dashboardStudioSalesBreakdown')}</div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[280px] text-[12px]">
                  <thead>
                    <tr className="border-b border-noorix-border text-start text-noorix-muted">
                      <th className="py-2 pe-2 font-medium">{t('dashboardStudioCsvMetric')}</th>
                      <th className="py-2 pe-2 font-medium ltr text-end">{t('dashboardStudioCsvValue')}</th>
                      <th className="py-2 font-medium ltr text-end">{t('dashboardStudioShare')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesBreakdown.map((row: unknown, i: number) => {
                      if (!row || typeof row !== 'object') return null;
                      const r = row as Record<string, unknown>;
                      const label = isAr ? String(r.labelAr ?? r.key) : String(r.labelEn ?? r.key);
                      return (
                        <tr key={String(r.key ?? i)} className="border-b border-noorix-border/70">
                          <td className="py-2 pe-2 font-medium text-noorix-text">{label}</td>
                          <td className="py-2 pe-2 text-end nx-font-numbers ltr" dir="ltr">
                            {String(r.amountDisplay ?? '—')}
                          </td>
                          <td className="py-2 text-end nx-font-numbers ltr" dir="ltr">
                            {r.shareOfGroupTotal != null && Number.isFinite(Number(r.shareOfGroupTotal))
                              ? `${(Number(r.shareOfGroupTotal) * 100).toFixed(1)}%`
                              : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {lists.opportunities.length > 0 ? (
            <div>
              <div className="mb-2 text-[12px] font-semibold text-noorix-muted">{t('dashboardStudioOpportunities')}</div>
              <div className="flex max-h-[320px] flex-col gap-2 overflow-y-auto pe-1">
                {lists.opportunities.map((x, i) => renderInsightLine(x, i))}
              </div>
            </div>
          ) : null}

          {lists.warnings.length > 0 ? (
            <div>
              <div className="mb-2 text-[12px] font-semibold text-noorix-muted">{t('dashboardStudioWarnings')}</div>
              <div className="flex max-h-[280px] flex-col gap-2 overflow-y-auto pe-1">
                {lists.warnings.map((x, i) => renderInsightLine(x, i))}
              </div>
            </div>
          ) : null}

          {lists.insights.length > 0 ? (
            <div>
              <div className="mb-2 text-[12px] font-semibold text-noorix-muted">{t('dashboardStudioOtherInsights')}</div>
              <div className="flex max-h-[320px] flex-col gap-2 overflow-y-auto pe-1">
                {lists.insights.map((x, i) => renderInsightLine(x, i))}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
