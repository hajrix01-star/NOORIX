import React, { useMemo, useState } from 'react';
import { useApiQuery } from '../../../hooks/useApiQuery';
import { useTranslation } from '../../../i18n/useTranslation';
import { getExpenseLine, getExpenseLinePayments } from '../../../services/api';
import { expenseKeys } from '../../../services/queryKeys';
import { formatSaudiDate } from '../../../utils/saudiDate';
import { exportToExcel, exportTableToPdf } from '../../../utils/exportUtils';
import { buildPrintRecordsTableHtml } from '../../../utils/printTableHtml';
import { openPrintWindow } from '../../../utils/printUtils';
import { Button, AdaptiveSheet, FmtNum, SmartTable } from '../../../ui';
import type { SmartTableColumn } from '../../../ui';
import { useApp } from '../../../context/AppContext';
import type { ExpenseLinePaymentsPage, ExpenseLineRecord, ExpenseLinePaymentRecord } from '../../../types/api';
import {
  buildExpensePaymentExportRows,
  expenseCategoryDisplayName,
  expenseLineDisplayName,
  expenseLineKindLabel,
  expenseSupplierDisplayName,
  formatExpenseCoverage,
  formatExpenseSummarySubtitle,
  summarizeExpensePaymentsFromBackend,
} from '../expenseModels';

type ExpenseLineDetailModalProps = {
  lineId: string;
  companyId: string;
  onClose: () => void;
  dateFilter: {
    startDate?: string | null;
    endDate?: string | null;
  };
  onRefresh: () => void;
};

export default function ExpenseLineDetailModal({
  lineId,
  companyId,
  onClose,
  dateFilter,
}: ExpenseLineDetailModalProps) {
  const { t, lang } = useTranslation();
  const { activeCompanyId, companies = [] } = useApp();
  const activeCompany = companies.find((company) => company.id === (companyId || activeCompanyId));
  const companyName = activeCompany?.nameAr || activeCompany?.name || '';
  const [page, setPage] = useState(1);

  const { data: lineData, isLoading: lineLoading } = useApiQuery<ExpenseLineRecord>({
    queryKey: expenseKeys.line(lineId, companyId),
    queryFn: () => getExpenseLine(lineId, companyId),
    enabled: !!lineId && !!companyId,
    fallbackMessage: t('loadingError'),
  });

  const { data: paymentsData, isLoading: paymentsLoading } = useApiQuery<ExpenseLinePaymentsPage>({
    queryKey: expenseKeys.linePayments(lineId, companyId, dateFilter?.startDate || undefined, dateFilter?.endDate || undefined, page),
    queryFn: () => getExpenseLinePayments(lineId, companyId, dateFilter?.startDate || undefined, dateFilter?.endDate || undefined, page, 20),
    enabled: !!lineId && !!companyId,
    fallbackMessage: t('loadingError'),
  });

  const line = lineData;
  const payments = paymentsData?.items ?? [];
  const periodSummary = summarizeExpensePaymentsFromBackend(paymentsData?.periodSummary);

  const paymentColumns = useMemo<SmartTableColumn<ExpenseLinePaymentRecord>[]>(() => [
    { key: 'invoiceNumber', label: t('documentNumber'), render: (_value, row) => <span className="nx-cell-num font-semibold">{row.invoiceNumber || '-'}</span> },
    { key: 'supplierInvoiceNumber', label: t('supplierInvoiceNumber'), render: (_value, row) => <span className="nx-cell-num nx-cell-muted">{row.supplierInvoiceNumber || '-'}</span> },
    { key: 'transactionDate', label: t('date'), render: (value) => <span className="nx-cell-muted">{value ? formatSaudiDate(value) : '-'}</span> },
    { key: 'coverage', label: t('expenseCoverageColumn'), render: (_value, row) => <span className="nx-cell-muted ltr">{formatExpenseCoverage(row)}</span> },
    { key: 'totalAmount', label: t('amount'), render: (value) => <FmtNum n={Number(value || 0)} className="nx-cell-num nx-cell-num--green font-semibold" /> },
    { key: 'vaultName', label: t('invoiceVaultColumn'), render: (_value, row) => <span className="nx-cell-muted">{row.vaultName || row.vault?.nameAr || row.vault?.nameEn || '-'}</span> },
    { key: 'notes', label: t('notes'), render: (value) => <span className="nx-cell-ellipsis">{String(value || '-')}</span> },
  ], [t]);

  const paymentExportData = useMemo(
    () =>
      buildExpensePaymentExportRows(payments, lang, {
        documentNumber: t('documentNumber'),
        supplierInvoiceNumber: t('supplierInvoiceNumber'),
        supplier: t('supplier'),
        expenseLine: t('expenseLineNameCol'),
        kind: t('expenseLineKindCol'),
        date: t('date'),
        coverage: t('expenseCoverageColumn'),
        net: t('expenseTaxBreakdownNet'),
        tax: t('expenseTaxBreakdownVat'),
        total: t('total'),
        vault: t('invoiceVaultColumn'),
        notes: t('notes'),
      }),
    [payments, lang, t],
  );

  const lineName = line ? expenseLineDisplayName(line, lang) : '-';
  const printTitle = `${t('paymentHistoryTab')} - ${lineName}`;

  function handlePrintPayments() {
    openPrintWindow({
      title: printTitle,
      companyName,
      subtitle: formatExpenseSummarySubtitle(printTitle, periodSummary),
      body: buildPrintRecordsTableHtml({
        records: paymentExportData,
        emptyMessage: t('noDataInPeriod'),
        numericKeys: [t('expenseTaxBreakdownNet'), t('expenseTaxBreakdownVat'), t('total')],
      }),
    });
  }

  const modalTitle = lineLoading ? t('loading') : lineName;

  return (
    <AdaptiveSheet open onClose={onClose} title={modalTitle} size="xl" side="start" className="expense-line-detail-drawer">
      <div className="flex flex-wrap gap-3 text-[13px] text-noorix-muted mb-4">
        <span>{t('expenseLineKindCol')}: {expenseLineKindLabel(line?.kind, lang)}</span>
        <span>{t('category')}: {expenseCategoryDisplayName(line?.category, lang)}</span>
        <span>{t('supplier')}: {expenseSupplierDisplayName(line?.supplier, lang)}</span>
        {line?.serviceNumber ? <span>{t('expenseLineServiceNumberCol')}: {line.serviceNumber}</span> : null}
        {line?.referenceAmount != null && line.referenceAmount !== '' ? (
          <span className="text-noorix-text font-medium">
            {t('expenseLineReferenceLabelShort')}: <FmtNum n={Number(line.referenceAmount)} className="nx-font-numbers" /> <span className="nx-sar">SR</span>
            {line.allowPaymentAmountOverride === false ? <span className="text-[11px] text-noorix-amber ms-1">{t('expenseLineAmountFixedAtPayment')}</span> : null}
          </span>
        ) : null}
        {line?.kind === 'fixed_expense' && line.annualTotalAmount != null ? (
          <span className="text-noorix-text">
            {t('expenseLineAnnualTotal')}: <FmtNum n={Number(line.annualTotalAmount)} className="nx-font-numbers" /> <span className="nx-sar">SR</span>
            {line.installmentIntervalMonths != null ? <span className="text-noorix-muted ms-1">· {line.installmentIntervalMonths}</span> : null}
          </span>
        ) : null}
      </div>

      <div className="nx-page-header mb-3">
        <h3 className="text-[16px] font-semibold m-0">{t('paymentHistoryTab')}</h3>
        <div className="nx-toolbar">
          <Button size="sm" onClick={handlePrintPayments} disabled={!payments.length}>{t('print')}</Button>
          <Button size="sm" onClick={() => exportToExcel(paymentExportData, `payments-${lineName}.xlsx`)} disabled={!payments.length}>Excel</Button>
          <Button size="sm" onClick={() => exportTableToPdf({ data: paymentExportData, title: printTitle, companyName, filename: `payments-${lineName}.pdf` })} disabled={!payments.length}>{t('print')} / PDF</Button>
        </div>
      </div>

      {dateFilter?.startDate ? (
        <p className="text-[12px] text-noorix-muted mt-0 mb-3">
          {t('period')}: {formatSaudiDate(dateFilter.startDate)} - {dateFilter.endDate ? formatSaudiDate(dateFilter.endDate) : '-'}
        </p>
      ) : null}
      <p className="text-[14px] font-semibold mt-0 mb-4">
        {t('total')}: <FmtNum n={periodSummary.totalAmount} className="nx-cell-num nx-cell-num--green" /> <span className="text-[12px] text-noorix-muted">({periodSummary.count})</span>
      </p>
      <SmartTable
        columns={paymentColumns}
        data={payments}
        showRowNumbers
        rowNumberWidth="1%"
        total={paymentsData?.total ?? 0}
        page={page}
        pageSize={paymentsData?.pageSize ?? 20}
        onPageChange={setPage}
        isLoading={paymentsLoading}
        emptyMessage={t('paymentHistoryEmptyExpenseModule')}
        keyExtractor={(row) => row.id}
      />
    </AdaptiveSheet>
  );
}
