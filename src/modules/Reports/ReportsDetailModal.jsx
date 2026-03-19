/**
 * ReportsDetailModal — نافذة تفاصيل البند في تقرير ربح وخسارة
 */
import React, { useMemo } from 'react';
import { useReportDetails, useReportTrend } from '../../hooks/useReports';
import { amountText, moneyText, percentText, truncateText, PERCENT_COLOR } from './reportHelpers';

export default function ReportsDetailModal({ state, onClose, companyId, year, t, lang }) {
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

  if (!state) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.45)', padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        className="noorix-surface-card"
        style={{ width: '100%', maxWidth: 1180, maxHeight: '92vh', overflow: 'auto', padding: 20 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18 }}>{t('reportDetails')}</h3>
            <div style={{ marginTop: 4, color: 'var(--noorix-text-muted)', fontSize: 13 }}>
              {data ? (lang === 'en' ? data.titleEn : data.titleAr) : '—'}
              {data?.monthLabel ? ` • ${data.monthLabel}` : ''}
            </div>
          </div>
          <button type="button" className="noorix-btn-nav" onClick={onClose}>{t('close')}</button>
        </div>

        {(isLoading || trendLoading) && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--noorix-text-muted)' }}>{t('loading')}</div>
        )}

        {error && (
          <div style={{ padding: 16, borderRadius: 12, background: 'rgba(239,68,68,0.08)', color: '#dc2626' }}>
            {error.message}
          </div>
        )}

        {!isLoading && !error && data && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 18 }}>
              <div className="noorix-surface-card" style={{ padding: 14 }}>
                <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>{data.month ? t('selectedMonth') : t('reportBreakdown')}</div>
                <div style={{ marginTop: 6, fontFamily: 'var(--noorix-font-numbers)', fontWeight: 900, fontSize: 22 }}>{moneyText(data.contextAmount)}</div>
              </div>
              {data.kind === 'invoices' && (
                <>
                  <div className="noorix-surface-card" style={{ padding: 14 }}>
                    <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>{t('reportAnnualTotal')}</div>
                    <div style={{ marginTop: 6, fontFamily: 'var(--noorix-font-numbers)', fontWeight: 900, fontSize: 22 }}>{moneyText(data.annualAmount)}</div>
                  </div>
                  <div className="noorix-surface-card" style={{ padding: 14 }}>
                    <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>{t('reportSalesShare')}</div>
                    <div style={{ marginTop: 6, fontFamily: 'var(--noorix-font-numbers)', fontWeight: 900, fontSize: 22 }}>{percentText(data.contextPercentOfSales)}</div>
                  </div>
                  <div className="noorix-surface-card" style={{ padding: 14 }}>
                    <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>{t('reportInvoicesCount')}</div>
                    <div style={{ marginTop: 6, fontFamily: 'var(--noorix-font-numbers)', fontWeight: 900, fontSize: 22 }}>{Number(data.invoiceCount || 0).toLocaleString('en')}</div>
                  </div>
                </>
              )}
            </div>

            {state?.showTrend && trend && (
              <div className="noorix-surface-card" style={{ padding: 16, marginBottom: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800 }}>{t('reportTrend')}</div>
                    <div style={{ marginTop: 4, color: 'var(--noorix-text-muted)', fontSize: 12 }}>{t('reportTimeline')}</div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>
                    {t('reportSalesShare')}: <strong style={{ fontFamily: 'var(--noorix-font-numbers)' }}>{percentText(trend.percentOfSalesYear)}</strong>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 14 }}>
                  <div style={{ border: '1px solid var(--noorix-border)', borderRadius: 12, padding: '10px 12px' }}>
                    <div style={{ fontSize: 11, color: 'var(--noorix-text-muted)' }}>{t('reportMonthlyAverage')}</div>
                    <div style={{ marginTop: 4, fontWeight: 800, fontFamily: 'var(--noorix-font-numbers)' }}>{moneyText(averageAmount)}</div>
                  </div>
                  <div style={{ border: '1px solid var(--noorix-border)', borderRadius: 12, padding: '10px 12px' }}>
                    <div style={{ fontSize: 11, color: 'var(--noorix-text-muted)' }}>{t('reportTopMonth')}</div>
                    <div style={{ marginTop: 4, fontWeight: 800 }}>{peakPoint?.label || '—'}</div>
                    <div style={{ marginTop: 2, fontSize: 12, fontFamily: 'var(--noorix-font-numbers)', color: 'var(--noorix-text-muted)' }}>{moneyText(peakPoint?.amount)}</div>
                  </div>
                  <div style={{ border: '1px solid var(--noorix-border)', borderRadius: 12, padding: '10px 12px' }}>
                    <div style={{ fontSize: 11, color: 'var(--noorix-text-muted)' }}>{t('selectedMonth')}</div>
                    <div style={{ marginTop: 4, fontWeight: 800 }}>{data?.monthLabel || t('allMonths')}</div>
                    <div style={{ marginTop: 2, fontSize: 12, fontFamily: 'var(--noorix-font-numbers)', color: 'var(--noorix-text-muted)' }}>{moneyText(data?.contextAmount)}</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
                  {(trend.points || []).map((point) => {
                    const amount = Number(point.amount || 0);
                    const width = `${(Math.abs(amount) / maxAmount) * 100}%`;
                    return (
                      <div key={point.month} style={{ display: 'grid', gridTemplateColumns: '52px 1fr 120px 78px', gap: 10, alignItems: 'center' }}>
                        <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>{point.label}</div>
                        <div style={{ height: 12, borderRadius: 999, background: 'var(--noorix-bg-muted)', overflow: 'hidden' }}>
                          <div style={{ width, height: '100%', borderRadius: 999, background: amount >= 0 ? '#16a34a' : '#dc2626' }} />
                        </div>
                        <div style={{ textAlign: 'right', fontFamily: 'var(--noorix-font-numbers)', fontWeight: 700 }}>{moneyText(point.amount)}</div>
                        <div style={{ textAlign: 'right', fontFamily: 'var(--noorix-font-numbers)', fontSize: 12, color: PERCENT_COLOR }}>{percentText(point.percentOfSales)}</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(62px, 1fr))', gap: 8 }}>
                  {(trend.points || []).map((point) => (
                    <div
                      key={`timeline-${point.month}`}
                      style={{
                        borderRadius: 12,
                        padding: 8,
                        background: state?.month === point.month ? 'rgba(37,99,235,0.10)' : 'var(--noorix-bg-muted)',
                        border: state?.month === point.month ? '1px solid rgba(37,99,235,0.28)' : '1px solid var(--noorix-border)',
                      }}
                    >
                      <div style={{ fontSize: 11, color: 'var(--noorix-text-muted)', marginBottom: 6 }}>{point.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 800, fontFamily: 'var(--noorix-font-numbers)' }}>{amountText(point.amount)}</div>
                      <div style={{ fontSize: 11, color: PERCENT_COLOR, marginTop: 4 }}>{percentText(point.percentOfSales)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.kind === 'derived' && (
              <div style={{ display: 'grid', gap: 10 }}>
                {(data.items || []).map((item) => (
                  <div
                    key={item.key}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      border: '1px solid var(--noorix-border)',
                      borderRadius: 12,
                      padding: '12px 14px',
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>{lang === 'en' ? item.labelEn : item.labelAr}</div>
                    <div style={{ fontFamily: 'var(--noorix-font-numbers)', fontWeight: 800 }}>{moneyText(item.amount)}</div>
                  </div>
                ))}
              </div>
            )}

            {data.kind === 'invoices' && (
              <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                <div className="noorix-surface-card" style={{ padding: 0, overflow: 'hidden', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                  <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--noorix-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800 }}>{t('reportSmartSummary')}</div>
                      <div style={{ marginTop: 4, fontSize: 12, color: 'var(--noorix-text-muted)' }}>
                        {t('reportShowingLatest', Math.min(data.items?.length || 0, 8), data.items?.length || 0)}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>
                      {t('reportAnnualTotal')}: <strong style={{ fontFamily: 'var(--noorix-font-numbers)' }}>{moneyText(data.annualAmount)}</strong>
                    </div>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', minWidth: 860, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                      <colgroup>
                        <col style={{ width: 150 }} />
                        <col style={{ width: 100 }} />
                        <col />
                        <col style={{ width: 150 }} />
                        <col style={{ width: 100 }} />
                        <col />
                      </colgroup>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'right', padding: '16px 24px', borderBottom: '1px solid var(--noorix-border)', fontSize: 13, fontWeight: 700, color: '#374151', background: 'var(--noorix-bg-surface)' }}>{t('transactionDate')}</th>
                          <th style={{ textAlign: 'right', padding: '16px 24px', borderBottom: '1px solid var(--noorix-border)', fontSize: 13, fontWeight: 700, color: '#374151', background: 'var(--noorix-bg-surface)' }}>{t('reportInvoiceNumber')}</th>
                          <th style={{ textAlign: 'right', padding: '16px 24px', borderBottom: '1px solid var(--noorix-border)', fontSize: 13, fontWeight: 700, color: '#374151', background: 'var(--noorix-bg-surface)' }}>{t('reportSourceOrSupplier')}</th>
                          <th style={{ textAlign: 'right', padding: '16px 24px', borderBottom: '1px solid var(--noorix-border)', fontSize: 13, fontWeight: 700, color: '#374151', background: 'rgba(248,250,252,1)' }}>{t('reportNetAmount')}</th>
                          <th style={{ textAlign: 'right', padding: '16px 24px', borderBottom: '1px solid var(--noorix-border)', fontSize: 13, fontWeight: 700, color: '#374151', background: 'var(--noorix-bg-surface)' }}>{t('reportSalesShare')}</th>
                          <th style={{ textAlign: 'right', padding: '16px 24px', borderBottom: '1px solid var(--noorix-border)', fontSize: 13, fontWeight: 700, color: '#374151', background: 'var(--noorix-bg-surface)' }}>{t('notes')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(data.items || []).length === 0 && (
                          <tr>
                            <td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'var(--noorix-text-muted)' }}>{t('noDataInPeriod')}</td>
                          </tr>
                        )}
                        {(data.items || []).slice(0, 8).map((item) => (
                          <tr key={item.id} className="report-table-row">
                            <td style={{ padding: '16px 24px', borderBottom: '1px solid var(--noorix-border)' }}>{String(item.transactionDate || '').slice(0, 10)}</td>
                            <td style={{ padding: '16px 24px', borderBottom: '1px solid var(--noorix-border)', fontWeight: 700 }}>{item.summaryNumber || item.invoiceNumber || '—'}</td>
                            <td style={{ padding: '16px 24px', borderBottom: '1px solid var(--noorix-border)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              <div style={{ fontWeight: 600 }} title={(lang === 'en' ? item.supplierNameEn : item.supplierNameAr) || item.supplierNameAr || item.supplierNameEn || (lang === 'en' ? item.itemLabelEn : item.itemLabelAr) || '—'}>{(lang === 'en' ? item.supplierNameEn : item.supplierNameAr) || item.supplierNameAr || item.supplierNameEn || (lang === 'en' ? item.itemLabelEn : item.itemLabelAr) || '—'}</div>
                              {item.channelNames?.length > 0 && (
                                <div style={{ marginTop: 3, fontSize: 11, color: 'var(--noorix-text-muted)' }}>
                                  {item.channelNames.slice(0, 2).map((channel) => lang === 'en' ? (channel.nameEn || channel.nameAr) : (channel.nameAr || channel.nameEn)).join(' | ')}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '16px 24px', borderBottom: '1px solid var(--noorix-border)', fontFamily: 'var(--noorix-font-numbers)', fontWeight: 700, textAlign: 'right', background: 'rgba(248,250,252,0.9)' }}>{amountText(item.netAmount)}</td>
                            <td style={{ padding: '16px 24px', borderBottom: '1px solid var(--noorix-border)', fontFamily: 'var(--noorix-font-numbers)', fontWeight: 600, textAlign: 'right', color: PERCENT_COLOR }}>{percentText(data.contextPercentOfSales)}</td>
                            <td style={{ padding: '16px 24px', borderBottom: '1px solid var(--noorix-border)', color: 'var(--noorix-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }} title={truncateText(item.notes)}>{truncateText(item.notes)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
