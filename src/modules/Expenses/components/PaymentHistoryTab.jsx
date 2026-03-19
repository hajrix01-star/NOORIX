/**
 * PaymentHistoryTab — سجل المدفوعات (ثابت + متغير)
 * يعرض كل فواتير المصاريف في جدول واحد مع فلترة التاريخ والنوع
 */
import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getInvoices } from '../../../services/api';
import DateFilterBar, { useDateFilter } from '../../../shared/components/DateFilterBar';
import { formatSaudiDate } from '../../../utils/saudiDate';
import { fmt, sumAmounts } from '../../../utils/format';
import { exportToExcel, exportTableToPdf } from '../../../utils/exportUtils';
import SmartTable from '../../../components/common/SmartTable';

const KIND_LABELS = { fixed_expense: 'ثابت', expense: 'متغير' };

export default function PaymentHistoryTab({ companyId, dateFilter: externalDateFilter }) {
  const internalDateFilter = useDateFilter();
  const dateFilter = externalDateFilter ?? internalDateFilter;
  const [filterKind, setFilterKind] = useState('');
  const [showAllDates, setShowAllDates] = useState(false);

  const startDate = showAllDates ? undefined : (dateFilter.startDate ? String(dateFilter.startDate).slice(0, 10) : undefined);
  const endDate = showAllDates ? undefined : (dateFilter.endDate ? String(dateFilter.endDate).slice(0, 10) : undefined);
  const kindParam = filterKind ? filterKind : 'expense,fixed_expense';

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['invoices', companyId, startDate, endDate, kindParam],
    queryFn: async () => {
      const res = await getInvoices(companyId, startDate, endDate, 1, 500, undefined, undefined, kindParam);
      if (!res.success) throw new Error(res.error || 'فشل تحميل المدفوعات');
      return res.data;
    },
    enabled: !!companyId,
  });

  const items = data?.items ?? [];
  const activeItems = items.filter((inv) => inv.status !== 'cancelled');
  const totalAmount = useMemo(() => sumAmounts(activeItems, 'totalAmount'), [activeItems]);
  const totalNet = useMemo(() => sumAmounts(activeItems, 'netAmount'), [activeItems]);
  const totalTax = useMemo(() => sumAmounts(activeItems, 'taxAmount'), [activeItems]);

  const exportData = useMemo(() =>
    activeItems.map((inv) => ({
      'رقم السند': inv.invoiceNumber || '—',
      'رقم فاتورة المورد': inv.supplierInvoiceNumber || '—',
      'المورد': inv.supplier?.nameAr || inv.supplier?.nameEn || '—',
      'بند المصروف': inv.expenseLine?.nameAr || inv.expenseLine?.nameEn || '—',
      'النوع': KIND_LABELS[inv.kind] || inv.kind,
      'التاريخ': formatSaudiDate(inv.transactionDate),
      'الصافي': Number(inv.netAmount || 0),
      'الضريبة': Number(inv.taxAmount || 0),
      'الإجمالي': Number(inv.totalAmount || 0),
    })),
    [activeItems],
  );

  function handlePrint() {
    const rows = activeItems.map((inv) =>
      `<tr><td>${(inv.invoiceNumber || '—').replace(/</g, '&lt;')}</td><td>${(inv.supplierInvoiceNumber || '—').replace(/</g, '&lt;')}</td><td>${(inv.supplier?.nameAr || '—').replace(/</g, '&lt;')}</td><td>${(inv.expenseLine?.nameAr || '—').replace(/</g, '&lt;')}</td><td>${(KIND_LABELS[inv.kind] || inv.kind).replace(/</g, '&lt;')}</td><td>${formatSaudiDate(inv.transactionDate).replace(/</g, '&lt;')}</td><td>${fmt(inv.netAmount).replace(/</g, '&lt;')}</td><td>${fmt(inv.taxAmount).replace(/</g, '&lt;')}</td><td>${fmt(inv.totalAmount).replace(/</g, '&lt;')}</td></tr>`,
    ).join('');
    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>سجل المدفوعات</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap" rel="stylesheet"><style>@page{size:A4;margin:15mm}*{box-sizing:border-box}body{font-family:'Cairo',Arial,sans-serif;margin:0;padding:24px;font-size:14px;line-height:1.6}table{width:100%;border-collapse:collapse;font-size:14px}td,th{padding:8px 12px;border:1px solid #ddd}th{background:#2563eb;color:#fff;font-weight:700}@media print{body{padding:0}}</style></head><body>
<div style="text-align:center;border-bottom:2px solid #333;padding-bottom:16px;margin-bottom:24px"><h1 style="margin:0;font-size:20px">سجل المدفوعات (ثابت + متغير)</h1><p style="margin:8px 0 0;font-size:12px;color:#555">الإجمالي: ${fmt(totalAmount)} ر.س</p></div>
<table><thead><tr><th>رقم السند</th><th>رقم فاتورة المورد</th><th>المورد</th><th>بند المصروف</th><th>النوع</th><th>التاريخ</th><th>الصافي</th><th>الضريبة</th><th>الإجمالي</th></tr></thead><tbody>${rows || '<tr><td colspan="9">لا توجد مدفوعات</td></tr>'}</tbody></table>
</body></html>`;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      w.onafterprint = () => { try { w.close(); } catch (_) {} };
      w.onload = () => setTimeout(() => w.print(), 300);
    }
  }

  const columns = [
    { key: 'invoiceNumber', label: 'رقم السند',
      render: (_, row) => <span style={{ fontWeight: 600, fontFamily: 'var(--noorix-font-numbers)' }}>{row.invoiceNumber || '—'}</span> },
    { key: 'supplierInvoiceNumber', label: 'رقم فاتورة المورد',
      render: (_, row) => <span style={{ fontFamily: 'var(--noorix-font-numbers)', color: 'var(--noorix-text-muted)' }}>{row.supplierInvoiceNumber || '—'}</span> },
    { key: 'supplierName', label: 'المورد',
      render: (_, row) => <span>{row.supplier?.nameAr || row.supplier?.nameEn || '—'}</span> },
    { key: 'expenseLineName', label: 'بند المصروف',
      render: (_, row) => <span>{row.expenseLine?.nameAr || row.expenseLine?.nameEn || '—'}</span> },
    { key: 'kind', label: 'النوع',
      render: (v) => <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: v === 'fixed_expense' ? 'rgba(100,116,139,0.12)' : 'rgba(217,119,6,0.12)', color: v === 'fixed_expense' ? '#64748b' : '#d97706' }}>{KIND_LABELS[v] || v}</span> },
    { key: 'transactionDate', label: 'التاريخ',
      render: (v) => <span style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>{formatSaudiDate(v)}</span> },
    { key: 'netAmount', label: 'الصافي', numeric: true,
      render: (v) => <span style={{ fontFamily: 'var(--noorix-font-numbers)', color: '#16a34a' }}>{fmt(v)}</span> },
    { key: 'taxAmount', label: 'الضريبة', numeric: true,
      render: (v) => <span style={{ fontFamily: 'var(--noorix-font-numbers)', color: '#d97706' }}>{fmt(v)}</span> },
    { key: 'totalAmount', label: 'الإجمالي', numeric: true,
      render: (v) => <span style={{ fontWeight: 700, fontFamily: 'var(--noorix-font-numbers)' }}>{fmt(v)}</span> },
  ];

  return (
    <div>
      {!externalDateFilter && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 12 }}>
          <DateFilterBar filter={dateFilter} />
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={showAllDates} onChange={(e) => setShowAllDates(e.target.checked)} />
            عرض الكل (بدون فلتر تاريخ)
          </label>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 16, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          value={filterKind}
          onChange={(e) => setFilterKind(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-surface)', fontSize: 13 }}
        >
          <option value="">الكل (ثابت + متغير)</option>
          <option value="fixed_expense">ثابت فقط</option>
          <option value="expense">متغير فقط</option>
        </select>
        <button type="button" className="noorix-btn-nav" onClick={handlePrint} disabled={!activeItems.length}>🖨 طباعة</button>
        <button type="button" className="noorix-btn-nav" onClick={() => exportToExcel(exportData, 'payment-history.xlsx')} disabled={!activeItems.length}>📥 Excel</button>
        <button type="button" className="noorix-btn-nav" onClick={() => exportTableToPdf({ data: exportData, title: 'سجل المدفوعات (ثابت + متغير)', filename: 'payment-history.pdf' })} disabled={!activeItems.length}>📄 PDF</button>
      </div>
      <div style={{ marginTop: 8 }}>
        <SmartTable
          columns={columns}
          data={activeItems}
          showRowNumbers
          rowNumberWidth="1%"
          isLoading={isLoading}
          emptyMessage="لا توجد مدفوعات في الفترة المحددة."
          keyExtractor={(row) => row.id}
          footer={
            activeItems.length > 0 ? (
              <div style={{ padding: 16, background: 'var(--noorix-bg-page)', borderRadius: 8, marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <span style={{ fontSize: 14, color: 'var(--noorix-text-muted)' }}>عدد السجلات: <strong>{activeItems.length}</strong></span>
                <span style={{ fontSize: 14 }}>الصافي: <strong style={{ color: '#16a34a', fontFamily: 'var(--noorix-font-numbers)' }}>{fmt(totalNet)}</strong></span>
                <span style={{ fontSize: 14 }}>الضريبة: <strong style={{ color: '#d97706', fontFamily: 'var(--noorix-font-numbers)' }}>{fmt(totalTax)}</strong></span>
                <span style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--noorix-font-numbers)' }}>الإجمالي: {fmt(totalAmount)} ر.س</span>
              </div>
            ) : null
          }
        />
      </div>
    </div>
  );
}
