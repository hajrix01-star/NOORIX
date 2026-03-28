/**
 * تقرير نهاية اليوم — جداول موحّدة + طباعة نظيفة (بدون قوالب التطبيق)
 */
import React, { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '../../../i18n/useTranslation';
import { useApp } from '../../../context/AppContext';
import { getInvoiceDayCloseReport } from '../../../services/api';
import { fmt } from '../../../utils/format';
import { formatSaudiDateISO } from '../../../utils/saudiDate';

function saudiTodayYmd() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const m = parts.reduce((a, p) => (p.type !== 'literal' ? { ...a, [p.type]: p.value } : a), {});
  return `${m.year}-${m.month}-${m.day}`;
}

function SectionTitle({ children }) {
  return (
    <div className="dc-section-title">
      {children}
    </div>
  );
}

export default function DayCloseReportModal({ companyId, isOpen, onClose, defaultDateYmd }) {
  const { t } = useTranslation();
  const { companies, activeCompanyId } = useApp();
  const [dateStr, setDateStr] = useState(() => defaultDateYmd || saudiTodayYmd());

  const companyName = useMemo(() => {
    const c = companies?.find((x) => x.id === (activeCompanyId || companyId));
    return c?.nameAr || c?.name || '';
  }, [companies, activeCompanyId, companyId]);

  useEffect(() => {
    if (isOpen) setDateStr((defaultDateYmd || saudiTodayYmd()).slice(0, 10));
  }, [isOpen, defaultDateYmd]);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['invoice-day-close', companyId, dateStr],
    queryFn: async () => {
      const res = await getInvoiceDayCloseReport(companyId, dateStr);
      if (!res.success) throw new Error(res.error || t('dayCloseLoadFailed'));
      return res.data;
    },
    enabled: Boolean(isOpen && companyId && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)),
    staleTime: 30_000,
  });

  const kindLabel = useMemo(() => ({
    purchase: t('categoryTypes'),
    expense: t('categoryTypeExpense'),
    fixed_expense: t('fixedExpenseType'),
    hr_expense: t('invoiceKindHrExpense'),
    salary: t('totalSalary'),
    advance: t('quickAdvance'),
    sale: t('categoryTypeSale'),
  }), [t]);

  if (!isOpen) return null;

  const reportDateLabel = formatSaudiDateISO(`${dateStr}T12:00:00.000Z`);

  return (
    <div
      className="day-close-overlay"
      dir="rtl"
      style={{
        position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(15,23,42,0.45)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 12px', overflow: 'auto',
      }}
      role="dialog"
      aria-modal
      aria-labelledby="day-close-title"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <style>{`
        .day-close-report { --dc-border: #94a3b8; --dc-head: #0f172a; --dc-muted: #64748b; }
        .day-close-report .dc-section-title {
          font-size: 12px; font-weight: 800; color: var(--dc-head); margin: 0 0 8px; padding-bottom: 4px;
          border-bottom: 2px solid #cbd5e1; letter-spacing: 0.02em;
        }
        .day-close-report .dc-table {
          width: 100%; border-collapse: collapse; font-size: 12px;
          font-feature-settings: "tnum" 1; font-variant-numeric: tabular-nums;
        }
        .day-close-report .dc-table caption { caption-side: top; text-align: right; font-weight: 700; font-size: 11px; color: var(--dc-muted); padding: 0 0 6px; }
        .day-close-report .dc-table thead th {
          background: #1e293b; color: #fff; font-weight: 700; text-align: right; padding: 8px 10px;
          border: 1px solid #0f172a; font-size: 11px; white-space: nowrap;
        }
        .day-close-report .dc-table tbody td {
          text-align: right; padding: 7px 10px; border: 1px solid #cbd5e1; vertical-align: top;
          line-height: 1.35; color: #0f172a;
        }
        .day-close-report .dc-table tbody tr:nth-child(even) td { background: #f8fafc; }
        .day-close-report .dc-table .dc-num { font-family: var(--noorix-font-numbers, ui-monospace, monospace); text-align: left; direction: ltr; unicode-bidi: isolate; }
        .day-close-report .dc-table .dc-muted { color: var(--dc-muted); font-size: 10px; font-weight: 500; }
        .day-close-report .dc-table .dc-empty { text-align: center; color: var(--dc-muted); font-style: italic; }
        .day-close-report .dc-kpi-grid {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(148px, 1fr)); gap: 10px;
        }
        .day-close-report .dc-kpi-card {
          padding: 10px 12px; border-radius: 8px; border: 1px solid #e2e8f0; background: #fff;
        }
        .day-close-report .dc-kpi-card__label { font-size: 10px; font-weight: 800; color: #334155; margin-bottom: 4px; }
        .day-close-report .dc-kpi-card__val { font-size: 16px; font-weight: 800; font-family: var(--noorix-font-numbers); letter-spacing: 0.02em; }
        .day-close-report .dc-kpi-card__sub { font-size: 10px; color: var(--dc-muted); margin-top: 4px; }
        .day-close-report .dc-kpi-card--in { border-color: rgba(22,163,74,0.35); background: rgba(22,163,74,0.06); }
        .day-close-report .dc-kpi-card--out { border-color: rgba(220,38,38,0.25); background: rgba(220,38,38,0.04); }
        .day-close-report .dc-kpi-card--cash { border-color: rgba(37,99,235,0.3); background: rgba(37,99,235,0.05); }
        .day-close-report .dc-kpi-card--bal { border-color: rgba(124,58,237,0.28); background: rgba(124,58,237,0.05); }
        .day-close-report .dc-inline-stats {
          display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 11px; margin-top: 4px;
        }
        .day-close-report .dc-inline-stats > div {
          padding: 8px 10px; background: #f1f5f9; border-radius: 6px; border: 1px solid #e2e8f0;
        }
        .day-close-ops-wrap {
          border: 1px solid #cbd5e1; border-radius: 6px; overflow: auto; max-height: 300px;
        }
        .day-close-print-only { display: none !important; }

        @media print {
          @page { size: A4; margin: 12mm; }
          /* إظهار التقرير فقط — إخفاء بقية التطبيق (قائمة، صفحة الفواتير، إلخ) */
          body * { visibility: hidden !important; }
          .day-close-overlay,
          .day-close-overlay * { visibility: visible !important; }
          .day-close-overlay {
            position: absolute !important; left: 0 !important; top: 0 !important; right: 0 !important;
            width: 100% !important; height: auto !important; min-height: 0 !important;
            margin: 0 !important; padding: 0 !important; background: #fff !important;
            overflow: visible !important; display: block !important; z-index: 99999 !important;
            box-shadow: none !important;
          }
          .day-close-no-print,
          .day-close-screen-only { display: none !important; visibility: hidden !important; }
          .day-close-print-only { display: table !important; visibility: visible !important; }
          .day-close-print-only.dc-print-block { display: block !important; }
          .day-close-print-root {
            box-shadow: none !important; border: none !important; background: #fff !important;
            max-width: 100% !important; padding: 0 !important; margin: 0 !important; border-radius: 0 !important;
          }
          .day-close-ops-wrap {
            max-height: none !important; overflow: visible !important; border: none !important;
          }
          .day-close-report .dc-table thead th { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .day-close-report .dc-table tbody tr:nth-child(even) td { background: #f8fafc !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .day-close-report .dc-section-title {
            font-size: 10pt !important; page-break-after: avoid; border-bottom-color: #333 !important;
          }
          .day-close-report .dc-table { font-size: 9pt !important; page-break-inside: auto; }
          .day-close-report .dc-table thead { display: table-header-group !important; }
          .day-close-report .dc-table thead th {
            font-size: 8.5pt !important; padding: 6px 8px !important; background: #1e293b !important; color: #fff !important;
          }
          .day-close-report .dc-table tbody td { font-size: 8.5pt !important; padding: 5px 8px !important; }
          .day-close-report .dc-table .dc-num { font-size: 8.5pt !important; }
          .day-close-report .dc-print-header {
            text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 12px;
          }
          .day-close-report .dc-print-header__co { font-size: 14pt; font-weight: 800; margin: 0 0 4px; }
          .day-close-report .dc-print-header__doc { font-size: 11pt; font-weight: 700; margin: 0; color: #333; }
          .day-close-report .dc-print-header__date { font-size: 9pt; margin: 6px 0 0; color: #555; }
        }
      `}</style>

      <div className="day-close-print-root" style={{ maxWidth: 960, width: '100%', marginBottom: 32, padding: 16 }}>
        <div className="day-close-report">
          {/* ترويسة مطبوعة فقط */}
          <div className="day-close-print-only dc-print-block">
            <header className="dc-print-header">
              <p className="dc-print-header__co">{companyName || '—'}</p>
              <p className="dc-print-header__doc">{t('dayCloseTitle')}</p>
              <p className="dc-print-header__date">{t('dayCloseReportDate')}: {reportDateLabel}</p>
            </header>
          </div>

          <div className="day-close-no-print" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h2 id="day-close-title" style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{t('dayCloseTitle')}</h2>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <span style={{ color: 'var(--noorix-text-muted)' }}>{t('date')}</span>
                <input
                  type="date"
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                  style={{ padding: '4px 8px', borderRadius: 8, border: '1px solid var(--noorix-border)' }}
                />
              </label>
              <button type="button" className="noorix-btn-nav" onClick={() => refetch()} disabled={isFetching}>
                {t('dayCloseRefresh')}
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="noorix-btn-nav" onClick={() => window.print()}>
                {t('dayClosePrint')}
              </button>
              <button type="button" className="noorix-btn-nav" onClick={onClose}>
                {t('dayCloseClose')}
              </button>
            </div>
          </div>

          {isLoading && (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--noorix-text-muted)' }}>{t('dayCloseLoading')}</p>
          )}
          {isError && (
            <p style={{ margin: 0, fontSize: 13, color: '#dc2626' }}>{error?.message || t('dayCloseLoadFailed')}</p>
          )}

          {data && !isLoading && (
            <div style={{ display: 'grid', gap: 14 }}>
              <div className="day-close-screen-only" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, paddingBottom: 8, borderBottom: '1px solid #e2e8f0' }}>
                <div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{t('dayCloseReportDate')}</div>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>{reportDateLabel}</div>
                </div>
                <div style={{ fontSize: 10, color: '#94a3b8', maxWidth: 340, textAlign: 'right', lineHeight: 1.45 }}>
                  {t('dayCloseVaultBalanceNote')}
                </div>
              </div>

              {data.meta?.invoicesTruncated && (
                <div style={{ fontSize: 11, padding: '8px 10px', background: 'rgba(234,179,8,0.12)', borderRadius: 8, color: '#a16207', border: '1px solid rgba(234,179,8,0.35)' }}>
                  {t('dayCloseTruncatedWarning', data.meta.operationsReturned)}
                </div>
              )}

              {/* شاشة: بطاقات ملخص */}
              <div className="day-close-screen-only dc-kpi-grid">
                <div className="dc-kpi-card dc-kpi-card--in">
                  <div className="dc-kpi-card__label">{t('inbound')} — {t('categoryTypeSale')}</div>
                  <div className="dc-kpi-card__val">{fmt(Number(data.sums?.inflow?.total || 0), 2)} ﷼</div>
                  <div className="dc-kpi-card__sub">{data.sums?.inflow?.count ?? 0} {t('dayCloseOperations')}</div>
                </div>
                <div className="dc-kpi-card dc-kpi-card--out">
                  <div className="dc-kpi-card__label">{t('outbound')}</div>
                  <div className="dc-kpi-card__val">{fmt(Number(data.sums?.outflow?.total || 0), 2)} ﷼</div>
                  <div className="dc-kpi-card__sub">{data.sums?.outflow?.count ?? 0} {t('dayCloseOperations')}</div>
                </div>
                <div className="dc-kpi-card dc-kpi-card--cash">
                  <div className="dc-kpi-card__label">{t('dayCloseNetDayCash')}</div>
                  <div className="dc-kpi-card__val">{fmt(Number(data.cash?.netDay ?? 0), 2)} ﷼</div>
                  <div className="dc-kpi-card__sub">{t('dayCloseCashVaultsOnly')}</div>
                </div>
                <div className="dc-kpi-card dc-kpi-card--bal">
                  <div className="dc-kpi-card__label">{t('dayCloseCashRemainingEod')}</div>
                  <div className="dc-kpi-card__val">{fmt(Number(data.cash?.balanceEndOfDayCashVaults ?? 0), 2)} ﷼</div>
                  <div className="dc-kpi-card__sub">{t('dayCloseEodDefinition')}</div>
                </div>
              </div>

              {/* طباعة: ملخص رقمي بجدول واحد */}
              <table className="dc-table day-close-print-only" aria-label={t('dayCloseKpiPrintCaption')}>
                <caption>{t('dayCloseKpiPrintCaption')}</caption>
                <thead>
                  <tr>
                    <th>{t('dayCloseKpiColMetric')}</th>
                    <th className="dc-num">{t('dayCloseKpiColValue')}</th>
                    <th className="dc-num">{t('dayCloseKpiColCount')}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{t('inbound')} ({t('categoryTypeSale')})</td>
                    <td className="dc-num">{fmt(Number(data.sums?.inflow?.total || 0), 2)}</td>
                    <td className="dc-num">{data.sums?.inflow?.count ?? 0}</td>
                  </tr>
                  <tr>
                    <td>{t('outbound')}</td>
                    <td className="dc-num">{fmt(Number(data.sums?.outflow?.total || 0), 2)}</td>
                    <td className="dc-num">{data.sums?.outflow?.count ?? 0}</td>
                  </tr>
                  <tr>
                    <td>{t('dayCloseNetDayCash')}</td>
                    <td className="dc-num">{fmt(Number(data.cash?.netDay ?? 0), 2)}</td>
                    <td className="dc-empty">—</td>
                  </tr>
                  <tr>
                    <td>{t('dayCloseCashRemainingEod')}</td>
                    <td className="dc-num">{fmt(Number(data.cash?.balanceEndOfDayCashVaults ?? 0), 2)}</td>
                    <td className="dc-empty">—</td>
                  </tr>
                  <tr>
                    <td>{t('dayCloseCashMovement')}</td>
                    <td className="dc-num" colSpan={2}>
                      {t('dayCloseCashIn')} {fmt(Number(data.cash?.dayTotalIn ?? 0), 2)} &nbsp;|&nbsp; {t('dayCloseCashOut')} {fmt(Number(data.cash?.dayTotalOut ?? 0), 2)}
                    </td>
                  </tr>
                  <tr>
                    <td>{t('dayCloseTransfers')}</td>
                    <td className="dc-num">{fmt(Number(data.transfers?.volume || 0), 2)}</td>
                    <td className="dc-num">{data.transfers?.count ?? 0}</td>
                  </tr>
                </tbody>
              </table>

              <div className="day-close-screen-only dc-inline-stats">
                <div>
                  <strong>{t('dayCloseCashMovement')}</strong>
                  {' — '}
                  {t('dayCloseCashIn')} {fmt(Number(data.cash?.dayTotalIn ?? 0), 2)} · {t('dayCloseCashOut')} {fmt(Number(data.cash?.dayTotalOut ?? 0), 2)}
                </div>
                <div>
                  <strong>{t('dayCloseTransfers')}</strong>
                  {' — '}
                  {data.transfers?.count ?? 0} / {fmt(Number(data.transfers?.volume || 0), 2)} ﷼
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, alignItems: 'start' }}>
                <div>
                  <SectionTitle>{t('dayCloseByKind')}</SectionTitle>
                  <table className="dc-table">
                    <thead>
                      <tr>
                        <th>{t('type')}</th>
                        <th className="dc-num">{t('dayCloseCount')}</th>
                        <th className="dc-num">{t('total')} (﷼)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.byKind || []).map((row) => (
                        <tr key={row.kind}>
                          <td>{kindLabel[row.kind] || row.kind}</td>
                          <td className="dc-num">{row.count}</td>
                          <td className="dc-num">{fmt(Number(row.total), 2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div>
                  <SectionTitle>{t('dayCloseExpensesByCategory')}</SectionTitle>
                  <table className="dc-table">
                    <thead>
                      <tr>
                        <th>{t('category')}</th>
                        <th className="dc-num">{t('dayCloseCount')}</th>
                        <th className="dc-num">{t('total')} (﷼)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.expensesByCategory || []).length === 0 ? (
                        <tr><td colSpan={3} className="dc-empty">—</td></tr>
                      ) : (
                        (data.expensesByCategory || []).map((row) => (
                          <tr key={row.categoryId}>
                            <td>{row.nameAr}</td>
                            <td className="dc-num">{row.count}</td>
                            <td className="dc-num">{fmt(Number(row.total), 2)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div>
                  <SectionTitle>{t('dayCloseByPaymentChannel')}</SectionTitle>
                  <table className="dc-table">
                    <thead>
                      <tr>
                        <th>{t('vault')}</th>
                        <th className="dc-num">{t('total')} (﷼)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.outflowByPaymentMethod || []).length === 0 ? (
                        <tr><td colSpan={2} className="dc-empty">—</td></tr>
                      ) : (
                        (data.outflowByPaymentMethod || []).map((row, i) => (
                          <tr key={`${row.label}-${i}`}>
                            <td>{row.label}</td>
                            <td className="dc-num">{fmt(Number(row.total), 2)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {(data.salesSummaries || []).length > 0 && (
                <div>
                  <SectionTitle>{t('dayCloseSalesSummaries')}</SectionTitle>
                  <table className="dc-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th className="dc-num">{t('dayCloseCustomers')}</th>
                        <th className="dc-num">{t('dayCloseCashOnHand')}</th>
                        <th className="dc-num">{t('total')}</th>
                        <th>{t('vaults')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.salesSummaries || []).map((s) => (
                        <tr key={s.id}>
                          <td style={{ fontWeight: 700 }}>{s.summaryNumber}</td>
                          <td className="dc-num">{s.customerCount}</td>
                          <td className="dc-num">{fmt(Number(s.cashOnHand), 2)}</td>
                          <td className="dc-num">{fmt(Number(s.totalAmount), 2)}</td>
                          <td className="dc-muted" style={{ fontSize: 10 }}>
                            {(s.channels || []).map((c) => `${c.vaultName}: ${fmt(Number(c.amount), 2)}`).join(' · ') || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
                <div>
                  <SectionTitle>{t('dayCloseVaultMovementDay')}</SectionTitle>
                  <table className="dc-table">
                    <thead>
                      <tr>
                        <th>{t('vault')}</th>
                        <th className="dc-num">{t('inbound')}</th>
                        <th className="dc-num">{t('outbound')}</th>
                        <th className="dc-num">{t('dayCloseNet')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.vaults?.movementOnDayByVault || []).map((v) => (
                        <tr key={v.id}>
                          <td>{v.nameAr} <span className="dc-muted">({v.type})</span></td>
                          <td className="dc-num">{fmt(Number(v.totalIn), 2)}</td>
                          <td className="dc-num">{fmt(Number(v.totalOut), 2)}</td>
                          <td className="dc-num">{fmt(Number(v.netDay), 2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div>
                  <SectionTitle>{t('dayCloseVaultBalanceEod')}</SectionTitle>
                  <table className="dc-table">
                    <thead>
                      <tr>
                        <th>{t('vault')}</th>
                        <th className="dc-num">{t('dayCloseBalance')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.vaults?.balanceEndOfDayByVault || []).map((v) => (
                        <tr key={v.id}>
                          <td>{v.nameAr} <span className="dc-muted">({v.type})</span></td>
                          <td className="dc-num">{fmt(Number(v.balance), 2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <SectionTitle>{t('dayCloseOperationsTable')} — {data.meta?.invoiceCountAll ?? 0}</SectionTitle>
                <div className="day-close-ops-wrap">
                  <table className="dc-table" style={{ margin: 0, border: 'none' }}>
                    <thead>
                      <tr>
                        <th>{t('documentNumber')}</th>
                        <th>{t('type')}</th>
                        <th className="dc-num">{t('total')}</th>
                        <th>{t('dayCloseCounterparty')}</th>
                        <th>{t('vault')}</th>
                        <th>{t('statusLabel')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.operations || []).map((op) => (
                        <tr key={op.id} style={{ opacity: op.status === 'cancelled' ? 0.55 : 1 }}>
                          <td style={{ fontWeight: 700 }}>{op.invoiceNumber}</td>
                          <td>{kindLabel[op.kind] || op.kind}</td>
                          <td className="dc-num">{fmt(Number(op.totalAmount), 2)}</td>
                          <td className="dc-muted" style={{ maxWidth: 200 }}>
                            {op.supplierName || op.employeeName || op.expenseLineName || op.notes || '—'}
                          </td>
                          <td>{op.vaultName || '—'}</td>
                          <td>{op.status === 'cancelled' ? t('statusCancelled') : t('statusActive')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
