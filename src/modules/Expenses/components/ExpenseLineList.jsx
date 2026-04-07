/**
 * ExpenseLineList — قائمة بنود المصاريف (هاتف 1، كهرب 1، إيجار محل)
 * عند الضغط على بند → فتح تفاصيله وسجل مدفوعاته
 */
import React, { useMemo, useCallback } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { fmt } from '../../../utils/format';
import { exportToExcel, exportTableToPdf } from '../../../utils/exportUtils';
import SmartTable from '../../../components/common/SmartTable';
import { Button, Badge, Input } from '../../../ui';

const KIND_LABELS = {
  fixed_expense: { label: 'ثابت', bg: 'rgba(100,116,139,0.12)', color: '#64748b' },
  expense: { label: 'متغير', bg: 'rgba(217,119,6,0.12)', color: 'var(--noorix-accent-amber)' },
};

const KIND_STATUS_MAP = {
  fixed_expense: { color: 'gray',  label: 'ثابت' },
  expense:       { color: 'amber', label: 'متغير' },
};

export default function ExpenseLineList({
  companyId,
  expenseLines,
  isLoading,
  filterKind,
  onFilterKindChange,
  onLineClick,
  onCreateLine,
  onEditLine,
  onDeleteLine,
  onRefresh,
}) {
  const { t, lang } = useTranslation();

  const columns = useMemo(() => [
    { key: 'nameAr', label: 'اسم البند', sortable: true,
      render: (v, row) => (
        <Button
          variant="ghost"
          className="expense-line-name-btn nx-font-600"
          onClick={() => onLineClick(row)}
          style={{ padding: 0, color: 'var(--noorix-accent-blue)', textAlign: 'inherit', fontSize: 'inherit' }}
        >
          {v || row.nameEn || '—'}
        </Button>
      ) },
    { key: 'kind', label: 'النوع', sortable: true,
      render: (v) => <Badge {...Badge.fromStatus(v, KIND_STATUS_MAP)} size="sm" /> },
    { key: 'categoryName', label: 'الفئة', sortable: true,
      render: (v) => <span className="nx-cell-ellipsis">{v || '—'}</span> },
    { key: 'supplierName', label: 'المورد', sortable: true,
      render: (v) => <span className="nx-cell-ellipsis">{v || '—'}</span> },
    { key: 'serviceNumber', label: 'رقم الخدمة',
      render: (v) => <span className="nx-cell-num">{v || '—'}</span> },
    { key: 'actions', label: 'إجراءات',
      render: (_, row) => (
        <span style={{ display: 'inline-flex', gap: 6 }}>
          <Button size="sm" onClick={(e) => { e.stopPropagation(); onEditLine?.(row); }}>تعديل</Button>
          <Button size="sm" variant="danger" onClick={(e) => { e.stopPropagation(); onDeleteLine?.(row); }}>حذف</Button>
        </span>
      ) },
  ], [onLineClick, onEditLine, onDeleteLine]);

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
    const kindS = KIND_LABELS[row.kind] || { label: row.kind, bg: 'rgba(100,116,139,0.08)', color: '#64748b' };
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <Button
            variant="ghost"
            className="expense-line-name-btn nx-font-700 nx-text-md nx-text-start"
            onClick={() => onLineClick(row)}
            style={{ padding: 0, color: 'var(--noorix-accent-blue)' }}
          >
            {row.nameAr || row.nameEn || '—'}
          </Button>
          <Badge {...Badge.fromStatus(row.kind, KIND_STATUS_MAP)} size="sm" />
        </div>
        <div className="nx-text-sm nx-text-muted nx-mb-8 nx-flex nx-flex-wrap nx-gap-10">
          {row.categoryName && row.categoryName !== '—' && <span>{row.categoryName}</span>}
          {row.supplierName && row.supplierName !== '—' && <span>{row.supplierName}</span>}
          {row.serviceNumber && <span className="nx-cell-num">#{row.serviceNumber}</span>}
        </div>
        <div className="nx-flex nx-gap-8" style={{ justifyContent: 'flex-end' }}>
          <Button size="sm" onClick={() => onEditLine?.(row)}>تعديل</Button>
          <Button size="sm" variant="danger" onClick={() => onDeleteLine?.(row)}>حذف</Button>
        </div>
      </div>
    );
  }, [onLineClick, onEditLine, onDeleteLine]);

  function handlePrint() {
    const rows = tableData.map((r) =>
      `<tr><td>${(r.nameAr || r.nameEn || '—').replace(/</g, '&lt;')}</td><td>${(KIND_LABELS[r.kind]?.label || r.kind).replace(/</g, '&lt;')}</td><td>${(r.categoryName || '—').replace(/</g, '&lt;')}</td><td>${(r.supplierName || '—').replace(/</g, '&lt;')}</td><td>${(r.serviceNumber || '—').replace(/</g, '&lt;')}</td></tr>`,
    ).join('');
    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>بنود المصاريف</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap" rel="stylesheet"><style>@page{size:A4;margin:15mm}*{box-sizing:border-box}body{font-family:'Cairo',Arial,sans-serif;margin:0;padding:24px;font-size:14px;color:#1a1a1a;line-height:1.6}table{width:100%;border-collapse:collapse;font-size:14px}td,th{padding:8px 12px;border:1px solid #ddd}th{background:#2563eb;color:#fff;font-weight:700}@media print{body{padding:0}}</style></head><body>
<div style="text-align:center;border-bottom:2px solid #333;padding-bottom:16px;margin-bottom:24px"><h1 style="margin:0;font-size:20px">بنود المصاريف</h1></div>
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
      <div className="nx-toolbar nx-mb-16">
        <Input
          type="select"
          value={filterKind}
          onChange={(e) => onFilterKindChange(e.target.value)}
        >
          <option value="">{t('allTypes') || 'كل الأنواع'}</option>
          <option value="fixed_expense">{t('fixedExpense') || 'ثابت'}</option>
          <option value="expense">{t('variableExpense') || 'متغير'}</option>
        </Input>
        <Button variant="primary" onClick={onCreateLine}>
          + {t('addExpenseLine') || 'إضافة بند مصروف'}
        </Button>
        <Button onClick={onRefresh}>
          {t('refresh') || 'تحديث'}
        </Button>
        <Button onClick={handlePrint} disabled={!tableData.length}>{t('print') || 'طباعة'}</Button>
        <Button onClick={() => exportToExcel(exportData, 'expense-lines.xlsx')} disabled={!tableData.length}>Excel</Button>
        <Button onClick={() => exportTableToPdf({ data: exportData, title: 'بنود المصاريف', filename: 'expense-lines.pdf' })} disabled={!tableData.length}>PDF</Button>
      </div>

      <SmartTable
        columns={columns}
        data={tableData}
        showRowNumbers
        rowNumberWidth="1%"
        isLoading={isLoading}
        emptyMessage="لا توجد بنود مصاريف. أضف بنداً جديداً للبدء."
        keyExtractor={(row) => row.id}
        renderMobileCard={renderMobileCard}
      />
    </div>
  );
}
