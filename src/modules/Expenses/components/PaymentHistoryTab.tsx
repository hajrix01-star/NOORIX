/**
 * PaymentHistoryTab — سجل المدفوعات (ثابت + متغير)
 * محاذاة جداول/أشرطة HR: شريط mb-3 min-h-11، SmartTable compact + innerPadding 8 + عنوان + شارة
 */
import React, { useMemo, useState } from 'react';
import { useApiQuery } from '../../../hooks/useApiQuery';
import { getInvoices, downloadInvoiceAttachment } from '../../../services/api';
import { invoiceKeys } from '../../../services/queryKeys';
import { useToast } from '../../../context/ToastContext';
import DateFilterBar, { useDateFilter } from '../../../shared/components/DateFilterBar';
import FilterToolbar from '../../../shared/components/FilterToolbar';
import { formatSaudiDate, toYmd } from '../../../utils/saudiDate';
import { fmt, sumAmounts } from '../../../utils/format';
import { exportToExcel, exportTableToPdf } from '../../../utils/exportUtils';
import { buildPrintRecordsTableHtml } from '../../../utils/printTableHtml';
import { openPrintWindow } from '../../../utils/printUtils';
import { useTranslation } from '../../../i18n/useTranslation';
import { Button, Badge, Checkbox, FmtNum, SmartTable } from '../../../ui';
import { SearchableOptionsPicker } from '../../../components/common/SearchableOptionsPicker';
import { buildExpenseLineKindBadgeMap } from '../../../constants/badgeMaps';
import { useApp } from '../../../context/AppContext';

export default function PaymentHistoryTab({ companyId, dateFilter: externalDateFilter }: any) {
  const { lang, t } = useTranslation();
  const { showToast } = useToast();
  const { activeCompanyId, companies = [] } = useApp();
  const effectiveCompanyId = companyId || activeCompanyId || '';
  const activeCompany = companies.find((c: any) => c.id === (companyId || activeCompanyId));
  const companyName = activeCompany?.nameAr || activeCompany?.name || '';
  const kindBadgeMap = useMemo(() => buildExpenseLineKindBadgeMap(t), [t]);

  const kindFilterOptions = useMemo(
    () => [
      { value: 'fixed_expense', label: t('fixedExpense') },
      { value: 'expense', label: t('variableExpense') },
    ],
    [t],
  );
  const internalDateFilter = useDateFilter();
  const dateFilter = externalDateFilter ?? internalDateFilter;
  const [filterKind, setFilterKind] = useState('');
  const [showAllDates, setShowAllDates] = useState(false);

  const startDate = showAllDates ? undefined : (dateFilter.startDate ? toYmd(dateFilter.startDate) : undefined);
  const endDate = showAllDates ? undefined : (dateFilter.endDate ? toYmd(dateFilter.endDate) : undefined);
  const kindParam = filterKind ? filterKind : 'expense,fixed_expense';

  const { data, isLoading, isError, error } = useApiQuery<any>({
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
    fallbackMessage: 'فشل تحميل المدفوعات',
  });

  const items = data?.items ?? [];
  const activeItems = items.filter((inv: any) => inv.status !== 'cancelled');
  const totalAmount = useMemo(() => sumAmounts(activeItems, 'totalAmount'), [activeItems]);
  const totalNet = useMemo(() => sumAmounts(activeItems, 'netAmount'), [activeItems]);
  const totalTax = useMemo(() => sumAmounts(activeItems, 'taxAmount'), [activeItems]);

  const exportData = useMemo(() =>
    activeItems.map((inv: any) => ({
      'رقم السند': inv.invoiceNumber || '—',
      'رقم فاتورة المورد': inv.supplierInvoiceNumber || '—',
      'المورد': (lang === 'en' ? inv.supplier?.nameEn || inv.supplier?.nameAr : inv.supplier?.nameAr || inv.supplier?.nameEn) || '—',
      'بند المصروف': inv.expenseLine?.nameAr || inv.expenseLine?.nameEn || '—',
      'النوع': (kindBadgeMap as Record<string, { label?: string }>)[String(inv.kind)]?.label || inv.kind,
      [t('invoiceReceiptCol')]: inv.hasInvoiceAttachment ? (inv.attachmentOriginalName || '—') : '—',
      'التاريخ': formatSaudiDate(inv.transactionDate),
      'الصافي': Number(inv.netAmount || 0),
      'الضريبة': Number(inv.taxAmount || 0),
      'الإجمالي': Number(inv.totalAmount || 0),
    })),
  [activeItems, kindBadgeMap, lang, t]);

  function handlePrint() {
    openPrintWindow({
      title: 'سجل المدفوعات',
      companyName,
      subtitle: `سجل المدفوعات (ثابت + متغير) | الإجمالي: ${fmt(totalAmount)} SR`,
      body: buildPrintRecordsTableHtml({
        records: exportData,
        emptyMessage: 'لا توجد مدفوعات',
        numericKeys: ['الصافي', 'الضريبة', 'الإجمالي'],
      }),
    });
  }

  const columns = useMemo(() => [
    { key: 'invoiceNumber', label: 'رقم السند', minWidth: 110,
      render: (_: any, row: any) => <span className="nx-cell-num nx-cell-bold text-[13px]">{row.invoiceNumber || '—'}</span> },
    { key: 'supplierInvoiceNumber', label: 'رقم فاتورة المورد', minWidth: 120,
      render: (_: any, row: any) => <span className="nx-cell-num nx-cell-muted text-[13px]">{row.supplierInvoiceNumber || '—'}</span> },
    { key: 'supplierName', label: 'المورد', minWidth: 130,
      render: (_: any, row: any) => <span className="text-[13px]">{(lang === 'en' ? row.supplier?.nameEn || row.supplier?.nameAr : row.supplier?.nameAr || row.supplier?.nameEn) || '—'}</span> },
    { key: 'expenseLineName', label: 'بند المصروف', minWidth: 140,
      render: (_: any, row: any) => <span className="text-[13px]">{row.expenseLine?.nameAr || row.expenseLine?.nameEn || '—'}</span> },
    { key: 'kind', label: 'النوع', width: 110, minWidth: 100,
      render: (v: any) => <Badge {...Badge.fromStatus(v, kindBadgeMap)} size="sm" /> },
    {
      key: 'attachment',
      label: t('invoiceReceiptCol'),
      minWidth: 140,
      render: (_: any, row: any) =>
        row.hasInvoiceAttachment && effectiveCompanyId ? (
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="max-w-[10rem] truncate text-[12px] text-noorix-text" title={row.attachmentOriginalName || ''}>
              {row.attachmentOriginalName || '—'}
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 shrink-0 px-2 text-[11px]"
              onClick={async () => {
                try {
                  await downloadInvoiceAttachment(row.id, effectiveCompanyId);
                } catch (e: any) {
                  showToast?.(e?.message || t('saveFailed'), 'error');
                }
              }}
            >
              {t('invoiceReceiptDownload')}
            </Button>
          </div>
        ) : (
          <span className="nx-cell-muted-sm text-[13px]">—</span>
        ),
    },
    { key: 'transactionDate', label: 'التاريخ', minWidth: 110,
      render: (v: any) => <span className="nx-cell-muted-sm text-[13px]">{formatSaudiDate(v)}</span> },
    { key: 'netAmount', label: 'الصافي', numeric: true, minWidth: 100,
      render: (v: any) => <FmtNum n={v} className="nx-cell-num nx-cell-num--green text-[13px]" /> },
    { key: 'taxAmount', label: 'الضريبة', numeric: true, minWidth: 100,
      render: (v: any) => <FmtNum n={v} className="nx-cell-num text-noorix-amber text-[13px]" /> },
    { key: 'totalAmount', label: 'الإجمالي', numeric: true, minWidth: 100,
      render: (v: any) => <FmtNum n={v} className="nx-cell-num font-bold text-[13px]" /> },
  ], [lang, kindBadgeMap, t, effectiveCompanyId, showToast]);

  if (isError) {
    return (
      <div className="text-center text-[14px] p-8 text-noorix-red">
        ⚠ {error?.message || 'فشل تحميل سجل المدفوعات'}
      </div>
    );
  }

  return (
    <div>
      {!externalDateFilter && (
        <FilterToolbar
          className="mb-3 border-b border-noorix-border pb-3"
          actions={(
            <Checkbox
              label="عرض الكل (بدون فلتر تاريخ)"
              checked={showAllDates}
              onChange={(e) => setShowAllDates(e.target.checked)}
              containerClassName="shrink-0"
            />
          )}
        >
          <DateFilterBar filter={dateFilter} />
        </FilterToolbar>
      )}

      <div className="mb-3 flex min-h-11 flex-col gap-3 border-b border-noorix-border pb-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2">
        <div className="nx-toolbar min-w-0 flex-1">
          <div className="w-full min-w-0 sm:w-[min(100%,14rem)] shrink-0">
            <SearchableOptionsPicker
              size="sm"
              className="w-full"
              aria-label={t('paymentHistoryTab')}
              allowEmpty
              emptyValue=""
              emptyLabel={lang === 'en' ? 'All (fixed + variable)' : 'الكل (ثابت + متغير)'}
              value={filterKind}
              onChange={(v) => setFilterKind(v)}
              options={kindFilterOptions}
            />
          </div>
          <Button size="sm" className="shrink-0 whitespace-nowrap" onClick={handlePrint} disabled={!activeItems.length}>
            {t('print')}
          </Button>
          <Button size="sm" className="shrink-0 whitespace-nowrap" onClick={() => exportToExcel(exportData, 'payment-history.xlsx')} disabled={!activeItems.length}>
            {t('exportExcel')}
          </Button>
          <Button size="sm" className="shrink-0 whitespace-nowrap" onClick={() => exportTableToPdf({ data: exportData, title: 'سجل المدفوعات (ثابت + متغير)', companyName, filename: 'payment-history.pdf' })} disabled={!activeItems.length}>
            طباعة / PDF
          </Button>
        </div>
      </div>

      <SmartTable
        compact
        showRowNumbers
        rowNumberWidth="1%"
        innerPadding={8}
        columns={columns}
        data={activeItems}
        isLoading={isLoading}
        title={t('paymentHistoryTab')}
        badge={<span className="nx-pill nx-pill--blue nx-pill--sm">{activeItems.length}</span>}
        showSearchInHeader={false}
        emptyMessage={t('paymentHistoryEmptyExpenseModule')}
        keyExtractor={(row: any) => row.id}
        footer={
          activeItems.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-noorix-bg-muted p-4">
              <span className="text-[13px] text-noorix-muted">عدد السجلات: <strong className="text-noorix-text">{activeItems.length}</strong></span>
              <span className="text-[13px]">الصافي: <strong className="nx-cell-num nx-cell-num--green"><FmtNum n={totalNet.toNumber()} /></strong></span>
              <span className="text-[13px]">الضريبة: <strong className="nx-cell-num text-noorix-amber"><FmtNum n={totalTax.toNumber()} /></strong></span>
              <span className="nx-cell-num text-[14px] font-bold">الإجمالي: <FmtNum n={totalAmount.toNumber()} /> <span className="nx-sar">SR</span></span>
            </div>
          ) : null
        }
      />
    </div>
  );
}
