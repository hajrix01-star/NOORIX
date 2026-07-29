/**
 * ReportsDetailModal — تفاصيل بند تقرير ربح وخسارة (AdaptiveSheet: مودال على العريض، لوح على الضيق)
 */
import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useReportDetails, useReportTrend } from '../../hooks/useReports';
import { fmt } from '../../utils/format';
import { percentText, truncateText, isEmptyMetric, metricCardAmountValue } from './reportHelpers';
import { buildReportDrillLink, drillToSearchParams } from '../../utils/reportDrillLinks';
import { Button, AdaptiveSheet, MetricCard, ScreenTabs, SmartTable, usePrintPreview } from '../../ui';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  LabelList,
} from 'recharts';
import { KPI_RECHARTS_COLORS } from '../../constants/kpiCardTheme';
import { toYmd } from '../../utils/saudiDate';
import {
  DETAIL_INVOICES_PAGE_SIZE,
  buildReportsDetailTabs,
  buildTrendChartRows,
  computeMonthlyAverageAmount,
  findPeakTrendPoint,
  findSelectedTrendPoint,
  isReportsDetailTabId,
  reportDetailChannelNames,
  reportDetailItemLabel,
  reportDetailSourceName,
  resolveDisplayAnnualAmount,
  resolveDisplayContextAmount,
  resolveDisplayContextPercent,
  type ReportDetailCompanyRef,
  type ReportDetailItem,
  type ReportTrendData,
  type ReportsDetailTabId,
  type ReportsDetailData,
  type ReportsDetailState,
  type TooltipProps,
  type TranslateFn,
} from './reportsDetailModel';
import { buildReportsDetailPrintDocument } from './reportsDetailPrintModel';

type ReportsDetailModalProps = {
  state: ReportsDetailState | null;
  onClose: () => void;
  companyId: string;
  year: number | null | undefined;
  t: TranslateFn;
  lang: string;
};

export default function ReportsDetailModal({ state, onClose, companyId, year, t, lang }: ReportsDetailModalProps) {
  const navigate = useNavigate();
  const { companies = [] } = useApp();
  const [invoiceListPage, setInvoiceListPage] = useState(1);
  const [activeTab, setActiveTab] = useState<ReportsDetailTabId>('summary');
  const safeYear = year ?? 0;
  const safeMonth = state?.month ?? 0;
  const safeGroupKey = state?.groupKey ?? '';
  const company = (companies as ReportDetailCompanyRef[]).find((item) => item.id === companyId);
  const companyName = lang === 'en'
    ? (company?.nameEn || company?.nameAr || '')
    : (company?.nameAr || company?.nameEn || '');
  const companyLogoUrl = String(company?.logoUrl || '').trim();
  const { openPrintDocumentPreview, printPreviewModal } = usePrintPreview({
    title: t('reportDetails'),
    closeLabel: t('close') || 'إغلاق',
    printLabel: `${t('print')} / PDF`,
  });
  const { data, isLoading, error } = useReportDetails({
    companyId,
    year: safeYear,
    month: safeMonth,
    groupKey: safeGroupKey,
    itemKey: state?.itemKey || undefined,
    enabled: !!state,
  });
  const {
    data: trend,
    isLoading: trendLoading,
    isError: trendIsError,
    error: trendError,
  } = useReportTrend({
    companyId,
    year: safeYear,
    groupKey: safeGroupKey,
    itemKey: state?.itemKey || undefined,
    enabled: !!state?.showTrend,
  });

  const drillTarget = useMemo(() => {
    if (!state || year == null) return null;
    return buildReportDrillLink({
      year,
      month: state.month ?? null,
      groupKey: state.groupKey,
      itemKey: state.itemKey || undefined,
    });
  }, [state, year]);

  const trendChartData = useMemo(() => {
    return buildTrendChartRows(trend as ReportTrendData | undefined, state?.month, percentText);
  }, [trend?.points, state?.month]);

  const peakPoint = useMemo(() => {
    return findPeakTrendPoint(trend as ReportTrendData | undefined);
  }, [trend]);

  const trendPointForSelectedMonth = useMemo(() => {
    return findSelectedTrendPoint(trend as ReportTrendData | undefined, state?.month);
  }, [state?.month, trend?.points]);

  /** يتطابق مع الخادم؛ احتياط إذا تأخّر أحد الطلبين */
  const displayContextAmount = useMemo(() => {
    return resolveDisplayContextAmount(data as ReportsDetailData | undefined, trendPointForSelectedMonth);
  }, [data, trendPointForSelectedMonth]);

  const displayAnnualAmount = useMemo(() => {
    return resolveDisplayAnnualAmount(data as ReportsDetailData | undefined, trend as ReportTrendData | undefined);
  }, [data, trend]);

  const displayContextPercent = useMemo(() => {
    return resolveDisplayContextPercent(data as ReportsDetailData | undefined, trendPointForSelectedMonth);
  }, [data, trendPointForSelectedMonth]);

  const tabItems = useMemo(() => {
    return buildReportsDetailTabs(t, state, data as ReportsDetailData | undefined);
  }, [state?.showTrend, data?.kind, t]);

  useEffect(() => {
    setInvoiceListPage(1);
    setActiveTab('summary');
  }, [state?.groupKey, state?.itemKey, state?.month, year]);

  useEffect(() => {
    const ids = new Set(tabItems.map((item) => item.id));
    if (!ids.has(activeTab)) setActiveTab('summary');
  }, [tabItems, activeTab]);

  const invoiceRows: ReportDetailItem[] = (data as ReportsDetailData | undefined)?.items ?? [];
  const invoiceTotal = invoiceRows.length;
  const invoicePageRows = useMemo(() => {
    const start = (invoiceListPage - 1) * DETAIL_INVOICES_PAGE_SIZE;
    return invoiceRows.slice(start, start + DETAIL_INVOICES_PAGE_SIZE);
  }, [invoiceRows, invoiceListPage]);

  const averageAmount = useMemo(() => {
    return computeMonthlyAverageAmount(trend as ReportTrendData | undefined);
  }, [trend]);

  const modalTitle = data
    ? `${t('reportDetails')} — ${lang === 'en' ? data.titleEn : data.titleAr}${data.monthLabel ? ` • ${data.monthLabel}` : ''}`
    : t('reportDetails');

  function handlePrintDetails() {
    if (!data) return;
    openPrintDocumentPreview(buildReportsDetailPrintDocument({
      data: data as ReportsDetailData,
      year,
      t,
      lang,
      companyName,
      companyLogoUrl,
    }));
  }

  const footerContent = (
    <div className="flex w-full flex-wrap items-center justify-between gap-2">
      <Button variant="default" size="md" onClick={handlePrintDetails} disabled={!data}>
        {t('print')}
      </Button>
      {drillTarget ? (
        <Button
          variant="primary"
          size="md"
          onClick={() => {
            const qs = drillToSearchParams(drillTarget.query);
            navigate(`${drillTarget.path}?${qs}`);
            onClose();
          }}
        >
          {drillTarget.path === '/sales' ? t('reportOpenInSales') : t('reportOpenInInvoices')}
        </Button>
      ) : (
        state?.itemKey?.startsWith('account:') || state?.groupKey === 'grossProfit' || state?.groupKey === 'netProfit' ? (
          <span className="text-[12px] text-noorix-muted">{t('reportDrillNoLink')}</span>
        ) : null
      )}
    </div>
  );

  return (
    <AdaptiveSheet open={!!state} onClose={onClose} title={modalTitle} size="xl" side="start" className="reports-detail-drawer" footer={footerContent}>
      {printPreviewModal}
      {isLoading && (
        <div className="p-6 text-center text-noorix-muted">{t('loading')}</div>
      )}

      {error && (
        <div className="p-4 rounded-xl text-noorix-red bg-noorix-red/10">
          {error.message}
        </div>
      )}

      {!isLoading && !error && data && (
        <ScreenTabs
          items={tabItems}
          value={activeTab}
          onChange={(id) => {
            if (isReportsDetailTabId(id)) setActiveTab(id);
          }}
          contentClassName="nx-tab-content px-0 pt-3 pb-1 min-h-[160px]"
          animateContent={false}
        >
          {activeTab === 'summary' && (
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
              <MetricCard color="var(--color-nx-purchases)">
                <MetricCard.Header label={data.month ? t('selectedMonth') : t('reportBreakdown')} />
                <MetricCard.Value value={metricCardAmountValue(displayContextAmount)} currency="SR" />
              </MetricCard>
              {data.kind === 'invoices' && (
                <>
                  <MetricCard color="var(--color-nx-sales)">
                    <MetricCard.Header label={t('reportAnnualTotal')} />
                    <MetricCard.Value value={metricCardAmountValue(displayAnnualAmount)} currency="SR" />
                  </MetricCard>
                  <MetricCard color="var(--color-nx-net-profit)">
                    <MetricCard.Header label={data.month ? t('reportSalesShareMonth') : t('reportSalesShareYear')} />
                    <MetricCard.Value value={percentText(displayContextPercent)} />
                  </MetricCard>
                  <MetricCard color="var(--color-nx-purchases)">
                    <MetricCard.Header label={t('reportInvoicesCount')} />
                    <MetricCard.Value value={Number(data.invoiceCount || 0).toLocaleString('en')} />
                  </MetricCard>
                </>
              )}
            </div>
          )}

          {activeTab === 'trend' && state?.showTrend && (
            <>
              {trendIsError && (
                <div className="p-4 mb-2 rounded-xl text-noorix-amber border border-noorix-amber/30 bg-noorix-amber/10 text-[13px]">
                  {trendError?.message || t('reportTrendLoadError')}
                </div>
              )}
              {trendLoading && !trend && !trendIsError && (
                <div className="py-6 text-center text-noorix-muted text-[13px]">{t('loading')}</div>
              )}
              {trend && (
                <div className="noorix-surface-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <div>
                      <div className="text-[14px] font-extrabold">{t('reportTrend')}</div>
                      <div className="mt-1 text-noorix-muted text-[12px]">{t('reportTimeline')}</div>
                    </div>
                    <div className="text-[12px] text-noorix-muted">
                      {t('reportSalesShareYear')}: <strong className="nx-font-numbers">{percentText(trend.percentOfSalesYear)}</strong>
                    </div>
                  </div>
                  <div className="grid gap-2.5 mb-3 [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]">
                    <MetricCard color="var(--color-nx-purchases)">
                      <MetricCard.Header label={t('reportMonthlyAverage')} />
                      <MetricCard.Value value={metricCardAmountValue(averageAmount)} currency="SR" />
                    </MetricCard>
                    <MetricCard color="var(--color-nx-profit)">
                      <MetricCard.Header label={t('reportTopMonth')} />
                      <MetricCard.Value value={peakPoint?.label || '—'} />
                      <MetricCard.Section>
                        <span className="text-[12px] text-noorix-muted inline-flex items-baseline gap-x-1">
                          {peakPoint != null && !isEmptyMetric(peakPoint.amount) ? (
                            <>
                              <span className="nx-font-numbers">{fmt(Number(peakPoint.amount))}</span>
                              <span className="nx-sar">SR</span>
                            </>
                          ) : (
                            '—'
                          )}
                        </span>
                      </MetricCard.Section>
                    </MetricCard>
                    <MetricCard color="var(--color-nx-sales)">
                      <MetricCard.Header label={t('selectedMonth')} />
                      <MetricCard.Value value={data?.monthLabel || t('allMonths')} />
                      <MetricCard.Section>
                        <span className="text-[12px] text-noorix-muted inline-flex items-baseline gap-x-1">
                          {!isEmptyMetric(displayContextAmount) ? (
                            <>
                              <span className="nx-font-numbers">{fmt(Number(displayContextAmount))}</span>
                              <span className="nx-sar">SR</span>
                            </>
                          ) : (
                            '—'
                          )}
                        </span>
                      </MetricCard.Section>
                    </MetricCard>
                  </div>
                  <div className="mt-1 rounded-xl border border-noorix-border bg-noorix-bg-muted/40 p-2 sm:p-4" dir="ltr">
                    <div className="mb-2 text-[11px] font-semibold text-noorix-muted sm:text-[12px]">
                      {t('reportTrendChartCaption')}
                    </div>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={trendChartData} margin={{ top: 24, right: 6, left: 0, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--noorix-border)" />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 10, fill: 'var(--noorix-text-muted)' }}
                          axisLine={{ stroke: 'var(--noorix-border)' }}
                          tickLine={false}
                          interval={0}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: 'var(--noorix-text-muted)' }}
                          tickFormatter={(value: number) => fmt(value, 0)}
                          width={44}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          cursor={{ fill: 'color-mix(in srgb, var(--color-nx-sales) 8%, transparent)' }}
                          content={({ active, payload }: TooltipProps) => {
                            if (!active || !payload?.length) return null;
                            const d = payload[0]?.payload;
                            return (
                              <div className="rounded-lg border border-noorix-border bg-noorix-surface px-3 py-2 shadow-md text-[12px]">
                                <div className="mb-1 font-bold text-noorix-text">{d?.name}</div>
                                <div className="nx-font-numbers font-semibold text-noorix-text">
                                  {fmt(d?.rawAmount)} <span className="nx-sar">SR</span>
                                </div>
                                <div className="mt-1 text-[11px] text-nx-profit">
                                  {t('reportSalesShare')}: {d?.pctStr}
                                </div>
                              </div>
                            );
                          }}
                        />
                        <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={52}>
                          {trendChartData.map((entry) => (
                            <Cell
                              key={entry.key}
                              fill={entry.rawAmount >= 0 ? KPI_RECHARTS_COLORS.grossProfit : KPI_RECHARTS_COLORS.expenses}
                              stroke={entry.isSelected ? KPI_RECHARTS_COLORS.sales : 'transparent'}
                              strokeWidth={entry.isSelected ? 2 : 0}
                            />
                          ))}
                          <LabelList
                            dataKey="pctStr"
                            position="top"
                            style={{
                              fontSize: 10,
                              fill: 'var(--noorix-text-muted)',
                              fontFamily: 'var(--noorix-font-numbers)',
                            }}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'breakdown' && data.kind === 'derived' && (
            <div className="reports-detail-derived-list grid gap-2.5">
              {((data.items || []) as ReportDetailItem[]).map((item) => (
                <div
                  key={item.key}
                  className="reports-detail-derived-item flex items-center justify-between border border-noorix-border rounded-xl px-3 py-2"
                >
                  <div className="font-bold">{reportDetailItemLabel(item, lang)}</div>
                  <div className="nx-font-numbers font-extrabold inline-flex items-baseline gap-x-1">
                    <span>{fmt(Number(item.amount))}</span>
                    <span className="nx-sar">SR</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'documents' && data.kind === 'invoices' && (
            <div className="w-full max-w-[1200px] mx-auto">
              <div className="noorix-surface-card overflow-hidden p-0">
                <div className="nx-section-header">
                  <div>
                    <div className="text-[13px] font-extrabold">{t('reportSmartSummary')}</div>
                    <div className="mt-1 text-[12px] text-noorix-muted">
                      {t('reportDetailListSummary', { count: invoiceTotal })}
                    </div>
                    {invoiceTotal >= 500 && (
                      <div className="mt-1.5 text-[11px] text-noorix-amber leading-snug max-w-[52ch]">
                        {t('reportDetailListCapHint')}
                      </div>
                    )}
                  </div>
                  <div className="text-[12px] text-noorix-muted inline-flex flex-wrap items-baseline gap-x-1">
                    {t('reportAnnualTotal')}:
                    <strong className="nx-font-numbers inline-flex items-baseline gap-x-1">
                      <span>{!isEmptyMetric(displayAnnualAmount) ? fmt(Number(displayAnnualAmount)) : '—'}</span>
                      {!isEmptyMetric(displayAnnualAmount) && <span className="nx-sar">SR</span>}
                    </strong>
                  </div>
                </div>
                <SmartTable
                  total={invoiceTotal}
                  page={invoiceListPage}
                  pageSize={DETAIL_INVOICES_PAGE_SIZE}
                  onPageChange={setInvoiceListPage}
                  columns={[
                    { key: 'transactionDate', label: t('transactionDate'),
                      render: (value: unknown) => toYmd(value) },
                    { key: 'invoiceNumber', label: t('reportInvoiceNumber'),
                      render: (_value: unknown, item: ReportDetailItem) => <span className="font-bold">{item.summaryNumber || item.invoiceNumber || '—'}</span> },
                    { key: 'supplier', label: t('reportSourceOrSupplier'),
                      render: (_value: unknown, item: ReportDetailItem) => (
                        <div>
                          <div className="font-semibold truncate" title={reportDetailSourceName(item, lang)}>
                            {reportDetailSourceName(item, lang)}
                          </div>
                          {reportDetailChannelNames(item, lang) && (
                            <div className="text-[11px] text-noorix-muted mt-1">
                              {reportDetailChannelNames(item, lang)}
                            </div>
                          )}
                        </div>
                      ) },
                    { key: 'totalAmount', label: t('reportAmountInclTax'), numeric: true,
                      render: (value: unknown) => (
                        <span className="nx-font-numbers font-bold inline-flex items-baseline gap-x-1">
                          <span>{fmt(Number(value))}</span>
                          <span className="nx-sar">SR</span>
                        </span>
                      ) },
                    { key: 'percentOfSales', label: t('reportSalesShare'),
                      render: (_value: unknown, item: ReportDetailItem) => <span className="nx-font-numbers text-nx-profit">{percentText(item.percentOfSales ?? item.percentOfTotal)}</span> },
                    { key: 'notes', label: t('notes'),
                      render: (value: unknown) => <span className="text-noorix-muted truncate">{truncateText(value)}</span> },
                  ]}
                  data={invoicePageRows}
                  keyExtractor={(item: ReportDetailItem) => item.id || item.key || ''}
                  emptyMessage={t('noDataInPeriod')}
                />
              </div>
            </div>
          )}
        </ScreenTabs>
      )}
    </AdaptiveSheet>
  );
}
