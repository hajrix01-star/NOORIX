import React, { useMemo, useState } from 'react';
import { useApiQuery } from '../../../hooks/useApiQuery';
import { getInvoices, downloadInvoiceAttachment } from '../../../services/api';
import { invoiceKeys } from '../../../services/queryKeys';
import { useToast } from '../../../context/ToastContext';
import { DateFilterBar, useDateFilter } from '../../../ui/date';
import { formatSaudiDate, toYmd } from '../../../utils/saudiDate';
import { exportToExcel } from '../../../utils/exportUtils';
import { buildPrintRecordsTableHtml } from '../../../utils/printTableHtml';
import { useTranslation } from '../../../i18n/useTranslation';
import { Button, Badge, Checkbox, FilterToolbar, FmtNum, SmartTable, SearchableOptionsPicker, usePrintPreview } from '../../../ui';
import type { SmartTableColumn } from '../../../ui';
import { buildExpenseLineKindBadgeMap } from '../../../constants/badgeMaps';
import { useApp } from '../../../context/AppContext';
import type { InvoiceListItem, InvoiceListResponse } from '../../../services/domains/apiEndpoints/invoice-list-response';
import type { ExpenseLineKind } from '../../../types/api';
import {
  buildExpensePaymentExportRows,
  summarizeInvoiceListPayments,
} from '../expenseModels';

type PaymentHistoryTabProps = {
  companyId: string;
  dateFilter?: {
    startDate?: string | null;
    endDate?: string | null;
  };
};

export default function PaymentHistoryTab({ companyId, dateFilter: externalDateFilter }: PaymentHistoryTabProps) {
  const { lang, t } = useTranslation();
  const { showToast } = useToast();
  const { activeCompanyId, companies = [] } = useApp();
  const effectiveCompanyId = companyId || activeCompanyId || '';
  const activeCompany = companies.find((company) => company.id === effectiveCompanyId);
  const companyName = activeCompany?.nameAr || activeCompany?.name || '';
  const companyLogoUrl = String(activeCompany?.logoUrl || '').trim();
  const { openPrintDocumentPreview, printPreviewModal } = usePrintPreview({
    title: t('paymentHistoryTab'),
    closeLabel: t('close') || 'إغلاق',
    printLabel: `${t('print')} / PDF`,
  });
  const kindBadgeMap = useMemo(() => buildExpenseLineKindBadgeMap(t), [t]);
  const internalDateFilter = useDateFilter();
  const dateFilter = externalDateFilter ?? internalDateFilter;
  const [filterKind, setFilterKind] = useState<ExpenseLineKind | ''>('');
  const [showAllDates, setShowAllDates] = useState(false);

  const startDate = showAllDates ? undefined : (dateFilter.startDate ? toYmd(dateFilter.startDate) : undefined);
  const endDate = showAllDates ? undefined : (dateFilter.endDate ? toYmd(dateFilter.endDate) : undefined);
  const kindParam = filterKind || 'expense,fixed_expense';

  const kindFilterOptions = useMemo(
    () => [
      { value: 'fixed_expense', label: t('fixedExpense') },
      { value: 'expense', label: t('variableExpense') },
    ],
    [t],
  );

  const { data, isLoading, isError, error } = useApiQuery<InvoiceListResponse>({
    queryKey: invoiceKeys.paymentHistoryExpense(companyId, startDate, endDate, kindParam),
    queryFn: () => getInvoices(
      companyId,
      startDate,
      endDate,
      1,
      500,
      undefined,
      undefined,
      kindParam,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      true,
      undefined,
      undefined,
      undefined,
      true,
    ),
    enabled: !!companyId,
    fallbackMessage: t('loadDataFailed'),
  });

  const items = data?.items ?? [];
  const activeItems = items.filter((invoice) => invoice.status !== 'cancelled');
  const officialSummary = data?.sums?.outflow
    ? {
        totalNet: Number(data.sums.outflow.net || 0),
        totalTax: Number(data.sums.outflow.tax || 0),
        totalAmount: Number(data.sums.outflow.total || 0),
        count: data.sums.outflow.count,
      }
    : summarizeInvoiceListPayments(activeItems);

  const exportData = useMemo(
    () =>
      buildExpensePaymentExportRows(activeItems, lang, {
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
        attachment: t('invoiceReceiptCol'),
      }),
    [activeItems, lang, t],
  );

  function handlePrint() {
    openPrintDocumentPreview({
      title: t('paymentHistoryTab'),
      companyName,
      logoUrl: companyLogoUrl,
      subtitle: `${t('paymentHistoryTab')} | ${t('total')}: ${officialSummary.totalAmount} SR`,
      body: buildPrintRecordsTableHtml({
        records: exportData,
        emptyMessage: t('paymentHistoryEmptyExpenseModule'),
        numericKeys: [t('expenseTaxBreakdownNet'), t('expenseTaxBreakdownVat'), t('total')],
      }),
    });
  }

  const columns = useMemo<SmartTableColumn<InvoiceListItem>[]>(() => [
    { key: 'invoiceNumber', size: 'document', label: t('documentNumber'), minWidth: 110, render: (_value, row) => <span className="nx-cell-num nx-cell-bold text-[13px]">{row.invoiceNumber || '-'}</span> },
    { key: 'supplierInvoiceNumber', size: 'document', label: t('supplierInvoiceNumber'), minWidth: 120, render: (_value, row) => <span className="nx-cell-num nx-cell-muted text-[13px]">{row.supplierInvoiceNumber || '-'}</span> },
    { key: 'supplierName', size: 'supplier', label: t('supplier'), minWidth: 130, render: (_value, row) => <span className="text-[13px]">{lang === 'en' ? row.supplier?.nameEn || row.supplier?.nameAr || '-' : row.supplier?.nameAr || row.supplier?.nameEn || '-'}</span> },
    { key: 'expenseLineName', size: 'name', label: t('expenseLineNameCol'), minWidth: 140, render: (_value, row) => <span className="text-[13px]">{readExpenseLineName(row, lang)}</span> },
    { key: 'kind', size: 'document', label: t('expenseLineKindCol'), width: 110, minWidth: 100, render: (value) => <Badge {...Badge.fromStatus(value, kindBadgeMap)} size="sm" /> },
    {
      key: 'attachment',
      size: 'name',
      label: t('invoiceReceiptCol'),
      minWidth: 140,
      render: (_value, row) =>
        row.hasInvoiceAttachment && effectiveCompanyId && row.id ? (
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="max-w-[10rem] truncate text-[12px] text-noorix-text" title={row.attachmentOriginalName || ''}>
              {row.attachmentOriginalName || '-'}
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 shrink-0 px-2 text-[11px]"
              onClick={async () => {
                try {
                  await downloadInvoiceAttachment(row.id || '', effectiveCompanyId);
                } catch (downloadError: unknown) {
                  showToast(downloadError instanceof Error ? downloadError.message : t('saveFailed'), 'error');
                }
              }}
            >
              {t('invoiceReceiptDownload')}
            </Button>
          </div>
        ) : (
          <span className="nx-cell-muted-sm text-[13px]">-</span>
        ),
    },
    { key: 'transactionDate', size: 'date', label: t('date'), minWidth: 110, render: (value) => <span className="nx-cell-muted-sm text-[13px]">{value ? formatSaudiDate(value) : '-'}</span> },
    { key: 'netAmount', size: 'money-sm', label: t('expenseTaxBreakdownNet'), numeric: true, minWidth: 100, render: (value) => <FmtNum n={Number(value || 0)} className="nx-cell-num nx-cell-num--green text-[13px]" /> },
    { key: 'taxAmount', size: 'tax', label: t('expenseTaxBreakdownVat'), numeric: true, minWidth: 100, render: (value) => <FmtNum n={Number(value || 0)} className="nx-cell-num text-noorix-amber text-[13px]" /> },
    { key: 'totalAmount', size: 'money-md', label: t('total'), numeric: true, minWidth: 100, render: (value) => <FmtNum n={Number(value || 0)} className="nx-cell-num font-bold text-[13px]" /> },
  ], [lang, kindBadgeMap, t, effectiveCompanyId, showToast]);

  if (isError) {
    return (
      <div className="text-center text-[14px] p-8 text-noorix-red">
        {error?.message || t('loadDataFailed')}
      </div>
    );
  }

  return (
    <div>
      {printPreviewModal}
      {!externalDateFilter ? (
        <FilterToolbar
          className="mb-3 border-b border-noorix-border pb-3"
          actions={(
            <Checkbox
              label={t('showAll')}
              checked={showAllDates}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => setShowAllDates(event.target.checked)}
              containerClassName="shrink-0"
            />
          )}
        >
          <DateFilterBar filter={internalDateFilter} />
        </FilterToolbar>
      ) : null}

      <FilterToolbar className="mb-3 min-h-11 border-b border-noorix-border pb-3" filtersClassName="nx-toolbar min-w-0 flex-1">
        <div className="w-full min-w-0 sm:w-[min(100%,14rem)] shrink-0">
          <SearchableOptionsPicker
            size="sm"
            className="w-full"
            aria-label={t('paymentHistoryTab')}
            allowEmpty
            emptyValue=""
            emptyLabel={lang === 'en' ? 'All (fixed + variable)' : 'الكل (ثابت + متغير)'}
            value={filterKind}
            onChange={(value) => setFilterKind(value === 'fixed_expense' || value === 'expense' ? value : '')}
            options={kindFilterOptions}
          />
        </div>
        <Button size="sm" className="shrink-0 whitespace-nowrap" onClick={() => exportToExcel(exportData, 'payment-history.xlsx')} disabled={!activeItems.length}>{t('exportExcel')}</Button>
        <Button size="sm" className="shrink-0 whitespace-nowrap" onClick={handlePrint} disabled={!activeItems.length}>{t('print')} / PDF</Button>
      </FilterToolbar>

      <SmartTable
        compact
        showRowNumbers
        innerPadding={8}
        columns={columns}
        data={activeItems}
        isLoading={isLoading}
        title={t('paymentHistoryTab')}
        badge={<span className="nx-pill nx-pill--blue nx-pill--sm">{data?.total ?? activeItems.length}</span>}
        showSearchInHeader={false}
        emptyMessage={t('paymentHistoryEmptyExpenseModule')}
        keyExtractor={(row) => row.id || String(row.invoiceNumber)}
        footer={
          activeItems.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-noorix-bg-muted p-4">
              <span className="text-[13px] text-noorix-muted">{t('rows')}: <strong className="text-noorix-text">{officialSummary.count}</strong></span>
              <span className="text-[13px]">{t('expenseTaxBreakdownNet')}: <strong className="nx-cell-num nx-cell-num--green"><FmtNum n={officialSummary.totalNet} /></strong></span>
              <span className="text-[13px]">{t('expenseTaxBreakdownVat')}: <strong className="nx-cell-num text-noorix-amber"><FmtNum n={officialSummary.totalTax} /></strong></span>
              <span className="nx-cell-num text-[14px] font-bold">{t('total')}: <FmtNum n={officialSummary.totalAmount} /> <span className="nx-sar">SR</span></span>
            </div>
          ) : null
        }
      />
    </div>
  );
}

function readExpenseLineName(row: InvoiceListItem, lang: string) {
  const expenseLine = row.expenseLine;
  if (!expenseLine) return '-';
  return lang === 'en'
    ? expenseLine.nameEn || expenseLine.nameAr || '-'
    : expenseLine.nameAr || expenseLine.nameEn || '-';
}
