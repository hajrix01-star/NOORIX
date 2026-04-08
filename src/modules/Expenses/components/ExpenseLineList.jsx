/**
 * ExpenseLineList — قائمة بنود المصاريف (هاتف 1، كهرب 1، إيجار محل)
 * عند الضغط على بند → فتح تفاصيله وسجل مدفوعاته
 */
import React, { useMemo, useCallback } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { fmt } from '../../../utils/format';
import { exportToExcel, exportTableToPdf } from '../../../utils/exportUtils';
import SmartTable from '../../../components/common/SmartTable';
import { Button, Badge } from '../../../ui';
import { buildExpenseLineKindBadgeMap } from '../../../constants/badgeMaps';

const KIND_LABELS = {
  fixed_expense: { label: 'ثابت', bg: 'var(--noorix-muted-12)', color: 'var(--noorix-text-muted)' },
  expense: { label: 'متغير', bg: 'var(--noorix-amber-12)', color: 'var(--noorix-accent-amber)' },
};

export default function ExpenseLineList({
  expenseLines,
  isLoading,
  onLineClick,
  onEditLine,
  onDeleteLine,
}) {
  const { t, lang } = useTranslation();
  const kindBadgeMap = useMemo(() => buildExpenseLineKindBadgeMap(t), [t]);

  const columns = useMemo(() => [
    { key: 'nameAr', label: 'اسم البند', sortable: true,
      render: (v, row) => (
        <Button
          variant="ghost"
          className="expense-line-name-btn font-semibold p-0 text-noorix-blue"
          onClick={() => onLineClick(row)}
        >
          {v || row.nameEn || '—'}
        </Button>
      ) },
    { key: 'kind', label: 'النوع', sortable: true,
      render: (v) => <Badge {...Badge.fromStatus(v, kindBadgeMap)} size="sm" /> },
    { key: 'categoryName', label: 'الفئة', sortable: true,
      render: (v) => <span className="nx-cell-ellipsis">{v || '—'}</span> },
    { key: 'supplierName', label: 'المورد', sortable: true,
      render: (v) => <span className="nx-cell-ellipsis">{v || '—'}</span> },
    { key: 'serviceNumber', label: 'رقم الخدمة',
      render: (v) => <span className="nx-cell-num">{v || '—'}</span> },
    { key: 'actions', label: 'إجراءات',
      render: (_, row) => (
        <span className="inline-flex gap-1.5">
          <Button size="sm" onClick={(e) => { e.stopPropagation(); onEditLine?.(row); }}>تعديل</Button>
          <Button size="sm" variant="danger" onClick={(e) => { e.stopPropagation(); onDeleteLine?.(row); }}>حذف</Button>
        </span>
      ) },
  ], [onLineClick, onEditLine, onDeleteLine, kindBadgeMap]);

  const tableData = useMemo(() =>
    expenseLines.map((line) => ({
      ...line,
      categoryName: line.category?.nameAr || line.category?.nameEn || '—',
      supplierName: (lang === 'en' ? line.supplier?.nameEn || line.supplier?.nameAr : line.supplier?.nameAr || line.supplier?.nameEn) || '—',
    })),
    [expenseLines],
  );

  const exportData = useMemo(() =>
    tableData.map((r) => ({
      'اسم البند': r.nameAr || r.nameEn || '—',
      'النوع': KIND_LABELS[r.kind]?.label || r.kind,
      'الفئة': r.categoryName,
      'المورد': r.supplierName,
      'رقم الخدمة': r.serviceNumber || '—',
    })),
    [tableData],
  );

  const renderMobileCard = useCallback((row) => {
    const kindS = KIND_LABELS[row.kind] || { label: row.kind, bg: 'var(--noorix-muted-8)', color: 'var(--noorix-text-muted)' };
    return (
      <div>
        <div className="flex justify-between items-start mb-2">
          <Button
            variant="ghost"
            className="expense-line-name-btn font-bold text-[14px] text-start p-0 text-noorix-blue"
            onClick={() => onLineClick(row)}
          >
            {row.nameAr || row.nameEn || '—'}
          </Button>
          <Badge {...Badge.fromStatus(row.kind, kindBadgeMap)} size="sm" />
        </div>
        <div className="text-[12px] text-noorix-muted mb-2 flex flex flex-wrap gap-2.5">
          {row.categoryName && row.categoryName !== '—' && <span>{row.categoryName}</span>}
          {row.supplierName && row.supplierName !== '—' && <span>{row.supplierName}</span>}
          {row.serviceNumber && <span className="nx-cell-num">#{row.serviceNumber}</span>}
        </div>
        <div className="flex gap-2 justify-end">
          <Button size="sm" onClick={() => onEditLine?.(row)}>تعديل</Button>
          <Button size="sm" variant="danger" onClick={() => onDeleteLine?.(row)}>حذف</Button>
        </div>
      </div>
    );
  }, [onLineClick, onEditLine, onDeleteLine, kindBadgeMap]);

  function handlePrint() {
    const rows = tableData.map((r) =>
      `<tr><td>${(r.nameAr || r.nameEn || '—').replace(/</g, '&lt;')}</td><td>${(KIND_LABELS[r.kind]?.label || r.kind).replace(/</g, '&lt;')}</td><td>${(r.categoryName || '—').replace(/</g, '&lt;')}</td><td>${(r.supplierName || '—').replace(/</g, '&lt;')}</td><td>${(r.serviceNumber || '—').replace(/</g, '&lt;')}</td></tr>`,
    ).join('');
    const printTitle = String(t('expenseLinesPrintTitle') || '').replace(/</g, '&lt;');
    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${printTitle}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap" rel="stylesheet"><style>@page{size:A4;margin:15mm}*{box-sizing:border-box}body{font-family:'Cairo',Arial,sans-serif;margin:0;padding:24px;font-size:14px;color:#1a1a1a;line-height:1.6}table{width:100%;border-collapse:collapse;font-size:14px}td,th{padding:8px 12px;border:1px solid #ddd}th{background:#2563eb;color:#fff;font-weight:700}@media print{body{padding:0}}</style></head><body>
<div style="text-align:center;border-bottom:2px solid #333;padding-bottom:16px;margin-bottom:24px"><h1 style="margin:0;font-size:20px">${printTitle}</h1></div>
<table><thead><tr><th>اسم البند</th><th>النوع</th><th>الفئة</th><th>المورد</th><th>رقم الخدمة</th></tr></thead><tbody>${rows || '<tr><td colspan="5">لا توجد بيانات</td></tr>'}</tbody></table>
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
    <div>
      <div className="mb-3 flex min-h-11 flex-col gap-3 border-b border-noorix-border pb-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-2">
        <div className="nx-toolbar w-full justify-end sm:w-auto">
          <Button size="sm" className="whitespace-nowrap shrink-0" onClick={handlePrint} disabled={!tableData.length}>
            {t('print')}
          </Button>
          <Button size="sm" className="whitespace-nowrap shrink-0" onClick={() => exportToExcel(exportData, 'expense-lines.xlsx')} disabled={!tableData.length}>
            {t('exportExcel')}
          </Button>
          <Button size="sm" className="whitespace-nowrap shrink-0" onClick={() => exportTableToPdf({ data: exportData, title: t('expenseLinesPrintTitle'), filename: 'expense-lines.pdf' })} disabled={!tableData.length}>
            {t('exportPdf')}
          </Button>
        </div>
      </div>

      <SmartTable
        columns={columns}
        data={tableData}
        showRowNumbers
        rowNumberWidth="1%"
        isLoading={isLoading}
        emptyMessage={t('expenseLinesEmptyState')}
        keyExtractor={(row) => row.id}
        renderMobileCard={renderMobileCard}
      />
    </div>
  );
}
