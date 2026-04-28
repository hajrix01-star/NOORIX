/**
 * ExpenseLineDetailModal — تفاصيل بند مصروف + سجل مدفوعاته
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '../../../i18n/useTranslation';
import { getExpenseLine, getExpenseLinePayments } from '../../../services/api';
import { expenseKeys } from '../../../services/queryKeys';
import { formatSaudiDate } from '../../../utils/saudiDate';
import { fmt } from '../../../utils/format';
import { exportToExcel, exportTableToPdf } from '../../../utils/exportUtils';
import { openPrintWindow } from '../../../utils/printUtils';
import { Button, AdaptiveSheet , FmtNum, SmartTable } from '../../../ui';
import { useApp } from '../../../context/AppContext';

const KIND_LABELS = { fixed_expense: 'ثابت', expense: 'متغير' };

function formatInvoiceCoverage(row: any) {
  if (row.expenseCoverageYear == null) return '—';
  const y = row.expenseCoverageYear;
  if (row.expenseCoverageQuarter != null) {
    return `Q${row.expenseCoverageQuarter} ${y}`;
  }
  const m = row.expenseCoverageMonthStart;
  const len = row.expenseMonthsCovered;
  if (m != null && len != null) {
    return `${y}-${String(m).padStart(2, '0')} (${len})`;
  }
  return String(y);
}

export default function ExpenseLineDetailModal({
  lineId,
  companyId,
  onClose,
  dateFilter,
  onRefresh,
}: any) {
  const { t, lang } = useTranslation();
  const { activeCompanyId, companies = [] } = useApp();
  const activeCompany = companies.find((c: any) => c.id === (companyId || activeCompanyId));
  const companyName = activeCompany?.nameAr || activeCompany?.name || '';
  const [page, setPage] = useState(1);

  const { data: lineData, isLoading: lineLoading } = useQuery({
    queryKey: expenseKeys.line(lineId, companyId),
    queryFn: () => getExpenseLine(lineId, companyId),
    enabled: !!lineId && !!companyId,
  });

  const { data: paymentsData, isLoading: paymentsLoading } = useQuery({
    queryKey: expenseKeys.linePayments(
      lineId,
      companyId,
      dateFilter?.startDate,
      dateFilter?.endDate,
      page,
    ),
    queryFn: () =>
      getExpenseLinePayments(
        lineId,
        companyId,
        dateFilter?.startDate,
        dateFilter?.endDate,
        page,
        20,
      ),
    enabled: !!lineId && !!companyId,
  });

  const line = lineData?.data ?? lineData;
  const payments = paymentsData?.data?.items ?? paymentsData?.items ?? [];
  const totalPaid = (paymentsData?.data?.items ?? paymentsData?.items ?? [])
    .reduce((s: any, i: any) => s + Number(i.totalAmount || 0), 0);

  const paymentColumns = [
    { key: 'invoiceNumber', label: 'رقم السند',
      render: (_: any, row: any) => <span className="nx-cell-num font-semibold">{row.invoiceNumber || '—'}</span> },
    { key: 'supplierInvoiceNumber', label: 'رقم فاتورة المورد',
      render: (_: any, row: any) => <span className="nx-cell-num nx-cell-muted">{row.supplierInvoiceNumber || '—'}</span> },
    { key: 'transactionDate', label: 'التاريخ',
      render: (v: any) => <span className="nx-cell-muted">{formatSaudiDate(v) || '—'}</span> },
    { key: 'coverage', label: t('expenseCoverageColumn'),
      render: (_: any, row: any) => <span className="nx-cell-muted ltr">{formatInvoiceCoverage(row)}</span> },
    { key: 'totalAmount', label: 'المبلغ',
      render: (v: any) => <FmtNum n={v} className="nx-cell-num nx-cell-num--green font-semibold" /> },
    { key: 'vaultName', label: 'الخزنة',
      render: (_: any, row: any) => <span className="nx-cell-muted">{row.vaultName || row.vault?.nameAr || '—'}</span> },
    { key: 'notes', label: 'ملاحظات',
      render: (v: any) => <span className="nx-cell-ellipsis">{v || '—'}</span> },
  ];

  const paymentExportData = payments.map((p: any) => ({
    'رقم السند': p.invoiceNumber || '—',
    'رقم فاتورة المورد': p.supplierInvoiceNumber || '—',
    'التاريخ': formatSaudiDate(p.transactionDate) || '—',
    التغطية: formatInvoiceCoverage(p),
    'المبلغ': Number(p.totalAmount || 0),
    'الخزنة': p.vaultName || p.vault?.nameAr || '—',
    'ملاحظات': p.notes || '—',
  }));

  function handlePrintPayments() {
    const rows = payments.map((p: any) =>
      `<tr><td>${(p.invoiceNumber || '—').replace(/</g, '&lt;')}</td><td>${(p.supplierInvoiceNumber || '—').replace(/</g, '&lt;')}</td><td>${(formatSaudiDate(p.transactionDate) || '—').replace(/</g, '&lt;')}</td><td>${String(formatInvoiceCoverage(p)).replace(/</g, '&lt;')}</td><td>${fmt(p.totalAmount).replace(/</g, '&lt;')}</td><td>${(p.vaultName || p.vault?.nameAr || '—').replace(/</g, '&lt;')}</td><td>${(p.notes || '—').replace(/</g, '&lt;')}</td></tr>`,
    ).join('');
    const lineName = line?.nameAr || line?.nameEn || '—';
    openPrintWindow({
      title: `سجل مدفوعات — ${lineName}`,
      companyName,
      subtitle: `سجل مدفوعات — ${lineName} | الإجمالي: ${fmt(totalPaid)} SR`,
      body: `<table><thead><tr><th>رقم السند</th><th>رقم فاتورة المورد</th><th>التاريخ</th><th>التغطية</th><th>المبلغ</th><th>الخزنة</th><th>ملاحظات</th></tr></thead><tbody>${rows || '<tr><td colspan="7">لا توجد مدفوعات</td></tr>'}</tbody></table>`,
    });
  }

  const modalTitle = lineLoading
    ? 'جاري التحميل…'
    : (line?.nameAr || line?.nameEn || '—');

  return (
    <AdaptiveSheet open={true} onClose={onClose} title={modalTitle} size="xl" side="start" className="expense-line-detail-drawer">
      <div className="flex flex flex-wrap gap-3 text-[13px] text-noorix-muted mb-4">
        <span>النوع: {(KIND_LABELS as Record<string, string>)[String(line?.kind)] || line?.kind || '—'}</span>
        <span>الفئة: {line?.category?.nameAr || '—'}</span>
        <span>المورد: {(lang === 'en' ? line?.supplier?.nameEn || line?.supplier?.nameAr : line?.supplier?.nameAr || line?.supplier?.nameEn) || '—'}</span>
        {line?.serviceNumber && <span>رقم الخدمة: {line.serviceNumber}</span>}
        {line?.referenceAmount != null && line.referenceAmount !== '' && (
          <span className="text-noorix-text font-medium">
            {t('expenseLineReferenceLabelShort')}: <FmtNum n={Number(line.referenceAmount)} className="nx-font-numbers" />{' '}
            <span className="nx-sar">SR</span>
            {line.allowPaymentAmountOverride === false && (
              <span className="text-[11px] text-noorix-amber ms-1">{t('expenseLineAmountFixedAtPayment')}</span>
            )}
          </span>
        )}
        {line?.kind === 'fixed_expense' && line?.annualTotalAmount != null && (
          <span className="text-noorix-text">
            {t('expenseLineAnnualTotal')}: <FmtNum n={Number(line.annualTotalAmount)} className="nx-font-numbers" />{' '}
            <span className="nx-sar">SR</span>
            {line.installmentIntervalMonths != null && (
              <span className="text-noorix-muted ms-1">
                · {line.installmentIntervalMonths} {lang === 'en' ? 'mo interval' : 'شهر/فترة'}
              </span>
            )}
          </span>
        )}
      </div>

      <div className="nx-page-header mb-3">
        <h3 className="text-[16px] font-semibold m-0">سجل المدفوعات</h3>
        <div className="nx-toolbar">
          <Button size="sm" onClick={handlePrintPayments} disabled={!payments.length}>طباعة</Button>
          <Button size="sm" onClick={() => exportToExcel(paymentExportData, `payments-${line?.nameAr || 'line'}.xlsx`)} disabled={!payments.length}>Excel</Button>
          <Button size="sm" onClick={() => exportTableToPdf({ data: paymentExportData, title: `سجل مدفوعات - ${line?.nameAr || line?.nameEn || ''}`, companyName, filename: `payments-${line?.nameAr || 'line'}.pdf` })} disabled={!payments.length}>طباعة / PDF</Button>
        </div>
      </div>

      {dateFilter?.startDate && (
        <p className="text-[12px] text-noorix-muted mt-0 mb-3">
          الفترة: {formatSaudiDate(dateFilter.startDate)} — {formatSaudiDate(dateFilter.endDate)}
        </p>
      )}
      <p className="text-[14px] font-semibold mt-0 mb-4">
        إجمالي المدفوع في الفترة: <FmtNum n={totalPaid} className="nx-cell-num nx-cell-num--green" />
      </p>
      <SmartTable
        columns={paymentColumns}
        data={payments}
        showRowNumbers
        rowNumberWidth="1%"
        isLoading={paymentsLoading}
        emptyMessage="لا توجد مدفوعات لهذا البند في الفترة المحددة."
        keyExtractor={(row: any) => row.id}
      />
    </AdaptiveSheet>
  );
}
