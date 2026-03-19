/**
 * VaultTransactionsModal — عرض حركات الخزنة مع ترقيم + فلترة زمنية + تصدير Excel وطباعة PDF
 * الترقيم: 50 صف/صفحة. الفلترة الزمنية إلزامية (من DateFilterBar في الشاشة الأم).
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getVaultTransactions } from '../../../services/api';
import { useTranslation } from '../../../i18n/useTranslation';
import { formatSaudiDate } from '../../../utils/saudiDate';
import { fmt } from '../../../utils/format';
import { vaultDisplayName } from '../../../utils/vaultDisplay';
import { exportToExcel } from '../../../utils/exportUtils';
import SmartTable from '../../../components/common/SmartTable';

const PAGE_SIZE = 50;

export default function VaultTransactionsModal({ vault, companyId, onClose, dateFilter }) {
  const { t, lang } = useTranslation();
  const [page, setPage] = useState(1);
  const { startDate, endDate, periodLabel } = useMemo(() => {
    if (dateFilter?.startDate && dateFilter?.endDate) {
      return { startDate: dateFilter.startDate, endDate: dateFilter.endDate, periodLabel: dateFilter.label || '' };
    }
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const d = now.getDate();
    const pad = (n) => String(n).padStart(2, '0');
    const first = `${y}-${pad(m)}-01`;
    const last = `${y}-${pad(m)}-${pad(new Date(y, m, 0).getDate())}`;
    return { startDate: `${first}T00:00:00+03:00`, endDate: `${last}T23:59:59+03:00`, periodLabel: '' };
  }, [dateFilter]);

  useEffect(() => { setPage(1); }, [startDate, endDate]);

  const { data, isLoading } = useQuery({
    queryKey: ['vault-transactions', vault?.id, companyId, startDate, endDate, page],
    queryFn: async () => {
      const res = await getVaultTransactions(vault?.id, companyId, startDate, endDate, page, PAGE_SIZE);
      if (!res?.success) return { items: [], total: 0, page: 1, pageSize: PAGE_SIZE };
      const d = res.data;
      const tx = d?.transactions;
      if (tx?.items) return { items: tx.items, total: tx.total ?? 0, page: tx.page ?? 1, pageSize: tx.pageSize ?? PAGE_SIZE };
      const arr = Array.isArray(d) ? d : (d?.items ?? []);
      return { items: arr, total: arr.length, page: 1, pageSize: PAGE_SIZE };
    },
    enabled: !!(vault?.id && companyId && startDate && endDate),
  });

  const accountId = vault?.accountId;
  const items = (data?.items ?? []).map((row) => {
    const amt = Number(row.amount ?? 0);
    const isDebit = row.debitAccountId === accountId;
    return {
      ...row,
      debit: isDebit ? amt : null,
      credit: !isDebit ? amt : null,
    };
  });

  const totalDebit = useMemo(() => {
    if (vault?.totalIn != null && (data?.total ?? 0) > items.length) return Number(vault.totalIn);
    return items.reduce((s, r) => s + (r.debit ?? 0), 0);
  }, [items, vault?.totalIn, data?.total]);
  const totalCredit = useMemo(() => {
    if (vault?.totalOut != null && (data?.total ?? 0) > items.length) return Number(vault.totalOut);
    return items.reduce((s, r) => s + (r.credit ?? 0), 0);
  }, [items, vault?.totalOut, data?.total]);

  const handleExportExcel = useCallback(async () => {
    const res = await getVaultTransactions(vault?.id, companyId, startDate, endDate, 1, 10000);
    if (!res?.success) return;
    const tx = res.data?.transactions;
    const allItems = tx?.items ?? [];
    const accId = vault?.accountId;
    const mapped = allItems.map((row) => {
      const amt = Number(row.amount ?? 0);
      const isDebit = row.debitAccountId === accId;
      return { ...row, debit: isDebit ? amt : null, credit: !isDebit ? amt : null };
    });
    const totDebit = mapped.reduce((s, r) => s + (r.debit ?? 0), 0);
    const totCredit = mapped.reduce((s, r) => s + (r.credit ?? 0), 0);
    const rows = mapped.map((r) => ({
      [t('documentNumber')]: r.documentNumber || r.referenceId || '—',
      [t('date')]: formatSaudiDate(r.transactionDate),
      [t('type')]: r.referenceType || '—',
      [t('debit')]: r.debit != null ? Number(r.debit) : null,
      [t('credit')]: r.credit != null ? Number(r.credit) : null,
    }));
    if (rows.length > 0) {
      rows.push({ [t('documentNumber')]: '', [t('date')]: '', [t('type')]: t('total'), [t('debit')]: totDebit, [t('credit')]: totCredit });
    }
    exportToExcel(rows, `vault-transactions-${vault?.nameAr || vault?.id}-${(periodLabel || 'export').replace(/\s/g, '-')}.xlsx`);
  }, [vault?.id, vault?.accountId, vault?.nameAr, companyId, startDate, endDate, periodLabel, t]);

  const handlePrintPdf = () => {
    const docNumKey = t('documentNumber');
    const dateKey = t('date');
    const typeKey = t('type');
    const debitKey = t('debit');
    const creditKey = t('credit');
    const rows = items.map((r) =>
      `<tr><td>${(r.documentNumber || r.referenceId || '—').replace(/</g, '&lt;')}</td><td>${formatSaudiDate(r.transactionDate).replace(/</g, '&lt;')}</td><td>${(r.referenceType || '—').replace(/</g, '&lt;')}</td><td style="text-align:right;font-family:Cairo">${r.debit != null ? fmt(r.debit, 2) : '—'}</td><td style="text-align:right;font-family:Cairo">${r.credit != null ? fmt(r.credit, 2) : '—'}</td></tr>`,
    ).join('');
    const totalRow = `<tr style="font-weight:700;background:rgba(37,99,235,0.08)"><td colspan="3">${t('total').replace(/</g, '&lt;')}</td><td style="text-align:right;font-family:Cairo">${fmt(totalDebit, 2)}</td><td style="text-align:right;font-family:Cairo">${fmt(totalCredit, 2)}</td></tr>`;
    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${(t('transactions') || '').replace(/</g, '&lt;')}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>@page{size:A4;margin:15mm}*{box-sizing:border-box}body{font-family:'Cairo',Arial,sans-serif;margin:0;padding:24px;font-size:14px;line-height:1.6}table{width:100%;border-collapse:collapse;font-size:14px}td,th{padding:8px 12px;border:1px solid #ddd;text-align:right}th{background:#2563eb;color:#fff;font-weight:700}.header{text-align:center;border-bottom:2px solid #333;padding-bottom:16px;margin-bottom:24px}@media print{body{padding:0}}</style></head><body>
<div class="header"><h1 style="margin:0;font-size:20px">${(vaultDisplayName(vault, lang) || '').replace(/</g, '&lt;')} — ${(t('transactions') || '').replace(/</g, '&lt;')}${periodLabel ? ` (${periodLabel.replace(/</g, '&lt;')})` : ''}</h1></div>
<table><thead><tr><th>${docNumKey.replace(/</g, '&lt;')}</th><th>${dateKey.replace(/</g, '&lt;')}</th><th>${typeKey.replace(/</g, '&lt;')}</th><th>${debitKey.replace(/</g, '&lt;')}</th><th>${creditKey.replace(/</g, '&lt;')}</th></tr></thead><tbody>${rows || '<tr><td colspan="5">' + (t('noDataInPeriod') || '').replace(/</g, '&lt;') + '</td></tr>'}${rows ? totalRow : ''}</tbody></table></body></html>`;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      w.onafterprint = () => { try { w.close(); } catch (_) {} };
      w.onload = () => setTimeout(() => w.print(), 300);
    }
  };

  const columns = [
    { key: 'documentNumber', label: t('documentNumber'), render: (_, r) => <span style={{ fontSize: 12, fontFamily: 'var(--noorix-font-numbers)' }}>{r.documentNumber || r.referenceId || '—'}</span> },
    { key: 'transactionDate', label: t('date'), render: (v) => <span style={{ fontSize: 12 }}>{formatSaudiDate(v)}</span> },
    { key: 'referenceType', label: t('type'), render: (v) => <span style={{ fontSize: 12 }}>{v || '—'}</span> },
    { key: 'debit', label: t('debit'), numeric: true, render: (v) => v != null ? <span style={{ fontFamily: 'var(--noorix-font-numbers)', color: '#16a34a' }}>{fmt(v)}</span> : <span>—</span> },
    { key: 'credit', label: t('credit'), numeric: true, render: (v) => v != null ? <span style={{ fontFamily: 'var(--noorix-font-numbers)', color: '#dc2626' }}>{fmt(v)}</span> : <span>—</span> },
  ];

  const footerCells = items.length > 0 ? (
    <>
      <td colSpan={4} style={{ padding: '10px 12px', fontWeight: 700, background: 'rgba(37,99,235,0.06)', borderTop: '2px solid var(--noorix-border)' }}>{t('total')}</td>
      <td style={{ padding: '10px 12px', fontWeight: 700, fontFamily: 'var(--noorix-font-numbers)', color: '#16a34a', textAlign: 'right', background: 'rgba(37,99,235,0.06)', borderTop: '2px solid var(--noorix-border)' }}>{fmt(totalDebit, 2)}</td>
      <td style={{ padding: '10px 12px', fontWeight: 700, fontFamily: 'var(--noorix-font-numbers)', color: '#dc2626', textAlign: 'right', background: 'rgba(37,99,235,0.06)', borderTop: '2px solid var(--noorix-border)' }}>{fmt(totalCredit, 2)}</td>
    </>
  ) : null;

  return (
    <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }} onClick={onClose}>
      <div className="noorix-surface-card" style={{ maxWidth: 720, width: '100%', maxHeight: '90vh', overflow: 'auto', padding: 20 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>{vault ? vaultDisplayName(vault, lang) : t('vaults')} — {t('transactions')}{periodLabel ? ` (${periodLabel})` : ''}</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button type="button" className="noorix-btn-nav" onClick={handleExportExcel} disabled={!(data?.total ?? 0)}>📥 Excel</button>
            <button type="button" className="noorix-btn-nav" onClick={handlePrintPdf} disabled={!items.length}>📄 PDF</button>
            <button type="button" className="noorix-btn-nav" onClick={onClose}>{t('close')}</button>
          </div>
        </div>
        <SmartTable
          columns={columns}
          data={items}
          showRowNumbers
          rowNumberWidth="1%"
          total={data?.total ?? 0}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          isLoading={isLoading}
          title=""
          emptyMessage={t('noDataInPeriod')}
          footerCells={footerCells}
        />
      </div>
    </div>
  );
}
