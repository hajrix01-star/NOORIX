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
import { useTranslation } from '../../../i18n/useTranslation';
import { Button, Badge, Input } from '../../../ui';

const KIND_LABELS = { fixed_expense: 'ثابت', expense: 'متغير' };

const KIND_STATUS_MAP = {
  fixed_expense: { color: 'gray',  label: 'ثابت' },
  expense:       { color: 'amber', label: 'متغير' },
};

export default function PaymentHistoryTab({ companyId, dateFilter: externalDateFilter }) {
  const { lang } = useTranslation();
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
      'المورد': (lang === 'en' ? inv.supplier?.nameEn || inv.supplier?.nameAr : inv.supplier?.nameAr || inv.supplier?.nameEn) || '—',
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
      render: (_, row) => <span className="nx-cell-num nx-font-600">{row.invoiceNumber || '—'}</span> },
    { key: 'supplierInvoiceNumber', label: 'رقم فاتورة المورد',
      render: (_, row) => <span className="nx-cell-num nx-cell-muted">{row.supplierInvoiceNumber || '—'}</span> },
    { key: 'supplierName', label: 'المورد',
      render: (_, row) => <span>{(lang === 'en' ? row.supplier?.nameEn || row.supplier?.nameAr : row.supplier?.nameAr || row.supplier?.nameEn) || '—'}</span> },
    { key: 'expenseLineName', label: 'بند المصروف',
      render: (_, row) => <span>{row.expenseLine?.nameAr || row.expenseLine?.nameEn || '—'}</span> },
    { key: 'kind', label: 'النوع',
      render: (v) => <Badge {...Badge.fromStatus(v, KIND_STATUS_MAP)} size="sm" /> },
    { key: 'transactionDate', label: 'التاريخ',
      render: (v) => <span className="nx-cell-muted">{formatSaudiDate(v)}</span> },
    { key: 'netAmount', label: 'الصافي', numeric: true,
      render: (v) => <span className="nx-cell-num nx-cell-num--green">{fmt(v)}</span> },
    { key: 'taxAmount', label: 'الضريبة', numeric: true,
      render: (v) => <span className="nx-cell-num" style={{ color: 'var(--noorix-color-amber, #d97706)' }}>{fmt(v)}</span> },
    { key: 'totalAmount', label: 'الإجمالي', numeric: true,
      render: (v) => <span className="nx-cell-num nx-font-700">{fmt(v)}</span> },
  ];

  if (isError) {
    return (
      <div className="nx-text-center nx-text-md" style={{ padding: 32, color: '#dc2626' }}>
        ⚠ {error?.message || 'فشل تحميل سجل المدفوعات'}
      </div>
    );
  }

  return (
    <div>
      {!externalDateFilter && (
        <div className="nx-flex-center nx-gap-12 nx-mb-12" style={{ flexWrap: 'wrap' }}>
          <DateFilterBar filter={dateFilter} />
          <label className="nx-checkbox">
            <input type="checkbox" checked={showAllDates} onChange={(e) => setShowAllDates(e.target.checked)} />
            عرض الكل (بدون فلتر تاريخ)
          </label>
        </div>
      )}
      <div className="nx-toolbar nx-mt-16 nx-mb-12">
        <Input
          type="select"
          value={filterKind}
          onChange={(e) => setFilterKind(e.target.value)}
        >
          <option value="">الكل (ثابت + متغير)</option>
          <option value="fixed_expense">ثابت فقط</option>
          <option value="expense">متغير فقط</option>
        </Input>
        <Button onClick={handlePrint} disabled={!activeItems.length}>طباعة</Button>
        <Button onClick={() => exportToExcel(exportData, 'payment-history.xlsx')} disabled={!activeItems.length}>Excel</Button>
        <Button onClick={() => exportTableToPdf({ data: exportData, title: 'سجل المدفوعات (ثابت + متغير)', filename: 'payment-history.pdf' })} disabled={!activeItems.length}>PDF</Button>
      </div>
      <div className="nx-mt-8">
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
              <div className="nx-flex-between nx-p-16 nx-rounded nx-mt-12 nx-gap-12" style={{ background: 'var(--noorix-bg-page)', flexWrap: 'wrap' }}>
                <span className="nx-text-md nx-text-muted">عدد السجلات: <strong>{activeItems.length}</strong></span>
                <span className="nx-text-md">الصافي: <strong className="nx-cell-num nx-cell-num--green">{fmt(totalNet)}</strong></span>
                <span className="nx-text-md">الضريبة: <strong className="nx-cell-num" style={{ color: 'var(--noorix-color-amber, #d97706)' }}>{fmt(totalTax)}</strong></span>
                <span className="nx-cell-num nx-text-xl nx-font-700">الإجمالي: {fmt(totalAmount)} ر.س</span>
              </div>
            ) : null
          }
        />
      </div>
    </div>
  );
}
