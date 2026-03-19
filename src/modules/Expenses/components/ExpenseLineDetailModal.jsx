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

const KIND_LABELS = { fixed_expense: 'ثابت', expense: 'متغير' };

export default function ExpenseLineDetailModal({
  lineId,
  companyId,
  onClose,
  dateFilter,
  onRefresh,
}) {
  const { t } = useTranslation();
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
      render: (_, row) => <span style={{ fontWeight: 600, fontFamily: 'var(--noorix-font-numbers)' }}>{row.invoiceNumber || '—'}</span> },
    { key: 'supplierInvoiceNumber', label: 'رقم فاتورة المورد',
      render: (_, row) => <span style={{ fontFamily: 'var(--noorix-font-numbers)', color: 'var(--noorix-text-muted)' }}>{row.supplierInvoiceNumber || '—'}</span> },
    { key: 'transactionDate', label: 'التاريخ',
      render: (v) => <span style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>{formatSaudiDate(v)}</span> },
    { key: 'totalAmount', label: 'المبلغ',
      render: (v) => <span style={{ fontWeight: 600, fontFamily: 'var(--noorix-font-numbers)', color: '#16a34a' }}>{fmt(v)}</span> },
    { key: 'notes', label: 'ملاحظات',
      render: (v) => <span style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{v || '—'}</span> },
  ];

  const paymentExportData = payments.map((p) => ({
    'رقم السند': p.invoiceNumber || '—',
    'رقم فاتورة المورد': p.supplierInvoiceNumber || '—',
    'التاريخ': formatSaudiDate(p.transactionDate),
    'المبلغ': Number(p.totalAmount || 0),
    'ملاحظات': p.notes || '—',
  }));

  function handlePrintPayments() {
    const rows = payments.map((p) =>
      `<tr><td>${(p.invoiceNumber || '—').replace(/</g, '&lt;')}</td><td>${(p.supplierInvoiceNumber || '—').replace(/</g, '&lt;')}</td><td>${formatSaudiDate(p.transactionDate).replace(/</g, '&lt;')}</td><td>${fmt(p.totalAmount).replace(/</g, '&lt;')}</td><td>${(p.notes || '—').replace(/</g, '&lt;')}</td></tr>`,
    ).join('');
    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>سجل مدفوعات - ${(line?.nameAr || '').replace(/</g, '&lt;')}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap" rel="stylesheet"><style>@page{size:A4;margin:15mm}*{box-sizing:border-box}body{font-family:'Cairo',Arial,sans-serif;margin:0;padding:24px;font-size:14px;line-height:1.6}table{width:100%;border-collapse:collapse;font-size:14px}td,th{padding:8px 12px;border:1px solid #ddd}th{background:#2563eb;color:#fff;font-weight:700}@media print{body{padding:0}}</style></head><body>
<div style="text-align:center;border-bottom:2px solid #333;padding-bottom:16px;margin-bottom:24px"><h1 style="margin:0;font-size:20px">سجل مدفوعات - ${(line?.nameAr || line?.nameEn || '—').replace(/</g, '&lt;')}</h1><p style="margin:8px 0 0;font-size:12px;color:#555">إجمالي: ${fmt(totalPaid)} ر.س</p></div>
<table><thead><tr><th>رقم السند</th><th>رقم فاتورة المورد</th><th>التاريخ</th><th>المبلغ</th><th>ملاحظات</th></tr></thead><tbody>${rows || '<tr><td colspan="5">لا توجد مدفوعات</td></tr>'}</tbody></table>
</body></html>`;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      w.onafterprint = () => { try { w.close(); } catch (_) {} };
      w.onload = () => setTimeout(() => w.print(), 300);
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 24,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: 'var(--noorix-bg-surface)',
          borderRadius: 12,
          maxWidth: 800,
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: 24, borderBottom: '1px solid var(--noorix-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ margin: '0 0 8px 0', fontSize: 20, fontWeight: 700 }}>
                {line?.nameAr || line?.nameEn || '—'}
              </h2>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 13, color: 'var(--noorix-text-muted)' }}>
                <span>النوع: {KIND_LABELS[line?.kind] || line?.kind}</span>
                <span>الفئة: {line?.category?.nameAr || '—'}</span>
                <span>المورد: {line?.supplier?.nameAr || '—'}</span>
                {line?.serviceNumber && <span>رقم الخدمة: {line.serviceNumber}</span>}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: '1px solid var(--noorix-border)',
                background: 'var(--noorix-bg-page)',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              إغلاق
            </button>
          </div>
        </div>

        <div style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>سجل المدفوعات</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="noorix-btn-nav" onClick={handlePrintPayments} disabled={!payments.length}>🖨 طباعة</button>
              <button type="button" className="noorix-btn-nav" onClick={() => exportToExcel(paymentExportData, `payments-${line?.nameAr || 'line'}.xlsx`)} disabled={!payments.length}>📥 Excel</button>
              <button type="button" className="noorix-btn-nav" onClick={() => exportTableToPdf({ data: paymentExportData, title: `سجل مدفوعات - ${line?.nameAr || line?.nameEn || ''}`, filename: `payments-${line?.nameAr || 'line'}.pdf` })} disabled={!payments.length}>📄 PDF</button>
            </div>
          </div>
          {dateFilter?.startDate && (
            <p style={{ margin: '0 0 12px 0', fontSize: 12, color: 'var(--noorix-text-muted)' }}>
              الفترة: {formatSaudiDate(dateFilter.startDate)} — {formatSaudiDate(dateFilter.endDate)}
            </p>
          )}
          <p style={{ margin: '0 0 16px 0', fontSize: 14, fontWeight: 600 }}>
            إجمالي المدفوع في الفترة: <span style={{ color: '#16a34a', fontFamily: 'var(--noorix-font-numbers)' }}>{fmt(totalPaid)}</span>
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
        </div>
      </div>
    </div>
  );
}
