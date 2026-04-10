/**
 * PaymentHistoryTab — سجل المدفوعات (ثابت + متغير)
 * محاذاة جداول/أشرطة HR: شريط mb-3 min-h-11، SmartTable compact + innerPadding 8 + عنوان + شارة
 */
import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getInvoices, throwIfApiFailed } from '../../../services/api';
import DateFilterBar, { useDateFilter } from '../../../shared/components/DateFilterBar';
import { formatSaudiDate } from '../../../utils/saudiDate';
import { fmt, sumAmounts } from '../../../utils/format';
import { exportToExcel, exportTableToPdf } from '../../../utils/exportUtils';
import SmartTable from '../../../components/common/SmartTable';
import { useTranslation } from '../../../i18n/useTranslation';
import { Button, Badge, Input , FmtNum } from '../../../ui';
import { buildExpenseLineKindBadgeMap } from '../../../constants/badgeMaps';
import { useApp } from '../../../context/AppContext';

export default function PaymentHistoryTab({ companyId, dateFilter: externalDateFilter }) {
  const { lang, t } = useTranslation();
  const { activeCompanyId, companies = [] } = useApp();
  const activeCompany = companies.find((c) => c.id === (companyId || activeCompanyId));
  const companyName = activeCompany?.nameAr || activeCompany?.name || '';
  const kindBadgeMap = useMemo(() => buildExpenseLineKindBadgeMap(t), [t]);
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
      throwIfApiFailed(res, 'فشل تحميل المدفوعات');
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
      'النوع': kindBadgeMap[inv.kind]?.label || inv.kind,
      'التاريخ': formatSaudiDate(inv.transactionDate),
      'الصافي': Number(inv.netAmount || 0),
      'الضريبة': Number(inv.taxAmount || 0),
      'الإجمالي': Number(inv.totalAmount || 0),
    })),
  [activeItems, kindBadgeMap, lang]);

  function handlePrint() {
    const rows = activeItems.map((inv) =>
      `<tr><td>${(inv.invoiceNumber || '—').replace(/</g, '&lt;')}</td><td>${(inv.supplierInvoiceNumber || '—').replace(/</g, '&lt;')}</td><td>${(inv.supplier?.nameAr || '—').replace(/</g, '&lt;')}</td><td>${(inv.expenseLine?.nameAr || '—').replace(/</g, '&lt;')}</td><td>${String(kindBadgeMap[inv.kind]?.label || inv.kind).replace(/</g, '&lt;')}</td><td>${formatSaudiDate(inv.transactionDate).replace(/</g, '&lt;')}</td><td>${fmt(inv.netAmount).replace(/</g, '&lt;')}</td><td>${fmt(inv.taxAmount).replace(/</g, '&lt;')}</td><td>${fmt(inv.totalAmount).replace(/</g, '&lt;')}</td></tr>`,
    ).join('');
    const printDate = new Date().toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>سجل المدفوعات</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap" rel="stylesheet"><style>@page{size:A4;margin:15mm 15mm 20mm;@bottom-center{content:"صفحة " counter(page) " من " counter(pages);font-family:'Cairo',Arial,sans-serif;font-size:10px;color:#555}}*{box-sizing:border-box}body{font-family:'Cairo',Arial,sans-serif;margin:0;padding:24px;font-size:14px;line-height:1.6}table{width:100%;border-collapse:collapse;font-size:14px}td,th{padding:8px 12px;border:1px solid #ddd}th{background:#185FA5;color:#fff;font-weight:700}.print-footer{margin-top:24px;padding-top:8px;border-top:1px solid #ddd;text-align:center;font-size:11px;color:#777}@media print{body{padding:0}}</style></head><body>
<div style="text-align:center;border-bottom:2px solid #333;padding-bottom:16px;margin-bottom:24px">${companyName ? `<h1 style="margin:0;font-size:20px">${companyName.replace(/</g, '&lt;')}</h1><p style="margin:6px 0 0;font-size:14px">سجل المدفوعات (ثابت + متغير)</p>` : '<h1 style="margin:0;font-size:20px">سجل المدفوعات (ثابت + متغير)</h1>'}<p style="margin:6px 0 0;font-size:12px;color:#555">الإجمالي: ${fmt(totalAmount)} SR</p></div>
<table><thead><tr><th>رقم السند</th><th>رقم فاتورة المورد</th><th>المورد</th><th>بند المصروف</th><th>النوع</th><th>التاريخ</th><th>الصافي</th><th>الضريبة</th><th>الإجمالي</th></tr></thead><tbody>${rows || '<tr><td colspan="9">لا توجد مدفوعات</td></tr>'}</tbody></table>
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

  const columns = useMemo(() => [
    { key: 'invoiceNumber', label: 'رقم السند', minWidth: 110,
      render: (_, row) => <span className="nx-cell-num nx-cell-bold text-[13px]">{row.invoiceNumber || '—'}</span> },
    { key: 'supplierInvoiceNumber', label: 'رقم فاتورة المورد', minWidth: 120,
      render: (_, row) => <span className="nx-cell-num nx-cell-muted text-[13px]">{row.supplierInvoiceNumber || '—'}</span> },
    { key: 'supplierName', label: 'المورد', minWidth: 130,
      render: (_, row) => <span className="text-[13px]">{(lang === 'en' ? row.supplier?.nameEn || row.supplier?.nameAr : row.supplier?.nameAr || row.supplier?.nameEn) || '—'}</span> },
    { key: 'expenseLineName', label: 'بند المصروف', minWidth: 140,
      render: (_, row) => <span className="text-[13px]">{row.expenseLine?.nameAr || row.expenseLine?.nameEn || '—'}</span> },
    { key: 'kind', label: 'النوع', width: 110, minWidth: 100,
      render: (v) => <Badge {...Badge.fromStatus(v, kindBadgeMap)} size="sm" /> },
    { key: 'transactionDate', label: 'التاريخ', minWidth: 110,
      render: (v) => <span className="nx-cell-muted-sm text-[13px]">{formatSaudiDate(v)}</span> },
    { key: 'netAmount', label: 'الصافي', numeric: true, minWidth: 100,
      render: (v) => <FmtNum n={v} className="nx-cell-num nx-cell-num--green text-[13px]" /> },
    { key: 'taxAmount', label: 'الضريبة', numeric: true, minWidth: 100,
      render: (v) => <FmtNum n={v} className="nx-cell-num text-noorix-amber text-[13px]" /> },
    { key: 'totalAmount', label: 'الإجمالي', numeric: true, minWidth: 100,
      render: (v) => <FmtNum n={v} className="nx-cell-num font-bold text-[13px]" /> },
  ], [lang, kindBadgeMap]);

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
        <div className="mb-3 flex min-h-11 flex-col gap-3 border-b border-noorix-border pb-3 lg:flex-row lg:flex-wrap lg:items-center lg:gap-3">
          <div className="min-w-0 flex-1">
            <DateFilterBar filter={dateFilter} />
          </div>
          <label className="nx-checkbox text-[13px] shrink-0">
            <input type="checkbox" checked={showAllDates} onChange={(e) => setShowAllDates(e.target.checked)} />
            عرض الكل (بدون فلتر تاريخ)
          </label>
        </div>
      )}

      <div className="mb-3 flex min-h-11 flex-col gap-3 border-b border-noorix-border pb-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2">
        <div className="nx-toolbar min-w-0 flex-1">
          <div className="w-full min-w-0 sm:w-[min(100%,14rem)] shrink-0">
            <Input
              type="select"
              size="sm"
              value={filterKind}
              onChange={(e) => setFilterKind(e.target.value)}
              className="w-full"
              aria-label={t('paymentHistoryTab')}
            >
              <option value="">الكل (ثابت + متغير)</option>
              <option value="fixed_expense">ثابت فقط</option>
              <option value="expense">متغير فقط</option>
            </Input>
          </div>
          <Button size="sm" className="shrink-0 whitespace-nowrap" onClick={handlePrint} disabled={!activeItems.length}>
            {t('print')}
          </Button>
          <Button size="sm" className="shrink-0 whitespace-nowrap" onClick={() => exportToExcel(exportData, 'payment-history.xlsx')} disabled={!activeItems.length}>
            {t('exportExcel')}
          </Button>
          <Button size="sm" className="shrink-0 whitespace-nowrap" onClick={() => exportTableToPdf({ data: exportData, title: 'سجل المدفوعات (ثابت + متغير)', filename: 'payment-history.pdf' })} disabled={!activeItems.length}>
            {t('exportPdf')}
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
        emptyMessage="لا توجد مدفوعات في الفترة المحددة."
        keyExtractor={(row) => row.id}
        footer={
          activeItems.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-noorix-bg-muted p-4">
              <span className="text-[13px] text-noorix-muted">عدد السجلات: <strong className="text-noorix-text">{activeItems.length}</strong></span>
              <span className="text-[13px]">الصافي: <strong className="nx-cell-num nx-cell-num--green"><FmtNum n={totalNet} /></strong></span>
              <span className="text-[13px]">الضريبة: <strong className="nx-cell-num text-noorix-amber"><FmtNum n={totalTax} /></strong></span>
              <span className="nx-cell-num text-[14px] font-bold">الإجمالي: <FmtNum n={totalAmount} /> <span className="nx-sar">SR</span></span>
            </div>
          ) : null
        }
      />
    </div>
  );
}
