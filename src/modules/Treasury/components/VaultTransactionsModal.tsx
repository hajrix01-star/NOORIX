import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { getVaultTransactions, throwIfApiFailed } from '../../../services/api';
import { useApiQuery } from '../../../hooks/useApiQuery';
import { useToast } from '../../../context/ToastContext';
import { useApp } from '../../../context/AppContext';
import { useTranslation } from '../../../i18n/useTranslation';
import { formatSaudiDate } from '../../../utils/saudiDate';
import { fmt } from '../../../utils/format';
import { vaultDisplayName } from '../../../utils/vaultDisplay';
import { exportToExcel } from '../../../utils/exportUtils';
import { buildPrintHtmlTable } from '../../../utils/printTableHtml';
import { vaultKeys } from '../../../services/queryKeys';
import { Button, AdaptiveSheet, FmtNum, SmartTable, usePrintPreview } from '../../../ui';
import type { SmartTableColumn } from '../../../ui';
import type {
  VaultRecord,
  VaultTransactionRecord,
  VaultTransactionsPage,
  VaultTransactionViewRow,
  VaultWithTransactionsResult,
} from '../../../types/api';
import { normalizeVaultTransactions } from '../treasuryModels';

const PAGE_SIZE = 50;
const EXPORT_PAGE_SIZE = 10000;

type TreasuryDateFilter = {
  startDate?: string | null;
  endDate?: string | null;
  label?: string;
};

type VaultTransactionsModalProps = {
  vault: VaultRecord;
  companyId: string;
  onClose: () => void;
  dateFilter: TreasuryDateFilter;
};

function emptyTransactionsPage(page: number): VaultTransactionsPage {
  return {
    items: [],
    total: 0,
    page,
    pageSize: PAGE_SIZE,
    periodTotalIn: 0,
    periodTotalOut: 0,
    periodBalance: 0,
  };
}

function unwrapTransactionsPage(payload: VaultWithTransactionsResult | VaultTransactionsPage | undefined, page: number): VaultTransactionsPage {
  if (!payload) return emptyTransactionsPage(page);
  if ('transactions' in payload) return payload.transactions;
  return payload;
}

export default function VaultTransactionsModal({
  vault,
  companyId,
  onClose,
  dateFilter,
}: VaultTransactionsModalProps) {
  const { t, lang } = useTranslation();
  const { companies = [] } = useApp();
  const { showToast } = useToast();
  const [page, setPage] = useState(1);

  const startDate = dateFilter?.startDate || '';
  const endDate = dateFilter?.endDate || '';
  const periodLabel = dateFilter?.label || '';
  const hasOfficialPeriod = !!(startDate && endDate);
  const activeCompany = companies.find((company) => company.id === companyId);
  const companyName = lang === 'en'
    ? (activeCompany?.nameEn || activeCompany?.nameAr || '')
    : (activeCompany?.nameAr || activeCompany?.nameEn || '');
  const companyLogoUrl = String(activeCompany?.logoUrl || '').trim();
  const { openPrintDocumentPreview, printPreviewModal } = usePrintPreview({
    title: t('transactions'),
    closeLabel: t('close') || 'إغلاق',
    printLabel: `${t('print')} / PDF`,
  });

  useEffect(() => { setPage(1); }, [startDate, endDate]);

  const { data: transactionsPage, isLoading, isError, error } = useApiQuery<VaultTransactionsPage, VaultTransactionsPage>({
    queryKey: vaultKeys.transactions(vault.id, companyId, startDate, endDate, page),
    queryFn: async () => {
      const res = await getVaultTransactions(vault.id, companyId, startDate, endDate, page, PAGE_SIZE);
      if (!res.success) return { success: false, error: res.error };
      return { success: true, data: unwrapTransactionsPage(res.data, page) };
    },
    enabled: !!(vault.id && companyId && hasOfficialPeriod),
    fallbackMessage: t('loadDataFailed'),
  });
  const data = transactionsPage ?? emptyTransactionsPage(page);

  const formatVaultTransactionNotes = useCallback(
    (row: VaultTransactionRecord) => {
      const parts: string[] = [];
      if (row.operationNotes) parts.push(String(row.operationNotes));
      if (row.referenceType === 'transfer' && row.transferToVaultId) {
        const name = vaultDisplayName(
          { nameAr: row.transferToVaultNameAr, nameEn: row.transferToVaultNameEn },
          lang,
        );
        if (name) parts.push(t('vaultTransactionTransferDestination', { 0: name }));
      }
      return parts.length ? parts.join(' - ') : null;
    },
    [t, lang],
  );

  const items = useMemo(
    () => normalizeVaultTransactions(data.items, vault.accountId, formatVaultTransactionNotes),
    [data.items, vault.accountId, formatVaultTransactionNotes],
  );

  const handleExportExcel = useCallback(async () => {
    try {
      const res = await getVaultTransactions(vault.id, companyId, startDate, endDate, 1, EXPORT_PAGE_SIZE);
      throwIfApiFailed(res, t('loadDataFailed'));
      const allPage = unwrapTransactionsPage(res.data, 1);
      const mapped = normalizeVaultTransactions(allPage.items, vault.accountId, formatVaultTransactionNotes);
      const rows = mapped.map((row) => ({
        [t('documentNumber')]: row.documentNumber || row.referenceId || '-',
        [t('date')]: formatSaudiDate(row.transactionDate),
        [t('type')]: row.referenceType || '-',
        [t('notes')]: row.notesDisplay || '-',
        [t('debit')]: row.debit != null ? Number(row.debit) : null,
        [t('credit')]: row.credit != null ? Number(row.credit) : null,
      }));
      if (rows.length > 0) {
        rows.push({
          [t('documentNumber')]: '',
          [t('date')]: '',
          [t('type')]: t('total'),
          [t('notes')]: '',
          [t('debit')]: allPage.periodTotalIn,
          [t('credit')]: allPage.periodTotalOut,
        });
      }
      exportToExcel(rows, `vault-transactions-${vault.nameAr || vault.id}-${(periodLabel || 'export').replace(/\s/g, '-')}.xlsx`);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : t('loadDataFailed'), 'error');
    }
  }, [vault.id, vault.accountId, vault.nameAr, companyId, startDate, endDate, periodLabel, t, formatVaultTransactionNotes, showToast]);

  const handlePrintPdf = () => {
    const vaultName = vaultDisplayName(vault, lang) || '';
    openPrintDocumentPreview({
      title: `${vaultName} - ${t('transactions')}`,
      companyName: companyName || vaultName,
      logoUrl: companyLogoUrl,
      subtitle: `${vaultName} - ${t('transactions')}${periodLabel ? ` - ${periodLabel}` : ''}`,
      body: buildPrintHtmlTable({
        wrapperClassName: null,
        emptyMessage: t('noDataInPeriod'),
        emptyColSpan: 6,
        headerRows: [{
          cells: [
            { value: t('documentNumber') },
            { value: t('date') },
            { value: t('type') },
            { value: t('notes') },
            { value: t('debit'), align: 'end' },
            { value: t('credit'), align: 'end' },
          ],
        }],
        bodyRows: items.map((row) => ({
          cells: [
            { value: row.documentNumber || row.referenceId || '-' },
            { value: formatSaudiDate(row.transactionDate) },
            { value: row.referenceType === 'transfer' ? t('vaultLedgerTypeTransfer') : (row.referenceType || '-') },
            { value: row.notesDisplay || '-' },
            { value: row.debit != null ? fmt(row.debit) : '-', align: 'end' },
            { value: row.credit != null ? fmt(row.credit) : '-', align: 'end' },
          ],
        })),
        footerRows: items.length
          ? [{
              cells: [
                { value: t('total'), colSpan: 4 },
                { value: fmt(data.periodTotalIn), align: 'end' },
                { value: fmt(data.periodTotalOut), align: 'end' },
              ],
            }]
          : [],
      }),
    });
  };

  const columns: SmartTableColumn<VaultTransactionViewRow>[] = [
    { key: 'documentNumber', label: t('documentNumber'), render: (_value, row) => <span className="nx-cell-num">{row.documentNumber || row.referenceId || '-'}</span> },
    { key: 'transactionDate', label: t('date'), render: (value) => <span className="text-[12px]">{formatSaudiDate(String(value || ''))}</span> },
    {
      key: 'referenceType',
      label: t('type'),
      render: (value) => (
        <span className="text-[12px]">
          {value === 'transfer' ? t('vaultLedgerTypeTransfer') : (String(value || '-') || '-')}
        </span>
      ),
    },
    {
      key: 'notesDisplay',
      label: t('notes'),
      render: (_value, row) => (
        <span className="text-[12px] text-noorix-text max-w-[min(280px,40vw)] whitespace-normal break-words">
          {row.notesDisplay || '-'}
        </span>
      ),
    },
    { key: 'debit', label: t('debit'), numeric: true, render: (value) => value != null ? <FmtNum n={Number(value)} className="text-noorix-green nx-font-numbers" /> : <span>-</span> },
    { key: 'credit', label: t('credit'), numeric: true, render: (value) => value != null ? <FmtNum n={Number(value)} className="text-noorix-red nx-font-numbers" /> : <span>-</span> },
  ];

  const renderMobileCard = useCallback((row: VaultTransactionViewRow) => (
    <div>
      <div className="flex flex items-center justify-between mb-1">
        <span className="font-bold text-[13px] nx-font-numbers">{row.documentNumber || row.referenceId || '-'}</span>
        <span className="text-[12px] text-noorix-muted">{formatSaudiDate(row.transactionDate)}</span>
      </div>
      {row.referenceType ? (
        <div className="text-[12px] text-noorix-muted mb-2">
          {row.referenceType === 'transfer' ? t('vaultLedgerTypeTransfer') : row.referenceType}
        </div>
      ) : null}
      {row.notesDisplay ? (
        <div className="text-[12px] text-noorix-text mb-2 whitespace-pre-wrap break-words">
          <span className="text-noorix-muted">{t('notes')}: </span>
          {row.notesDisplay}
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-noorix-bg-muted py-2 px-[10px]">
        <div>
          <div className="text-noorix-muted mb-1 text-[10px]">{t('debit')}</div>
          <div className="text-[14px] font-bold text-noorix-green nx-font-numbers">{row.debit != null ? fmt(row.debit) : '-'}</div>
        </div>
        <div>
          <div className="text-noorix-muted mb-1 text-[10px]">{t('credit')}</div>
          <div className="text-[14px] font-bold text-noorix-red nx-font-numbers">{row.credit != null ? fmt(row.credit) : '-'}</div>
        </div>
      </div>
    </div>
  ), [t]);

  const footerCells = items.length > 0 ? (
    <>
      <td colSpan={5} className="font-bold p-2.5 bg-noorix-blue/6 border-t-2 border-noorix-border">{t('total')}</td>
      <td className="font-bold text-end p-2.5 text-noorix-green nx-font-numbers bg-noorix-blue/6 border-t-2 border-noorix-border"><FmtNum n={data.periodTotalIn} /></td>
      <td className="font-bold text-end p-2.5 text-noorix-red nx-font-numbers bg-noorix-blue/6 border-t-2 border-noorix-border"><FmtNum n={data.periodTotalOut} /></td>
    </>
  ) : null;

  const isPaginatedTotal = data.total > items.length;
  const modalTitle = `${vaultDisplayName(vault, lang)} - ${t('transactions')}${periodLabel ? ` (${periodLabel})` : ''}`;

  return (
    <AdaptiveSheet
      open
      onClose={onClose}
      title={modalTitle}
      size="xl"
      side="start"
      className="vault-transactions-drawer"
    >
      {printPreviewModal}
      <div className="nx-toolbar mb-4">
        <Button size="sm" onClick={handleExportExcel} disabled={!data.total || !hasOfficialPeriod}>Excel</Button>
        <Button size="sm" onClick={handlePrintPdf} disabled={!items.length}>{t('print')} / PDF</Button>
      </div>

      {!hasOfficialPeriod ? (
        <div className="noorix-surface-card mb-3 px-3 py-2 text-[12px] leading-[1.5] text-noorix-muted">
          {t('selectDateRange')}
        </div>
      ) : null}

      {isPaginatedTotal ? (
        <div className="noorix-surface-card mb-3 px-3 py-1.5 text-[12px] leading-[1.5] text-noorix-muted">
          {t('vaultTransactionsPeriodTotalsNote', String(data.total))}
        </div>
      ) : null}

      <SmartTable
        columns={columns}
        data={items}
        showRowNumbers
        total={data.total}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        isLoading={isLoading}
        isError={isError}
        errorMessage={error?.message || t('loadDataFailed')}
        title=""
        emptyMessage={t('noDataInPeriod')}
        footerCells={footerCells}
        renderMobileCard={renderMobileCard}
      />
    </AdaptiveSheet>
  );
}
