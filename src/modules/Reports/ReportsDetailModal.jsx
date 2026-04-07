/**
 * ReportsDetailModal — لوح جانبي لتفاصيل البند في تقرير ربح وخسارة (Drawer موحّد)
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReportDetails, useReportTrend } from '../../hooks/useReports';
import { amountText, moneyText, percentText, truncateText, PERCENT_COLOR } from './reportHelpers';
import { buildReportDrillLink, drillToSearchParams } from '../../utils/reportDrillLinks';
import { Button, Drawer } from '../../ui';
import SmartTable from '../../components/common/SmartTable';

export default function ReportsDetailModal({ state, onClose, companyId, year, t, lang }) {
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches);
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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 640px)');
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

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
        <span className="nx-text-sm nx-text-muted">{t('reportDrillNoLink')}</span>
      ) : null
    );

  return (
    <Drawer open={!!state} onClose={onClose} title={modalTitle} size="xl" side="start" className="reports-detail-drawer" footer={footerContent}>
      {(isLoading || trendLoading) && (
        <div className="nx-p-24 nx-text-center nx-text-muted">{t('loading')}</div>
      )}

      {error && (
        <div className="nx-p-16 nx-rounded-lg nx-text-expense" style={{ background: 'rgba(239,68,68,0.08)' }}>
          {error.message}
        </div>
      )}

      {!isLoading && !error && data && (
        <>
          <div className="nx-grid nx-gap-12 nx-mb-16" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
            <div className="noorix-surface-card nx-p-14">
              <div className="nx-text-sm nx-text-muted">{data.month ? t('selectedMonth') : t('reportBreakdown')}</div>
              <div className="nx-mt-6 nx-font-numbers nx-font-800 nx-text-3xl">{moneyText(data.contextAmount)}</div>
            </div>
            {data.kind === 'invoices' && (
              <>
                <div className="noorix-surface-card nx-p-14">
                  <div className="nx-text-sm nx-text-muted">{t('reportAnnualTotal')}</div>
                  <div className="nx-mt-6 nx-font-numbers nx-font-800 nx-text-3xl">{moneyText(data.annualAmount)}</div>
                </div>
                <div className="noorix-surface-card nx-p-14">
                  <div className="nx-text-sm nx-text-muted">{t('reportSalesShare')}</div>
                  <div className="nx-mt-6 nx-font-numbers nx-font-800 nx-text-3xl">{percentText(data.contextPercentOfSales)}</div>
                </div>
                <div className="noorix-surface-card nx-p-14">
                  <div className="nx-text-sm nx-text-muted">{t('reportInvoicesCount')}</div>
                  <div className="nx-mt-6 nx-font-numbers nx-font-800 nx-text-3xl">{Number(data.invoiceCount || 0).toLocaleString('en')}</div>
                </div>
              </>
            )}
          </div>

          {state?.showTrend && trend && (
            <div className="noorix-surface-card nx-p-16 nx-mb-16">
              <div className="nx-flex-between nx-gap-12 nx-mb-12 nx-flex-wrap">
                <div>
                  <div className="nx-text-md nx-font-800">{t('reportTrend')}</div>
                  <div className="nx-mt-4 nx-text-muted nx-text-sm">{t('reportTimeline')}</div>
                </div>
                <div className="nx-text-sm nx-text-muted">
                  {t('reportSalesShare')}: <strong className="nx-font-numbers">{percentText(trend.percentOfSalesYear)}</strong>
                </div>
              </div>
              <div className="nx-grid nx-gap-10 nx-mb-12" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                <div className="nx-border-all nx-rounded-lg nx-px-12 nx-py-8">
                  <div className="nx-text-xs nx-text-muted">{t('reportMonthlyAverage')}</div>
                  <div className="nx-mt-4 nx-font-800 nx-font-numbers">{moneyText(averageAmount)}</div>
                </div>
                <div className="nx-border-all nx-rounded-lg nx-px-12 nx-py-8">
                  <div className="nx-text-xs nx-text-muted">{t('reportTopMonth')}</div>
                  <div className="nx-mt-4 nx-font-800">{peakPoint?.label || '—'}</div>
                  <div className="nx-text-sm nx-font-numbers nx-text-muted nx-mt-4">{moneyText(peakPoint?.amount)}</div>
                </div>
                <div className="nx-border-all nx-rounded-lg nx-px-12 nx-py-8">
                  <div className="nx-text-xs nx-text-muted">{t('selectedMonth')}</div>
                  <div className="nx-mt-4 nx-font-800">{data?.monthLabel || t('allMonths')}</div>
                  <div className="nx-text-sm nx-font-numbers nx-text-muted nx-mt-4">{moneyText(data?.contextAmount)}</div>
                </div>
              </div>
              <div className="nx-grid nx-gap-8 nx-mb-16">
                {(trend.points || []).map((point) => {
                  const amount = Number(point.amount || 0);
                  const width = `${(Math.abs(amount) / maxAmount) * 100}%`;
                  return (
                    <div key={point.month} className="nx-grid nx-gap-10" style={{ gridTemplateColumns: '52px 1fr 120px 78px', alignItems: 'center' }}>
                      <div className="nx-text-sm nx-text-muted">{point.label}</div>
                      <div className="nx-bg-muted nx-overflow-hidden nx-rounded-full" style={{ height: 12 }}>
                        <div className="nx-h-full nx-rounded-full" style={{ width, background: amount >= 0 ? '#16a34a' : '#dc2626' }} />
                      </div>
                      <div className="nx-text-end nx-font-numbers nx-font-700">{moneyText(point.amount)}</div>
                      <div className="nx-text-end nx-font-numbers nx-text-sm" style={{ color: PERCENT_COLOR }}>{percentText(point.percentOfSales)}</div>
                    </div>
                  );
                })}
              </div>
              <div
                className="reports-detail-timeline-grid nx-grid nx-gap-8"
                style={{ gridTemplateColumns: isMobile ? 'repeat(auto-fit, minmax(120px, 1fr))' : 'repeat(12, minmax(62px, 1fr))' }}
              >
                {(trend.points || []).map((point) => (
                  <div
                    key={`timeline-${point.month}`}
                    className="nx-rounded-lg"
                    style={{
                      padding: 8,
                      background: state?.month === point.month ? 'rgba(37,99,235,0.10)' : 'var(--noorix-bg-muted)',
                      border: state?.month === point.month ? '1px solid rgba(37,99,235,0.28)' : '1px solid var(--noorix-border)',
                    }}
                  >
                    <div className="nx-text-xs nx-text-muted nx-mb-6">{point.label}</div>
                    <div className="nx-text-base nx-font-800 nx-font-numbers">{amountText(point.amount)}</div>
                    <div className="nx-text-xs nx-mt-4" style={{ color: PERCENT_COLOR }}>{percentText(point.percentOfSales)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.kind === 'derived' && (
            <div className="reports-detail-derived-list nx-grid nx-gap-10">
              {(data.items || []).map((item) => (
                <div
                  key={item.key}
                  className="reports-detail-derived-item nx-flex-between nx-border-all nx-rounded-lg nx-px-12 nx-py-8"
                >
                  <div className="nx-font-700">{lang === 'en' ? item.labelEn : item.labelAr}</div>
                  <div className="nx-font-numbers nx-font-800">{moneyText(item.amount)}</div>
                </div>
              ))}
            </div>
          )}

          {data.kind === 'invoices' && (
            <div className="nx-w-full" style={{ maxWidth: 1200, margin: '0 auto' }}>
              <div className="noorix-surface-card nx-overflow-hidden nx-rounded-lg" style={{ padding: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                <div className="nx-section-header">
                  <div>
                    <div className="nx-text-base nx-font-800">{t('reportSmartSummary')}</div>
                    <div className="nx-mt-4 nx-text-sm nx-text-muted">
                      {t('reportShowingLatest', Math.min(data.items?.length || 0, 8), data.items?.length || 0)}
                    </div>
                  </div>
                  <div className="nx-text-sm nx-text-muted">
                    {t('reportAnnualTotal')}: <strong className="nx-font-numbers">{moneyText(data.annualAmount)}</strong>
                  </div>
                </div>
                <SmartTable
                  columns={[
                    { key: 'transactionDate', label: t('transactionDate'),
                      render: (v) => String(v || '').slice(0, 10) },
                    { key: 'invoiceNumber', label: t('reportInvoiceNumber'),
                      render: (_, item) => <span className="nx-font-700">{item.summaryNumber || item.invoiceNumber || '—'}</span> },
                    { key: 'supplier', label: t('reportSourceOrSupplier'),
                      render: (_, item) => (
                        <div>
                          <div className="nx-font-600 nx-truncate" title={(lang === 'en' ? item.supplierNameEn : item.supplierNameAr) || item.supplierNameAr || item.supplierNameEn || (lang === 'en' ? item.itemLabelEn : item.itemLabelAr) || '—'}>
                            {(lang === 'en' ? item.supplierNameEn : item.supplierNameAr) || item.supplierNameAr || item.supplierNameEn || (lang === 'en' ? item.itemLabelEn : item.itemLabelAr) || '—'}
                          </div>
                          {item.channelNames?.length > 0 && (
                            <div className="nx-text-xs nx-text-muted nx-mt-4">
                              {item.channelNames.slice(0, 2).map((channel) => lang === 'en' ? (channel.nameEn || channel.nameAr) : (channel.nameAr || channel.nameEn)).join(' | ')}
                            </div>
                          )}
                        </div>
                      ) },
                    { key: 'netAmount', label: t('reportNetAmount'), numeric: true,
                      render: (v) => <span className="nx-font-numbers nx-font-700">{amountText(v)}</span> },
                    { key: 'percentOfSales', label: t('reportSalesShare'),
                      render: (_, item) => <span className="nx-font-numbers" style={{ color: PERCENT_COLOR }}>{percentText(item.percentOfSales ?? item.percentOfTotal)}</span> },
                    { key: 'notes', label: t('notes'),
                      render: (v) => <span className="nx-text-muted nx-truncate">{truncateText(v)}</span> },
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
    </Drawer>
  );
}
