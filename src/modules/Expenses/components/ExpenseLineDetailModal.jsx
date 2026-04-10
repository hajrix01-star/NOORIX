/**
 * ExpenseLineDetailModal — تفاصيل بند مصروف + سجل مدفوعاته
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '../../../i18n/useTranslation';
import { getExpenseLine, getExpenseLinePayments } from '../../../services/api';
import { formatSaudiDate } from '../../../utils/saudiDate';
import { fmt } from '../../../utils/format';
import { exportToExcel, exportTableToPdf } from '../../../utils/exportUtils';
import SmartTable from '../../../components/common/SmartTable';
import { Button, AdaptiveSheet , FmtNum } from '../../../ui';
import { useApp } from '../../../context/AppContext';

const KIND_LABELS = { fixed_expense: 'ثابت', expense: 'متغير' };

export default function ExpenseLineDetailModal({
  lineId,
  companyId,
  onClose,
  dateFilter,
  onRefresh,
}) {
  const { t, lang } = useTranslation();
  const { activeCompanyId, companies = [] } = useApp();
  const activeCompany = companies.find((c) => c.id === (companyId || activeCompanyId));
  const companyName = activeCompany?.nameAr || activeCompany?.name || '';
  const [page, setPage] = useState(1);

  const { data: lineData, isLoading: lineLoading } = useQuery({
    queryKey: ['expense-line', lineId, companyId],
    queryFn: () => getExpenseLine(lineId, companyId),
    enabled: !!lineId && !!companyId,
  });

  const { data: paymentsData, isLoading: paymentsLoading } = useQuery({
    queryKey: ['expense-line-payments', lineId, companyId, dateFilter?.startDate, dateFilter?.endDate, page],
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
    .reduce((s, i) => s + Number(i.totalAmount || 0), 0);

  const paymentColumns = [
    { key: 'invoiceNumber', label: 'رقم السند',
      render: (_, row) => <span className="nx-cell-num font-semibold">{row.invoiceNumber || '—'}</span> },
    { key: 'supplierInvoiceNumber', label: 'رقم فاتورة المورد',
      render: (_, row) => <span className="nx-cell-num nx-cell-muted">{row.supplierInvoiceNumber || '—'}</span> },
    { key: 'transactionDate', label: 'التاريخ',
      render: (v) => <span className="nx-cell-muted">{formatSaudiDate(v) || '—'}</span> },
    { key: 'totalAmount', label: 'المبلغ',
      render: (v) => <FmtNum n={v} className="nx-cell-num nx-cell-num--green font-semibold" /> },
    { key: 'vaultName', label: 'الخزنة',
      render: (_, row) => <span className="nx-cell-muted">{row.vaultName || row.vault?.nameAr || '—'}</span> },
    { key: 'notes', label: 'ملاحظات',
      render: (v) => <span className="nx-cell-ellipsis">{v || '—'}</span> },
  ];

  const paymentExportData = payments.map((p) => ({
    'رقم السند': p.invoiceNumber || '—',
    'رقم فاتورة المورد': p.supplierInvoiceNumber || '—',
    'التاريخ': formatSaudiDate(p.transactionDate) || '—',
    'المبلغ': Number(p.totalAmount || 0),
    'الخزنة': p.vaultName || p.vault?.nameAr || '—',
    'ملاحظات': p.notes || '—',
  }));

  function handlePrintPayments() {
    const rows = payments.map((p) =>
      `<tr><td>${(p.invoiceNumber || '—').replace(/</g, '&lt;')}</td><td>${(p.supplierInvoiceNumber || '—').replace(/</g, '&lt;')}</td><td>${(formatSaudiDate(p.transactionDate) || '—').replace(/</g, '&lt;')}</td><td>${fmt(p.totalAmount).replace(/</g, '&lt;')}</td><td>${(p.vaultName || p.vault?.nameAr || '—').replace(/</g, '&lt;')}</td><td>${(p.notes || '—').replace(/</g, '&lt;')}</td></tr>`,
    ).join('');
    const printDate = new Date().toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>سجل مدفوعات - ${(line?.nameAr || '').replace(/</g, '&lt;')}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap" rel="stylesheet"><style>@page{size:A4;margin:15mm 15mm 20mm;@bottom-center{content:"صفحة " counter(page) " من " counter(pages);font-family:'Cairo',Arial,sans-serif;font-size:10px;color:#555}}*{box-sizing:border-box}body{font-family:'Cairo',Arial,sans-serif;margin:0;padding:24px;font-size:14px;line-height:1.6}table{width:100%;border-collapse:collapse;font-size:14px}td,th{padding:8px 12px;border:1px solid #ddd}th{background:#185FA5;color:#fff;font-weight:700}.print-footer{margin-top:24px;padding-top:8px;border-top:1px solid #ddd;text-align:center;font-size:11px;color:#777}@media print{body{padding:0}}</style></head><body>
<div style="text-align:center;border-bottom:2px solid #333;padding-bottom:16px;margin-bottom:24px">${companyName ? `<h1 style="margin:0;font-size:20px">${companyName.replace(/</g, '&lt;')}</h1><p style="margin:6px 0 0;font-size:14px">سجل مدفوعات — ${(line?.nameAr || line?.nameEn || '—').replace(/</g, '&lt;')}</p>` : `<h1 style="margin:0;font-size:20px">سجل مدفوعات — ${(line?.nameAr || line?.nameEn || '—').replace(/</g, '&lt;')}</h1>`}<p style="margin:6px 0 0;font-size:12px;color:#555">إجمالي: ${fmt(totalPaid)} SR</p></div>
<table><thead><tr><th>رقم السند</th><th>رقم فاتورة المورد</th><th>التاريخ</th><th>المبلغ</th><th>الخزنة</th><th>ملاحظات</th></tr></thead><tbody>${rows || '<tr><td colspan="6">لا توجد مدفوعات</td></tr>'}</tbody></table>
<div class="print-footer">طُبع بتاريخ: ${printDate}</div>
</body></html>`;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      w.onafterprint = () => { try { w.close(); } catch (_) {} };
      w.onload = () => setTimeout(() => w.print(), 300);
    }
  }

  const modalTitle = lineLoading
    ? 'جاري التحميل…'
    : (line?.nameAr || line?.nameEn || '—');

  return (
    <AdaptiveSheet open={true} onClose={onClose} title={modalTitle} size="xl" side="start" className="expense-line-detail-drawer">
      <div className="flex flex flex-wrap gap-3 text-[13px] text-noorix-muted mb-4">
        <span>النوع: {KIND_LABELS[line?.kind] || line?.kind || '—'}</span>
        <span>الفئة: {line?.category?.nameAr || '—'}</span>
        <span>المورد: {(lang === 'en' ? line?.supplier?.nameEn || line?.supplier?.nameAr : line?.supplier?.nameAr || line?.supplier?.nameEn) || '—'}</span>
        {line?.serviceNumber && <span>رقم الخدمة: {line.serviceNumber}</span>}
      </div>

      <div className="nx-page-header mb-3">
        <h3 className="text-[16px] font-semibold m-0">سجل المدفوعات</h3>
        <div className="nx-toolbar">
          <Button onClick={handlePrintPayments} disabled={!payments.length}>طباعة</Button>
          <Button onClick={() => exportToExcel(paymentExportData, `payments-${line?.nameAr || 'line'}.xlsx`)} disabled={!payments.length}>Excel</Button>
          <Button onClick={() => exportTableToPdf({ data: paymentExportData, title: `سجل مدفوعات - ${line?.nameAr || line?.nameEn || ''}`, filename: `payments-${line?.nameAr || 'line'}.pdf` })} disabled={!payments.length}>PDF</Button>
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
        keyExtractor={(row) => row.id}
      />
    </AdaptiveSheet>
  );
}
