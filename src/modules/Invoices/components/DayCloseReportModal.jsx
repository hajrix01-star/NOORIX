/**
 * تقرير نهاية اليوم — صفحة واحدة مضغوطة + طباعة
 */
import React, { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '../../../i18n/useTranslation';
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

const th = { padding: '3px 5px', textAlign: 'right', fontSize: 10, fontWeight: 700, borderBottom: '1px solid #cbd5e1', color: '#475569' };
const td = { padding: '2px 5px', textAlign: 'right', fontSize: 10, borderBottom: '1px solid #f1f5f9', fontFamily: 'var(--noorix-font-numbers)' };

export default function DayCloseReportModal({ companyId, isOpen, onClose, defaultDateYmd }) {
  const { t } = useTranslation();
  const [dateStr, setDateStr] = useState(() => defaultDateYmd || saudiTodayYmd());

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

  return (
    <div
      className="day-close-overlay"
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
        @media print {
          .day-close-overlay { position: static !important; inset: auto !important; background: #fff !important; padding: 0 !important; overflow: visible !important; }
          .day-close-no-print { display: none !important; }
          .day-close-print-root { box-shadow: none !important; max-width: 100% !important; margin: 0 !important; padding: 10mm !important; }
        }
      `}</style>

      <div
        className="day-close-print-root noorix-surface-card"
        style={{
          maxWidth: 920, width: '100%', marginBottom: 32, padding: 16, borderRadius: 12,
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        }}
      >
        <div className="day-close-no-print" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
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
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, borderBottom: '2px solid #e2e8f0', paddingBottom: 8 }}>
              <div>
                <div style={{ fontSize: 11, color: '#64748b' }}>{t('dayCloseReportDate')}</div>
                <div style={{ fontSize: 15, fontWeight: 800 }}>{formatSaudiDateISO(`${dateStr}T12:00:00.000Z`)}</div>
              </div>
              <div style={{ fontSize: 10, color: '#94a3b8', maxWidth: 320, textAlign: 'left' }}>
                {t('dayCloseVaultBalanceNote')}
              </div>
            </div>

            {data.meta?.invoicesTruncated && (
              <div style={{ fontSize: 11, padding: '6px 10px', background: 'rgba(234,179,8,0.12)', borderRadius: 8, color: '#a16207' }}>
                {t('dayCloseTruncatedWarning', data.meta.operationsReturned)}
              </div>
            )}

            {/* ملخص الداخل / الخارج */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
              <div style={{ padding: 8, background: 'rgba(22,163,74,0.08)', borderRadius: 8, border: '1px solid rgba(22,163,74,0.2)' }}>
                <div style={{ fontSize: 10, color: '#166534', fontWeight: 700 }}>{t('inbound')} ({t('categoryTypeSale')})</div>
                <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'var(--noorix-font-numbers)' }}>{fmt(Number(data.sums?.inflow?.total || 0), 2)} ﷼</div>
                <div style={{ fontSize: 9, color: '#64748b' }}>{data.sums?.inflow?.count ?? 0} {t('dayCloseOperations')}</div>
              </div>
              <div style={{ padding: 8, background: 'rgba(220,38,38,0.06)', borderRadius: 8, border: '1px solid rgba(220,38,38,0.15)' }}>
                <div style={{ fontSize: 10, color: '#991b1b', fontWeight: 700 }}>{t('outbound')}</div>
                <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'var(--noorix-font-numbers)' }}>{fmt(Number(data.sums?.outflow?.total || 0), 2)} ﷼</div>
                <div style={{ fontSize: 9, color: '#64748b' }}>{data.sums?.outflow?.count ?? 0} {t('dayCloseOperations')}</div>
              </div>
              <div style={{ padding: 8, background: 'rgba(37,99,235,0.06)', borderRadius: 8, border: '1px solid rgba(37,99,235,0.15)' }}>
                <div style={{ fontSize: 10, color: '#1e40af', fontWeight: 700 }}>{t('dayCloseNetDayCash')}</div>
                <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'var(--noorix-font-numbers)' }}>{fmt(Number(data.cash?.netDay ?? 0), 2)} ﷼</div>
                <div style={{ fontSize: 9, color: '#64748b' }}>{t('dayCloseCashVaultsOnly')}</div>
              </div>
              <div style={{ padding: 8, background: 'rgba(124,58,237,0.06)', borderRadius: 8, border: '1px solid rgba(124,58,237,0.15)' }}>
                <div style={{ fontSize: 10, color: '#5b21b6', fontWeight: 700 }}>{t('dayCloseCashRemainingEod')}</div>
                <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'var(--noorix-font-numbers)' }}>{fmt(Number(data.cash?.balanceEndOfDayCashVaults ?? 0), 2)} ﷼</div>
                <div style={{ fontSize: 9, color: '#64748b' }}>{t('dayCloseEodDefinition')}</div>
              </div>
            </div>

            {/* كاش يومي + تحويلات */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 10 }}>
              <div style={{ padding: 6, background: '#f8fafc', borderRadius: 6 }}>
                <strong>{t('dayCloseCashMovement')}</strong>
                {' '}
                {t('dayCloseCashIn')} {fmt(Number(data.cash?.dayTotalIn ?? 0), 2)} — {t('dayCloseCashOut')} {fmt(Number(data.cash?.dayTotalOut ?? 0), 2)}
              </div>
              <div style={{ padding: 6, background: '#f8fafc', borderRadius: 6 }}>
                <strong>{t('dayCloseTransfers')}</strong>
                {' '}
                {data.transfers?.count ?? 0} / {fmt(Number(data.transfers?.volume || 0), 2)} ﷼
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, alignItems: 'start' }}>
              {/* حسب النوع */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, marginBottom: 4 }}>{t('dayCloseByKind')}</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ ...th, textAlign: 'right' }}>{t('type')}</th>
                      <th style={th}>{t('dayCloseCount')}</th>
                      <th style={th}>{t('total')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.byKind || []).map((row) => (
                      <tr key={row.kind}>
                        <td style={{ ...td, textAlign: 'right' }}>{kindLabel[row.kind] || row.kind}</td>
                        <td style={td}>{row.count}</td>
                        <td style={td}>{fmt(Number(row.total), 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* مصروفات حسب الفئة */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, marginBottom: 4 }}>{t('dayCloseExpensesByCategory')}</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ ...th, textAlign: 'right' }}>{t('category')}</th>
                      <th style={th}>{t('dayCloseCount')}</th>
                      <th style={th}>{t('total')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.expensesByCategory || []).length === 0 ? (
                      <tr><td colSpan={3} style={{ ...td, textAlign: 'center', color: '#94a3b8' }}>—</td></tr>
                    ) : (
                      (data.expensesByCategory || []).map((row) => (
                        <tr key={row.categoryId}>
                          <td style={{ ...td, textAlign: 'right' }}>{row.nameAr}</td>
                          <td style={td}>{row.count}</td>
                          <td style={td}>{fmt(Number(row.total), 2)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* طريقة السداد (تقريبية عبر الخزنة / paymentMethod) */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, marginBottom: 4 }}>{t('dayCloseByPaymentChannel')}</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ ...th, textAlign: 'right' }}>{t('vault')}</th>
                      <th style={th}>{t('total')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.outflowByPaymentMethod || []).length === 0 ? (
                      <tr><td colSpan={2} style={{ ...td, textAlign: 'center', color: '#94a3b8' }}>—</td></tr>
                    ) : (
                      (data.outflowByPaymentMethod || []).map((row, i) => (
                        <tr key={`${row.label}-${i}`}>
                          <td style={{ ...td, textAlign: 'right' }}>{row.label}</td>
                          <td style={td}>{fmt(Number(row.total), 2)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ملخصات مبيعات يومية */}
            {(data.salesSummaries || []).length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, marginBottom: 4 }}>{t('dayCloseSalesSummaries')}</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ ...th, textAlign: 'right' }}>#</th>
                      <th style={th}>{t('dayCloseCustomers')}</th>
                      <th style={th}>{t('dayCloseCashOnHand')}</th>
                      <th style={th}>{t('total')}</th>
                      <th style={{ ...th, textAlign: 'right' }}>{t('vaults')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.salesSummaries || []).map((s) => (
                      <tr key={s.id}>
                        <td style={{ ...td, textAlign: 'right' }}>{s.summaryNumber}</td>
                        <td style={td}>{s.customerCount}</td>
                        <td style={td}>{fmt(Number(s.cashOnHand), 2)}</td>
                        <td style={td}>{fmt(Number(s.totalAmount), 2)}</td>
                        <td style={{ ...td, textAlign: 'right', fontSize: 9 }}>
                          {(s.channels || []).map((c) => `${c.vaultName}: ${fmt(Number(c.amount), 2)}`).join(' · ') || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* خزائن: حركة اليوم + رصيد نهاية اليوم */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, marginBottom: 4 }}>{t('dayCloseVaultMovementDay')}</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ ...th, textAlign: 'right' }}>{t('vault')}</th>
                      <th style={th}>{t('inbound')}</th>
                      <th style={th}>{t('outbound')}</th>
                      <th style={th}>{t('dayCloseNet')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.vaults?.movementOnDayByVault || []).map((v) => (
                      <tr key={v.id}>
                        <td style={{ ...td, textAlign: 'right' }}>{v.nameAr} <span style={{ color: '#94a3b8' }}>({v.type})</span></td>
                        <td style={td}>{fmt(Number(v.totalIn), 2)}</td>
                        <td style={td}>{fmt(Number(v.totalOut), 2)}</td>
                        <td style={td}>{fmt(Number(v.netDay), 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, marginBottom: 4 }}>{t('dayCloseVaultBalanceEod')}</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ ...th, textAlign: 'right' }}>{t('vault')}</th>
                      <th style={th}>{t('dayCloseBalance')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.vaults?.balanceEndOfDayByVault || []).map((v) => (
                      <tr key={v.id}>
                        <td style={{ ...td, textAlign: 'right' }}>{v.nameAr} <span style={{ color: '#94a3b8' }}>({v.type})</span></td>
                        <td style={td}>{fmt(Number(v.balance), 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* جدول العمليات */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, marginBottom: 4 }}>
                {t('dayCloseOperationsTable')} ({data.meta?.invoiceCountAll ?? 0})
              </div>
              <div style={{ overflowX: 'auto', maxHeight: 280, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 6 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
                  <thead style={{ position: 'sticky', top: 0, background: '#f1f5f9' }}>
                    <tr>
                      <th style={{ ...th, textAlign: 'right' }}>{t('documentNumber')}</th>
                      <th style={{ ...th, textAlign: 'right' }}>{t('type')}</th>
                      <th style={th}>{t('total')}</th>
                      <th style={{ ...th, textAlign: 'right' }}>{t('dayCloseCounterparty')}</th>
                      <th style={{ ...th, textAlign: 'right' }}>{t('vault')}</th>
                      <th style={{ ...th, textAlign: 'right' }}>{t('statusLabel')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.operations || []).map((op) => (
                      <tr key={op.id} style={{ opacity: op.status === 'cancelled' ? 0.45 : 1 }}>
                        <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{op.invoiceNumber}</td>
                        <td style={{ ...td, textAlign: 'right', fontSize: 9 }}>{kindLabel[op.kind] || op.kind}</td>
                        <td style={td}>{fmt(Number(op.totalAmount), 2)}</td>
                        <td style={{ ...td, textAlign: 'right', fontSize: 9 }}>
                          {op.supplierName || op.employeeName || op.expenseLineName || op.notes || '—'}
                        </td>
                        <td style={{ ...td, textAlign: 'right', fontSize: 9 }}>{op.vaultName || '—'}</td>
                        <td style={{ ...td, textAlign: 'right', fontSize: 9 }}>
                          {op.status === 'cancelled' ? t('statusCancelled') : t('statusActive')}
                        </td>
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
  );
}
