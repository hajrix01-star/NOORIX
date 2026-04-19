/**
 * تقرير نهاية اليوم — جداول موحّدة + طباعة نظيفة (بدون قوالب التطبيق)
 */
import React, { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '../../../i18n/useTranslation';
import { useApp } from '../../../context/AppContext';
import { getInvoiceDayCloseReport, throwIfApiFailed } from '../../../services/api';
import { fmt } from '../../../utils/format';
import { formatSaudiDateISO } from '../../../utils/saudiDate';
import { Button, Modal, Input, cn } from '../../../ui';
import { useToast } from '../../../context/ToastContext';

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

const MAX_DAY_CLOSE_RANGE_DAYS = 31;

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** عرض اسم مزدوج حسب لغة الواجهة */
function pickBilingual(lang, nameAr, nameEn) {
  const ar = nameAr != null && String(nameAr).trim() !== '' ? String(nameAr).trim() : '';
  const en = nameEn != null && String(nameEn).trim() !== '' ? String(nameEn).trim() : '';
  if (lang === 'en') return en || ar || '—';
  return ar || en || '—';
}

/** تواريخ YYYY-MM-DD من البداية إلى النهاية (شاملة)، UTC تقويمية */
function enumerateYmdDates(startStr, endStr) {
  const [sy, sm, sd] = startStr.split('-').map(Number);
  const [ey, em, ed] = endStr.split('-').map(Number);
  const start = new Date(Date.UTC(sy, sm - 1, sd));
  const end = new Date(Date.UTC(ey, em - 1, ed));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];
  const out = [];
  for (let cur = new Date(start); cur <= end; cur.setUTCDate(cur.getUTCDate() + 1)) {
    out.push(`${cur.getUTCFullYear()}-${pad2(cur.getUTCMonth() + 1)}-${pad2(cur.getUTCDate())}`);
  }
  return out;
}

function counterpartyLabel(op, lang) {
  const sup = pickBilingual(lang, op.supplierNameAr ?? op.supplierName, op.supplierNameEn);
  if (sup !== '—') return sup;
  if (op.employeeName) return op.employeeName;
  const el = pickBilingual(lang, op.expenseLineNameAr ?? op.expenseLineName, op.expenseLineNameEn);
  if (el !== '—') return el;
  return op.notes || '—';
}

function DayCloseReportBody({ data, kindLabel, t, reportDateLabel, lang, compact = false }) {
  return (
    <div className="grid gap-3.5">
      <div className="day-close-screen-only flex gap-2 justify-between items-baseline flex-wrap pb-2 border-b border-noorix-border">
        <div>
          <div className="text-[11px]" style={{ color: 'var(--noorix-text-muted)' }}>{t('dayCloseReportDate')}</div>
          <div className="text-[15px] font-extrabold">{reportDateLabel}</div>
        </div>
        <div className="text-[10px] text-[var(--noorix-text-muted-2)] max-w-[340px] text-right leading-[1.45]">
          {t(compact ? 'dayCloseVaultBalanceNoteCompact' : 'dayCloseVaultBalanceNote')}
        </div>
      </div>

      {data.meta?.invoicesTruncated && (
        <div className="text-[11px] py-2 px-[10px] bg-[var(--noorix-yellow-12)] rounded-lg text-noorix-amber border border-[var(--noorix-yellow-35)]">
          {t('dayCloseTruncatedWarning', data.meta.operationsReturned)}
        </div>
      )}

      <div className="day-close-screen-only dc-kpi-grid">
        <div className="dc-kpi-card dc-kpi-card--in">
          <div className="dc-kpi-card__label">{t('inbound')} — {t('categoryTypeSale')}</div>
          <div className="dc-kpi-card__val">{fmt(Number(data.sums?.inflow?.total || 0))} SR</div>
          <div className="dc-kpi-card__sub">{data.sums?.inflow?.count ?? 0} {t('dayCloseOperations')}</div>
        </div>
        <div className="dc-kpi-card dc-kpi-card--out">
          <div className="dc-kpi-card__label">{t('outbound')}</div>
          <div className="dc-kpi-card__val">{fmt(Number(data.sums?.outflow?.total || 0))} SR</div>
          <div className="dc-kpi-card__sub">{data.sums?.outflow?.count ?? 0} {t('dayCloseOperations')}</div>
        </div>
        <div className="dc-kpi-card dc-kpi-card--cash">
          <div className="dc-kpi-card__label">{t('dayCloseNetDayCash')}</div>
          <div className="dc-kpi-card__val">{fmt(Number(data.cash?.netDay ?? 0))} SR</div>
          <div className="dc-kpi-card__sub">{t('dayCloseCashVaultsOnly')}</div>
        </div>
        <div className="dc-kpi-card dc-kpi-card--bal">
          <div className="dc-kpi-card__label">{t('dayCloseCashRemainingEod')}</div>
          <div className="dc-kpi-card__val">{fmt(Number(data.cash?.balanceEndOfDayCashVaults ?? 0))} SR</div>
          <div className="dc-kpi-card__sub">{t('dayCloseEodDefinition')}</div>
        </div>
      </div>

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
            <td className="dc-num">{fmt(Number(data.sums?.inflow?.total || 0))}</td>
            <td className="dc-num">{data.sums?.inflow?.count ?? 0}</td>
          </tr>
          <tr>
            <td>{t('outbound')}</td>
            <td className="dc-num">{fmt(Number(data.sums?.outflow?.total || 0))}</td>
            <td className="dc-num">{data.sums?.outflow?.count ?? 0}</td>
          </tr>
          <tr>
            <td>{t('dayCloseNetDayCash')}</td>
            <td className="dc-num">{fmt(Number(data.cash?.netDay ?? 0))}</td>
            <td className="dc-empty">—</td>
          </tr>
          <tr>
            <td>{t('dayCloseCashRemainingEod')}</td>
            <td className="dc-num">{fmt(Number(data.cash?.balanceEndOfDayCashVaults ?? 0))}</td>
            <td className="dc-empty">—</td>
          </tr>
          <tr>
            <td>{t('dayCloseCashMovement')}</td>
            <td className="dc-num" colSpan={2}>
              {t('dayCloseCashIn')} {fmt(Number(data.cash?.dayTotalIn ?? 0))} &nbsp;|&nbsp; {t('dayCloseCashOut')} {fmt(Number(data.cash?.dayTotalOut ?? 0))}
            </td>
          </tr>
          <tr>
            <td>{t('dayCloseTransfers')}</td>
            <td className="dc-num">{fmt(Number(data.transfers?.volume || 0))}</td>
            <td className="dc-num">{data.transfers?.count ?? 0}</td>
          </tr>
        </tbody>
      </table>

      {!compact && (
        <div className="day-close-screen-only dc-inline-stats">
          <div>
            <strong>{t('dayCloseCashMovement')}</strong>
            {' — '}
            {t('dayCloseCashIn')} {fmt(Number(data.cash?.dayTotalIn ?? 0))} · {t('dayCloseCashOut')} {fmt(Number(data.cash?.dayTotalOut ?? 0))}
          </div>
          <div>
            <strong>{t('dayCloseTransfers')}</strong>
            {' — '}
            {data.transfers?.count ?? 0} / {fmt(Number(data.transfers?.volume || 0))} SR
          </div>
        </div>
      )}

      <div className="grid gap-3.5 grid-cols-[repeat(auto-fit,minmax(240px,1fr))] items-start">
        <div>
          <SectionTitle>{t('dayCloseByKind')}</SectionTitle>
          <table className="dc-table">
            <thead>
              <tr>
                <th>{t('type')}</th>
                <th className="dc-num">{t('dayCloseCount')}</th>
                <th className="dc-num">{t('total')} (SR)</th>
              </tr>
            </thead>
            <tbody>
              {(data.byKind || []).length === 0 ? (
                <tr><td colSpan={3} className="dc-empty">—</td></tr>
              ) : (
                (data.byKind || []).map((row) => (
                  <tr key={row.kind}>
                    <td>{kindLabel[row.kind] || row.kind}</td>
                    <td className="dc-num">{row.count}</td>
                    <td className="dc-num">{fmt(Number(row.total))}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!compact && (
          <div>
            <SectionTitle>{t('dayCloseExpensesByCategory')}</SectionTitle>
            <table className="dc-table">
              <thead>
                <tr>
                  <th>{t('category')}</th>
                  <th className="dc-num">{t('dayCloseCount')}</th>
                  <th className="dc-num">{t('total')} (SR)</th>
                </tr>
              </thead>
              <tbody>
                {(data.expensesByCategory || []).length === 0 ? (
                  <tr><td colSpan={3} className="dc-empty">—</td></tr>
                ) : (
                  (data.expensesByCategory || []).map((row) => (
                    <tr key={row.categoryId}>
                      <td>{pickBilingual(lang, row.nameAr, row.nameEn)}</td>
                      <td className="dc-num">{row.count}</td>
                      <td className="dc-num">{fmt(Number(row.total))}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        <div>
          <SectionTitle>{t('dayCloseByPaymentChannel')}</SectionTitle>
          <table className="dc-table">
            <thead>
              <tr>
                <th>{t('vault')}</th>
                <th className="dc-num">{t('total')} (SR)</th>
              </tr>
            </thead>
            <tbody>
              {(data.outflowByPaymentMethod || []).length === 0 ? (
                <tr><td colSpan={2} className="dc-empty">—</td></tr>
              ) : (
                (data.outflowByPaymentMethod || []).map((row, i) => (
                  <tr key={row.vaultId ?? `${row.nameAr ?? row.label}-${i}`}>
                    <td>{pickBilingual(lang, row.nameAr ?? row.label, row.nameEn)}</td>
                    <td className="dc-num">{fmt(Number(row.total))}</td>
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
                {!compact && <th>{t('vaults')}</th>}
              </tr>
            </thead>
            <tbody>
              {(data.salesSummaries || []).map((s) => (
                <tr key={s.id}>
                  <td className="font-bold">{s.summaryNumber}</td>
                  <td className="dc-num">{s.customerCount}</td>
                  <td className="dc-num">{fmt(Number(s.cashOnHand))}</td>
                  <td className="dc-num">{fmt(Number(s.totalAmount))}</td>
                  {!compact && (
                    <td className="dc-muted text-[10px]">
                      {(s.channels || []).map((c) => `${pickBilingual(lang, c.vaultNameAr ?? c.vaultName, c.vaultNameEn)}: ${fmt(Number(c.amount))}`).join(' · ') || '—'}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
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
              {(data.vaults?.movementOnDayByVault || []).length === 0 ? (
                <tr><td colSpan={4} className="dc-empty">—</td></tr>
              ) : (
                (data.vaults?.movementOnDayByVault || []).map((v) => (
                  <tr key={v.id}>
                    <td>{pickBilingual(lang, v.nameAr, v.nameEn)} <span className="dc-muted">({v.type})</span></td>
                    <td className="dc-num">{fmt(Number(v.totalIn))}</td>
                    <td className="dc-num">{fmt(Number(v.totalOut))}</td>
                    <td className="dc-num">{fmt(Number(v.netDay))}</td>
                  </tr>
                ))
              )}
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
              {(data.vaults?.balanceEndOfDayByVault || []).length === 0 ? (
                <tr><td colSpan={2} className="dc-empty">—</td></tr>
              ) : (
                (data.vaults?.balanceEndOfDayByVault || []).map((v) => (
                  <tr key={v.id}>
                    <td>{pickBilingual(lang, v.nameAr, v.nameEn)} <span className="dc-muted">({v.type})</span></td>
                    <td className="dc-num">{fmt(Number(v.balance))}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <SectionTitle>{t('dayCloseOperationsTable')} — {data.meta?.invoiceCountAll ?? 0}</SectionTitle>
        <div className="day-close-ops-wrap">
          <table className="dc-table m-0" style={{ border: 'none' }}>
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
              {(data.operations || []).length === 0 && (
                <tr><td colSpan={6} className="dc-empty">—</td></tr>
              )}
              {(data.operations || []).map((op) => (
                <tr key={op.id} style={{ opacity: op.status === 'cancelled' ? 0.55 : 1 }}>
                  <td className="font-bold">{op.invoiceNumber}</td>
                  <td>{kindLabel[op.kind] || op.kind}</td>
                  <td className="dc-num">{fmt(Number(op.totalAmount))}</td>
                  <td className="dc-muted" style={{ maxWidth: 200 }}>
                    {counterpartyLabel(op, lang)}
                  </td>
                  <td>{pickBilingual(lang, op.vaultNameAr ?? op.vaultName, op.vaultNameEn)}</td>
                  <td>{op.status === 'cancelled' ? t('statusCancelled') : t('statusActive')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function DayCloseReportModal({ companyId, isOpen, onClose, defaultDateYmd, compact = false }) {
  const { t, lang } = useTranslation();
  const reportTitle = compact ? t('dayCloseTitleV2') : t('dayCloseTitle');
  const { companies, activeCompanyId } = useApp();
  const [dateStr, setDateStr] = useState(() => defaultDateYmd || saudiTodayYmd());

  const companyName = useMemo(() => {
    const c = companies?.find((x) => x.id === (activeCompanyId || companyId));
    if (!c) return '';
    return lang === 'en'
      ? (c.nameEn || c.nameAr || c.name || '')
      : (c.nameAr || c.nameEn || c.name || '');
  }, [companies, activeCompanyId, companyId, lang]);

  useEffect(() => {
    if (isOpen) setDateStr((defaultDateYmd || saudiTodayYmd()).slice(0, 10));
  }, [isOpen, defaultDateYmd]);

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['invoice-day-close', companyId, dateStr],
    queryFn: async () => {
      const res = await getInvoiceDayCloseReport(companyId, dateStr);
      throwIfApiFailed(res, t('dayCloseLoadFailed'));
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

  const { showToast } = useToast();
  const [rangeFrom, setRangeFrom] = useState(() => defaultDateYmd || saudiTodayYmd());
  const [rangeTo, setRangeTo] = useState(() => defaultDateYmd || saudiTodayYmd());
  const [rangePrintLoading, setRangePrintLoading] = useState(false);
  const [multiDayPrint, setMultiDayPrint] = useState(null);

  useEffect(() => {
    if (!isOpen) {
      setMultiDayPrint(null);
      return;
    }
    const base = (defaultDateYmd || saudiTodayYmd()).slice(0, 10);
    setRangeFrom(base);
    setRangeTo(base);
  }, [isOpen, defaultDateYmd]);

  const handlePrintRange = async () => {
    const dates = enumerateYmdDates(rangeFrom, rangeTo);
    if (dates.length === 0) {
      showToast(t('dayClosePrintRangeInvalid'), 'error');
      return;
    }
    if (dates.length > MAX_DAY_CLOSE_RANGE_DAYS) {
      showToast(t('dayClosePrintRangeTooMany', MAX_DAY_CLOSE_RANGE_DAYS), 'error');
      return;
    }
    if (!companyId) return;
    setRangePrintLoading(true);
    try {
      const rows = [];
      for (const d of dates) {
        const res = await getInvoiceDayCloseReport(companyId, d);
        throwIfApiFailed(res, t('dayCloseLoadFailed'));
        rows.push({ date: d, data: res.data });
      }
      setMultiDayPrint(rows);
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 50)));
      window.print();
    } catch (e) {
      showToast(e?.message || t('dayCloseLoadFailed'), 'error');
      setMultiDayPrint(null);
    } finally {
      setRangePrintLoading(false);
    }
  };

  useEffect(() => {
    const onAfterPrint = () => setMultiDayPrint(null);
    window.addEventListener('afterprint', onAfterPrint);
    return () => window.removeEventListener('afterprint', onAfterPrint);
  }, []);

  if (!isOpen) return null;

  const reportDateLabel = formatSaudiDateISO(`${dateStr}T12:00:00.000Z`);

  return (
    <Modal open={isOpen} onClose={onClose} size="xl" closeOnBackdrop={false} hideClose className="day-close-modal">
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
        .day-close-report .dc-table tbody tr:nth-child(even) td { background: var(--noorix-bg-page, #f8fafc); }
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
        .day-close-report .dc-kpi-card--in { border-color: var(--noorix-green-35); background: var(--noorix-green-6); }
        .day-close-report .dc-kpi-card--out { border-color: var(--noorix-red-25); background: var(--noorix-red-4); }
        .day-close-report .dc-kpi-card--cash { border-color: var(--noorix-blue-30); background: var(--noorix-blue-5); }
        .day-close-report .dc-kpi-card--bal { border-color: var(--noorix-violet-28); background: var(--noorix-violet-5); }
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
        .day-close-multi-print { display: none !important; }

        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          html, body {
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
            margin: 0 !important;
          }
          #root { min-height: 0 !important; height: auto !important; }
          body > *:not(.nx-modal-backdrop) { display: none !important; }
          .nx-modal-backdrop {
            position: static !important;
            inset: auto !important;
            display: block !important;
            width: 100% !important;
            min-height: 0 !important;
            height: auto !important;
            max-height: none !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            box-shadow: none !important;
            overflow: visible !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
          }
          .nx-modal-backdrop,
          .nx-modal-backdrop * {
            visibility: visible !important;
          }
          .nx-modal.day-close-modal {
            max-width: 100% !important;
            max-height: none !important;
            overflow: visible !important;
            box-shadow: none !important;
            border: none !important;
          }
          .nx-modal.day-close-modal .flex-1.overflow-y-auto {
            overflow: visible !important;
            max-height: none !important;
            padding: 2mm 4mm !important;
          }
          .day-close-no-print { display: none !important; }
          .day-close-screen-only { display: none !important; }
          .day-close-print-only { display: table !important; }
          .day-close-print-only.dc-print-block { display: block !important; }
          .day-close-print-root {
            box-shadow: none !important; border: none !important; background: #fff !important;
            max-width: 100% !important; padding: 0 !important; margin: 0 !important; border-radius: 0 !important;
            zoom: 0.92;
          }
          [data-print-mode="multi"] .day-close-single-print { display: none !important; }
          [data-print-mode="multi"] .day-close-multi-print { display: block !important; }
          [data-print-mode="single"] .day-close-multi-print { display: none !important; }
          .day-close-multi-day--break {
            page-break-before: always;
            break-before: page;
          }
          .day-close-ops-wrap {
            max-height: none !important; overflow: visible !important; border: none !important;
          }
          .day-close-report .dc-table thead th { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .day-close-report .dc-table tbody tr:nth-child(even) td { background: #f8fafc !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .day-close-report .dc-section-title {
            font-size: 9pt !important; page-break-after: avoid; border-bottom-color: #333 !important;
            margin: 0 0 4px !important; padding-bottom: 2px !important;
          }
          .day-close-report .dc-table { font-size: 8.5pt !important; page-break-inside: auto; }
          .day-close-report .dc-table thead { display: table-header-group !important; }
          .day-close-report .dc-table thead th {
            font-size: 8pt !important; padding: 4px 6px !important; background: #1e293b !important; color: #fff !important;
          }
          .day-close-report .dc-table tbody td { font-size: 8pt !important; padding: 3px 6px !important; line-height: 1.25 !important; }
          .day-close-report .dc-table .dc-num { font-size: 8pt !important; }
          .day-close-report .dc-print-header {
            text-align: center; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 8px;
          }
          .day-close-report .dc-print-header__co { font-size: 12pt; font-weight: 800; margin: 0 0 2px; }
          .day-close-report .dc-print-header__doc { font-size: 10pt; font-weight: 700; margin: 0; color: #333; }
          .day-close-report .dc-print-header__date { font-size: 8pt; margin: 4px 0 0; color: #555; }
        }
      `}</style>

      <div
        className="day-close-print-root w-full"
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
        data-print-mode={multiDayPrint?.length ? 'multi' : 'single'}
        style={{
          position: 'relative',
        }}
      >
        <div className="day-close-report">
          <div className="day-close-no-print flex flex-col gap-3 mb-[14px]">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-6 flex-wrap">
                <h2 id={compact ? 'day-close-title-v2' : 'day-close-title'} className="m-0 font-extrabold text-[17px]">{reportTitle}</h2>
                <label className="flex items-center gap-3 text-[13px]">
                  <span className="text-noorix-muted">{t('date')}</span>
                  <Input
                    type="date"
                    value={dateStr}
                    onChange={(e) => setDateStr(e.target.value)}
                    className="rounded-lg py-1 px-2 border border-noorix-border"
                  />
                </label>
                <Button size="sm" onClick={() => refetch()} disabled={isFetching}>
                  {t('dayCloseRefresh')}
                </Button>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button
                  size="sm"
                  onClick={() => {
                    setMultiDayPrint(null);
                    requestAnimationFrame(() => window.print());
                  }}
                >
                  {t('dayClosePrint')}
                </Button>
                <Button size="sm" onClick={onClose}>
                  {t('dayCloseClose')}
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-3 pt-1 border-t border-noorix-border border-dashed">
              <span className="text-[12px] font-bold text-noorix-text">{t('dayClosePrintRangeSection')}</span>
              <label className="flex items-center gap-2 text-[13px]">
                <span className="text-noorix-muted">{t('dayClosePrintRangeFrom')}</span>
                <Input
                  type="date"
                  value={rangeFrom}
                  onChange={(e) => setRangeFrom(e.target.value)}
                  className="rounded-lg py-1 px-2 border border-noorix-border"
                />
              </label>
              <label className="flex items-center gap-2 text-[13px]">
                <span className="text-noorix-muted">{t('dayClosePrintRangeTo')}</span>
                <Input
                  type="date"
                  value={rangeTo}
                  onChange={(e) => setRangeTo(e.target.value)}
                  className="rounded-lg py-1 px-2 border border-noorix-border"
                />
              </label>
              <Button size="sm" variant="primary" onClick={handlePrintRange} disabled={rangePrintLoading}>
                {rangePrintLoading ? t('dayClosePrintRangeLoading') : t('dayClosePrintRange')}
              </Button>
            </div>
          </div>

          {isLoading && (
            <p className="m-0 text-[13px] text-noorix-muted">{t('dayCloseLoading')}</p>
          )}
          {isError && (
            <p className="m-0 text-[13px]" style={{ color: 'var(--noorix-accent-red)' }}>{error?.message || t('dayCloseLoadFailed')}</p>
          )}

          {data && !isLoading && (
            <div className="day-close-single-print">
              <div className="day-close-print-only dc-print-block">
                <header className="dc-print-header">
                  <p className="dc-print-header__co">{companyName || '—'}</p>
                  <p className="dc-print-header__doc">{reportTitle}</p>
                  <p className="dc-print-header__date">{t('dayCloseReportDate')}: {reportDateLabel}</p>
                </header>
              </div>
              <DayCloseReportBody
                data={data}
                kindLabel={kindLabel}
                t={t}
                reportDateLabel={reportDateLabel}
                lang={lang}
                compact={compact}
              />
            </div>
          )}

          {multiDayPrint && multiDayPrint.length > 0 && (
            <div className="day-close-multi-print" aria-hidden>
              {multiDayPrint.map((item, idx) => (
                <div
                  key={item.date}
                  className={cn(idx > 0 && 'day-close-multi-day--break')}
                >
                  <div className="day-close-print-only dc-print-block">
                    <header className="dc-print-header">
                      <p className="dc-print-header__co">{companyName || '—'}</p>
                      <p className="dc-print-header__doc">{reportTitle}</p>
                      <p className="dc-print-header__date">
                        {t('dayCloseReportDate')}: {formatSaudiDateISO(`${item.date}T12:00:00.000Z`)}
                      </p>
                    </header>
                  </div>
                  <DayCloseReportBody
                    data={item.data}
                    kindLabel={kindLabel}
                    t={t}
                    reportDateLabel={formatSaudiDateISO(`${item.date}T12:00:00.000Z`)}
                    lang={lang}
                    compact={compact}
                  />
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </Modal>
  );
}
