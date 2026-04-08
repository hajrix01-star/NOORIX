/**
 * ReportsDetailModal — تفاصيل بند تقرير ربح وخسارة (AdaptiveSheet: مودال على العريض، لوح على الضيق)
 */
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReportDetails, useReportTrend } from '../../hooks/useReports';
import { amountText, moneyText, percentText, truncateText } from './reportHelpers';
import { buildReportDrillLink, drillToSearchParams } from '../../utils/reportDrillLinks';
import { Button, AdaptiveSheet } from '../../ui';
import SmartTable from '../../components/common/SmartTable';
import { useIsMobile640 } from '../../hooks/useMediaQuery';

export default function ReportsDetailModal({ state, onClose, companyId, year, t, lang }) {
  const navigate = useNavigate();
  const isMobile = useIsMobile640();
  const { data, isLoading, error } = useReportDetails({
    companyId,
    year,
    month: state?.month,
    groupKey: state?.groupKey,
    itemKey: state?.itemKey || undefined,
    enabled: !!state,
  });
  const { data: trend, isLoading: trendLoading } = useReportTrend({
    companyId,
    year,
    groupKey: state?.groupKey,
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

  const maxAmount = useMemo(() => {
    const values = (trend?.points || []).map((point) => Math.abs(Number(point.amount || 0)));
    return Math.max(1, ...values);
  }, [trend]);

  const peakPoint = useMemo(() => {
    const points = trend?.points || [];
    if (!points.length) return null;
    return points.reduce((best, point) => (Number(point.amount || 0) > Number(best.amount || 0) ? point : best), points[0]);
  }, [trend]);

  const averageAmount = useMemo(() => {
    const points = trend?.points || [];
    if (!points.length) return '0';
    const total = points.reduce((sum, point) => sum + Number(point.amount || 0), 0);
    return String(total / points.length);
  }, [trend]);

  const modalTitle = data
    ? `${t('reportDetails')} — ${lang === 'en' ? data.titleEn : data.titleAr}${data.monthLabel ? ` • ${data.monthLabel}` : ''}`
    : t('reportDetails');

  const footerContent = drillTarget ? (
    <Button
      variant="primary"
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
    );

  return (
    <AdaptiveSheet open={!!state} onClose={onClose} title={modalTitle} size="xl" side="start" className="reports-detail-drawer" footer={footerContent}>
      {(isLoading || trendLoading) && (
        <div className="p-6 text-center text-noorix-muted">{t('loading')}</div>
      )}

      {error && (
        <div className="p-4 rounded-xl text-noorix-red bg-noorix-red/10">
          {error.message}
        </div>
      )}

      {!isLoading && !error && data && (
        <>
          <div className="grid gap-3 mb-4 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
            <div className="noorix-surface-card p-3.5">
              <div className="text-[12px] text-noorix-muted">{data.month ? t('selectedMonth') : t('reportBreakdown')}</div>
              <div className="mt-1.5 nx-font-numbers font-extrabold text-[20px]">{moneyText(data.contextAmount)}</div>
            </div>
            {data.kind === 'invoices' && (
              <>
                <div className="noorix-surface-card p-3.5">
                  <div className="text-[12px] text-noorix-muted">{t('reportAnnualTotal')}</div>
                  <div className="mt-1.5 nx-font-numbers font-extrabold text-[20px]">{moneyText(data.annualAmount)}</div>
                </div>
                <div className="noorix-surface-card p-3.5">
                  <div className="text-[12px] text-noorix-muted">{t('reportSalesShare')}</div>
                  <div className="mt-1.5 nx-font-numbers font-extrabold text-[20px]">{percentText(data.contextPercentOfSales)}</div>
                </div>
                <div className="noorix-surface-card p-3.5">
                  <div className="text-[12px] text-noorix-muted">{t('reportInvoicesCount')}</div>
                  <div className="mt-1.5 nx-font-numbers font-extrabold text-[20px]">{Number(data.invoiceCount || 0).toLocaleString('en')}</div>
                </div>
              </>
            )}
          </div>

          {state?.showTrend && trend && (
            <div className="noorix-surface-card p-4 mb-4">
              <div className="flex items-center justify-between gap-3 mb-3 flex flex-wrap">
                <div>
                  <div className="text-[14px] font-extrabold">{t('reportTrend')}</div>
                  <div className="mt-1 text-noorix-muted text-[12px]">{t('reportTimeline')}</div>
                </div>
                <div className="text-[12px] text-noorix-muted">
                  {t('reportSalesShare')}: <strong className="nx-font-numbers">{percentText(trend.percentOfSalesYear)}</strong>
                </div>
              </div>
              <div className="grid gap-2.5 mb-3 [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]">
                <div className="border border-noorix-border rounded-xl px-3 py-2">
                  <div className="text-[11px] text-noorix-muted">{t('reportMonthlyAverage')}</div>
                  <div className="mt-1 font-extrabold nx-font-numbers">{moneyText(averageAmount)}</div>
                </div>
                <div className="border border-noorix-border rounded-xl px-3 py-2">
                  <div className="text-[11px] text-noorix-muted">{t('reportTopMonth')}</div>
                  <div className="mt-1 font-extrabold">{peakPoint?.label || '—'}</div>
                  <div className="text-[12px] nx-font-numbers text-noorix-muted mt-1">{moneyText(peakPoint?.amount)}</div>
                </div>
                <div className="border border-noorix-border rounded-xl px-3 py-2">
                  <div className="text-[11px] text-noorix-muted">{t('selectedMonth')}</div>
                  <div className="mt-1 font-extrabold">{data?.monthLabel || t('allMonths')}</div>
                  <div className="text-[12px] nx-font-numbers text-noorix-muted mt-1">{moneyText(data?.contextAmount)}</div>
                </div>
              </div>
              <div className="grid gap-2 mb-4">
                {(trend.points || []).map((point) => {
                  const amount = Number(point.amount || 0);
                  const width = `${(Math.abs(amount) / maxAmount) * 100}%`;
                  return (
                    <div key={point.month} className="grid gap-2.5 items-center [grid-template-columns:52px_1fr_120px_78px]">
                      <div className="text-[12px] text-noorix-muted">{point.label}</div>
                      <div className="bg-noorix-bg-muted overflow-hidden rounded-full h-3">
                        <div className="h-full rounded-full" style={{ width, background: amount >= 0 ? 'var(--noorix-accent-green)' : 'var(--noorix-accent-red)' }} />
                      </div>
                      <div className="text-end nx-font-numbers font-bold">{moneyText(point.amount)}</div>
                      <div className="text-end nx-font-numbers text-[12px] text-teal-600">{percentText(point.percentOfSales)}</div>
                    </div>
                  );
                })}
              </div>
              <div
                className="reports-detail-timeline-grid grid gap-2"
                style={{ gridTemplateColumns: isMobile ? 'repeat(auto-fit, minmax(120px, 1fr))' : 'repeat(12, minmax(62px, 1fr))' }}
              >
                {(trend.points || []).map((point) => (
                  <div
                    key={`timeline-${point.month}`}
                    className="rounded-xl p-2"
                    style={{
                      background: state?.month === point.month ? 'var(--noorix-blue-10)' : 'var(--noorix-bg-muted)',
                      border: state?.month === point.month ? '1px solid var(--noorix-blue-28)' : '1px solid var(--noorix-border)',
                    }}
                  >
                    <div className="text-[11px] text-noorix-muted mb-1.5">{point.label}</div>
                    <div className="text-[13px] font-extrabold nx-font-numbers">{amountText(point.amount)}</div>
                    <div className="text-[11px] mt-1 text-teal-600">{percentText(point.percentOfSales)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.kind === 'derived' && (
            <div className="reports-detail-derived-list grid gap-2.5">
              {(data.items || []).map((item) => (
                <div
                  key={item.key}
                  className="reports-detail-derived-item flex items-center justify-between border border-noorix-border rounded-xl px-3 py-2"
                >
                  <div className="font-bold">{lang === 'en' ? item.labelEn : item.labelAr}</div>
                  <div className="nx-font-numbers font-extrabold">{moneyText(item.amount)}</div>
                </div>
              ))}
            </div>
          )}

          {data.kind === 'invoices' && (
            <div className="w-full max-w-[1200px] mx-auto">
              <div className="noorix-surface-card overflow-hidden rounded-xl p-0" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                <div className="nx-section-header">
                  <div>
                    <div className="text-[13px] font-extrabold">{t('reportSmartSummary')}</div>
                    <div className="mt-1 text-[12px] text-noorix-muted">
                      {t('reportShowingLatest', Math.min(data.items?.length || 0, 8), data.items?.length || 0)}
                    </div>
                  </div>
                  <div className="text-[12px] text-noorix-muted">
                    {t('reportAnnualTotal')}: <strong className="nx-font-numbers">{moneyText(data.annualAmount)}</strong>
                  </div>
                </div>
                <SmartTable
                  columns={[
                    { key: 'transactionDate', label: t('transactionDate'),
                      render: (v) => String(v || '').slice(0, 10) },
                    { key: 'invoiceNumber', label: t('reportInvoiceNumber'),
                      render: (_, item) => <span className="font-bold">{item.summaryNumber || item.invoiceNumber || '—'}</span> },
                    { key: 'supplier', label: t('reportSourceOrSupplier'),
                      render: (_, item) => (
                        <div>
                          <div className="font-semibold truncate" title={(lang === 'en' ? item.supplierNameEn : item.supplierNameAr) || item.supplierNameAr || item.supplierNameEn || (lang === 'en' ? item.itemLabelEn : item.itemLabelAr) || '—'}>
                            {(lang === 'en' ? item.supplierNameEn : item.supplierNameAr) || item.supplierNameAr || item.supplierNameEn || (lang === 'en' ? item.itemLabelEn : item.itemLabelAr) || '—'}
                          </div>
                          {item.channelNames?.length > 0 && (
                            <div className="text-[11px] text-noorix-muted mt-1">
                              {item.channelNames.slice(0, 2).map((channel) => lang === 'en' ? (channel.nameEn || channel.nameAr) : (channel.nameAr || channel.nameEn)).join(' | ')}
                            </div>
                          )}
                        </div>
                      ) },
                    { key: 'netAmount', label: t('reportNetAmount'), numeric: true,
                      render: (v) => <span className="nx-font-numbers font-bold">{amountText(v)}</span> },
                    { key: 'percentOfSales', label: t('reportSalesShare'),
                      render: (_, item) => <span className="nx-font-numbers text-teal-600">{percentText(item.percentOfSales ?? item.percentOfTotal)}</span> },
                    { key: 'notes', label: t('notes'),
                      render: (v) => <span className="text-noorix-muted truncate">{truncateText(v)}</span> },
                  ]}
                  data={(data.items || []).slice(0, 8)}
                  keyExtractor={(item) => item.id}
                  emptyMessage={t('noDataInPeriod')}
                />
              </div>
            </div>
          )}
        </>
      )}
    </AdaptiveSheet>
  );
}
