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
import { openPrintWindow } from '../../../utils/printUtils';
import { Button, AdaptiveSheet , FmtNum, SmartTable } from '../../../ui';

const PAGE_SIZE = 50;

export default function VaultTransactionsModal({ vault, companyId, onClose, dateFilter }: any) {
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
    const pad = (n: any) => String(n).padStart(2, '0');
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

  const formatVaultTransactionNotes = useCallback(
    (row: any) => {
      const parts = [];
      if (row.operationNotes) parts.push(String(row.operationNotes));
      if (row.referenceType === 'transfer' && row.transferToVaultId) {
        const name = vaultDisplayName(
          { nameAr: row.transferToVaultNameAr, nameEn: row.transferToVaultNameEn },
          lang,
        );
        if (name) parts.push(t('vaultTransactionTransferDestination', { 0: name }));
      }
      return parts.length ? parts.join(' — ') : null;
    },
    [t, lang],
  );

  const items = (data?.items ?? []).map((row: any) => {
    const amt = Number(row.amount ?? 0);
    const isDebit = row.debitAccountId === accountId;
    return {
      ...row,
      debit: isDebit ? amt : null,
      credit: !isDebit ? amt : null,
      notesDisplay: formatVaultTransactionNotes(row),
    };
  });

  const totalDebit = useMemo(() => {
    if (vault?.totalIn != null && (data?.total ?? 0) > items.length) return Number(vault.totalIn);
    return items.reduce((s: any, r: any) => s + (r.debit ?? 0), 0);
  }, [items, vault?.totalIn, data?.total]);
  const totalCredit = useMemo(() => {
    if (vault?.totalOut != null && (data?.total ?? 0) > items.length) return Number(vault.totalOut);
    return items.reduce((s: any, r: any) => s + (r.credit ?? 0), 0);
  }, [items, vault?.totalOut, data?.total]);

  const handleExportExcel = useCallback(async () => {
    const res = await getVaultTransactions(vault?.id, companyId, startDate, endDate, 1, 10000);
    if (!res?.success) return;
    const tx = res.data?.transactions;
    const allItems = tx?.items ?? [];
    const accId = vault?.accountId;
    const mapped = allItems.map((row: any) => {
      const amt = Number(row.amount ?? 0);
      const isDebit = row.debitAccountId === accId;
      return { ...row, debit: isDebit ? amt : null, credit: !isDebit ? amt : null };
    });
    const totDebit = mapped.reduce((s: any, r: any) => s + (r.debit ?? 0), 0);
    const totCredit = mapped.reduce((s: any, r: any) => s + (r.credit ?? 0), 0);
    const rows = mapped.map((r: any) => ({
      [t('documentNumber')]: r.documentNumber || r.referenceId || '—',
      [t('date')]: formatSaudiDate(r.transactionDate),
      [t('type')]: r.referenceType || '—',
      [t('notes')]: formatVaultTransactionNotes(r) || '—',
      [t('debit')]: r.debit != null ? Number(r.debit) : null,
      [t('credit')]: r.credit != null ? Number(r.credit) : null,
    }));
    if (rows.length > 0) {
      rows.push({
        [t('documentNumber')]: '',
        [t('date')]: '',
        [t('type')]: t('total'),
        [t('notes')]: '',
        [t('debit')]: totDebit,
        [t('credit')]: totCredit,
      });
    }
    exportToExcel(rows, `vault-transactions-${vault?.nameAr || vault?.id}-${(periodLabel || 'export').replace(/\s/g, '-')}.xlsx`);
  }, [vault?.id, vault?.accountId, vault?.nameAr, companyId, startDate, endDate, periodLabel, t, formatVaultTransactionNotes]);

  const handlePrintPdf = () => {
    const esc = (s: any) => String(s ?? '').replace(/</g, '&lt;');
    const rows = items.map((r: any) =>
      `<tr><td>${esc(r.documentNumber || r.referenceId || '—')}</td><td>${esc(formatSaudiDate(r.transactionDate))}</td><td>${esc(r.referenceType === 'transfer' ? t('vaultLedgerTypeTransfer') : (r.referenceType || '—'))}</td><td>${esc(r.notesDisplay || '—')}</td><td>${r.debit != null ? fmt(r.debit) : '—'}</td><td>${r.credit != null ? fmt(r.credit) : '—'}</td></tr>`,
    ).join('');
    const totalRow = rows ? `<tr><td colspan="4">${t('total')}</td><td>${fmt(totalDebit)}</td><td>${fmt(totalCredit)}</td></tr>` : '';
    const vaultName = vaultDisplayName(vault, lang) || '';
    openPrintWindow({
      title: `${vaultName} — ${t('transactions')}`,
      companyName: vaultName,
      subtitle: `${t('transactions')}${periodLabel ? ` — ${periodLabel}` : ''}`,
      body: `<table><thead><tr><th>${t('documentNumber')}</th><th>${t('date')}</th><th>${t('type')}</th><th>${t('notes')}</th><th>${t('debit')}</th><th>${t('credit')}</th></tr></thead><tbody>${rows || '<tr><td colspan="6">' + t('noDataInPeriod') + '</td></tr>'}${totalRow}</tbody></table>`,
    });
  };

  const columns = [
    { key: 'documentNumber', label: t('documentNumber'), render: (_: any, r: any) => <span className="nx-cell-num">{r.documentNumber || r.referenceId || '—'}</span> },
    { key: 'transactionDate', label: t('date'), render: (v: any) => <span className="text-[12px]">{formatSaudiDate(v)}</span> },
    {
      key: 'referenceType',
      label: t('type'),
      render: (v: any) => (
        <span className="text-[12px]">
          {v === 'transfer' ? t('vaultLedgerTypeTransfer') : (v || '—')}
        </span>
      ),
    },
    {
      key: 'notesDisplay',
      label: t('notes'),
      render: (_: any, r: any) => (
        <span className="text-[12px] text-noorix-text max-w-[min(280px,40vw)] whitespace-normal break-words">
          {r.notesDisplay || '—'}
        </span>
      ),
    },
    { key: 'debit', label: t('debit'), numeric: true, render: (v: any) => v != null ? <FmtNum n={v} className="text-noorix-green nx-font-numbers" /> : <span>—</span> },
    { key: 'credit', label: t('credit'), numeric: true, render: (v: any) => v != null ? <FmtNum n={v} className="text-noorix-red nx-font-numbers" /> : <span>—</span> },
  ];

  const renderMobileCard = useCallback((row: any) => (
    <div>
      <div className="flex flex items-center justify-between mb-1">
        <span className="font-bold text-[13px] nx-font-numbers">{row.documentNumber || row.referenceId || '—'}</span>
        <span className="text-[12px] text-noorix-muted">{formatSaudiDate(row.transactionDate)}</span>
      </div>
      {row.referenceType && (
        <div className="text-[12px] text-noorix-muted mb-2">
          {row.referenceType === 'transfer' ? t('vaultLedgerTypeTransfer') : row.referenceType}
        </div>
      )}
      {row.notesDisplay && (
        <div className="text-[12px] text-noorix-text mb-2 whitespace-pre-wrap break-words">
          <span className="text-noorix-muted">{t('notes')}: </span>
          {row.notesDisplay}
        </div>
      )}
      <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-noorix-bg-muted py-2 px-[10px]">
        <div>
          <div className="text-noorix-muted mb-1 text-[10px]">{t('debit')}</div>
          <div className="text-[14px] font-bold text-noorix-green nx-font-numbers">{row.debit != null ? fmt(row.debit) : '—'}</div>
        </div>
        <div>
          <div className="text-noorix-muted mb-1 text-[10px]">{t('credit')}</div>
          <div className="text-[14px] font-bold text-noorix-red nx-font-numbers">{row.credit != null ? fmt(row.credit) : '—'}</div>
        </div>
      </div>
    </div>
  ), [t]);

  const footerCells = items.length > 0 ? (
    <>
      <td colSpan={5} className="font-bold p-2.5 bg-noorix-blue/6 border-t-2 border-noorix-border">{t('total')}</td>
      <td className="font-bold text-end p-2.5 text-noorix-green nx-font-numbers bg-noorix-blue/6 border-t-2 border-noorix-border"><FmtNum n={totalDebit} /></td>
      <td className="font-bold text-end p-2.5 text-noorix-red nx-font-numbers bg-noorix-blue/6 border-t-2 border-noorix-border"><FmtNum n={totalCredit} /></td>
    </>
  ) : null;

  const isPaginatedTotal = vault?.totalIn != null && (data?.total ?? 0) > items.length;

  const modalTitle = `${vault ? vaultDisplayName(vault, lang) : t('vaults')} — ${t('transactions')}${periodLabel ? ` (${periodLabel})` : ''}`;

  return (
    <AdaptiveSheet
      open
      onClose={onClose}
      title={modalTitle}
      size="xl"
      side="start"
      className="vault-transactions-drawer"
    >
      <div className="nx-toolbar mb-4">
        <Button size="sm" onClick={handleExportExcel} disabled={!(data?.total ?? 0)}>Excel</Button>
        <Button size="sm" onClick={handlePrintPdf} disabled={!items.length}>طباعة / PDF</Button>
      </div>

      {isPaginatedTotal && (
        <div className="noorix-surface-card mb-3 px-3 py-1.5 text-[12px] leading-[1.5] text-noorix-muted">
          ℹ️ المجموع الظاهر في الأسفل يعكس إجمالي حركات الفترة بأكملها ({data?.total?.toLocaleString('en')} حركة)، وليس مجموع الصفحة الحالية فقط. للاطلاع على جميع الحركات استخدم تصدير Excel.
        </div>
      )}
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
        renderMobileCard={renderMobileCard}
      />
    </AdaptiveSheet>
  );
}
