/**
 * ExpenseLineList — قائمة بنود المصاريف (هاتف 1، كهرب 1، إيجار محل)
 * عند الضغط على بند → فتح تفاصيله وسجل مدفوعاته
 */
import React, { useMemo } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { fmt } from '../../../utils/format';
import { exportToExcel, exportTableToPdf } from '../../../utils/exportUtils';
import SmartTable from '../../../components/common/SmartTable';

const KIND_LABELS = {
  fixed_expense: { label: 'ثابت', bg: 'rgba(100,116,139,0.12)', color: '#64748b' },
  expense: { label: 'متغير', bg: 'rgba(217,119,6,0.12)', color: '#d97706' },
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
  const { t } = useTranslation();

  const columns = useMemo(() => [
    { key: 'nameAr', label: 'اسم البند', sortable: true,
      render: (v, row) => (
        <button
          type="button"
          onClick={() => onLineClick(row)}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            color: 'var(--noorix-accent-blue)',
            fontWeight: 600,
            textAlign: 'inherit',
            fontSize: 'inherit',
          }}
        >
          {v || row.nameEn || '—'}
        </button>
      ) },
    { key: 'kind', label: 'النوع', sortable: true,
      render: (v) => {
        const s = KIND_LABELS[v] || { label: v, bg: 'rgba(100,116,139,0.08)', color: '#64748b' };
        return (
          <span style={{
            padding: '4px 10px',
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 600,
            background: s.bg,
            color: s.color,
          }}>
            {s.label}
          </span>
        );
      } },
    { key: 'categoryName', label: 'الفئة', sortable: true,
      render: (v) => <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>{v || '—'}</span> },
    { key: 'supplierName', label: 'المورد', sortable: true,
      render: (v) => <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>{v || '—'}</span> },
    { key: 'serviceNumber', label: 'رقم الخدمة',
      render: (v) => <span style={{ fontFamily: 'var(--noorix-font-numbers)' }}>{v || '—'}</span> },
    { key: 'actions', label: 'إجراءات',
      render: (_, row) => (
        <span style={{ display: 'inline-flex', gap: 6 }}>
          <button type="button" className="noorix-btn-nav" style={{ fontSize: 12 }} onClick={(e) => { e.stopPropagation(); onEditLine?.(row); }}>تعديل</button>
          <button type="button" className="noorix-btn-nav" style={{ fontSize: 12, color: 'var(--noorix-text-danger)' }} onClick={(e) => { e.stopPropagation(); onDeleteLine?.(row); }}>حذف</button>
        </span>
      ) },
  ], [onLineClick, onEditLine, onDeleteLine]);

  const tableData = useMemo(() =>
    expenseLines.map((line) => ({
      ...line,
      categoryName: line.category?.nameAr || line.category?.nameEn || '—',
      supplierName: line.supplier?.nameAr || line.supplier?.nameEn || '—',
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
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          value={filterKind}
          onChange={(e) => onFilterKindChange(e.target.value)}
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid var(--noorix-border)',
            background: 'var(--noorix-bg-surface)',
            fontSize: 14,
            flex: '0 1 auto',
          }}
        >
          <option value="">{t('allTypes') || 'كل الأنواع'}</option>
          <option value="fixed_expense">{t('fixedExpense') || 'ثابت'}</option>
          <option value="expense">{t('variableExpense') || 'متغير'}</option>
        </select>
        <button
          type="button"
          onClick={onCreateLine}
          style={{
            padding: '10px 16px',
            borderRadius: 8,
            border: '2px solid var(--noorix-accent-blue)',
            background: 'rgba(37,99,235,0.1)',
            color: 'var(--noorix-accent-blue)',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: 14,
            whiteSpace: 'nowrap',
          }}
        >
          + {t('addExpenseLine') || 'إضافة بند مصروف'}
        </button>
        <button
          type="button"
          className="noorix-btn-nav"
          onClick={onRefresh}
          style={{ fontSize: 13 }}
        >
          {t('refresh') || 'تحديث'}
        </button>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button type="button" className="noorix-btn-nav" onClick={handlePrint} disabled={!tableData.length} style={{ fontSize: 13, padding: '8px 14px', minHeight: 36 }}>🖨 {t('print') || 'طباعة'}</button>
          <button type="button" className="noorix-btn-nav" onClick={() => exportToExcel(exportData, 'expense-lines.xlsx')} disabled={!tableData.length} style={{ fontSize: 13, padding: '8px 14px', minHeight: 36 }}>📥 Excel</button>
          <button type="button" className="noorix-btn-nav" onClick={() => exportTableToPdf({ data: exportData, title: 'بنود المصاريف', filename: 'expense-lines.pdf' })} disabled={!tableData.length} style={{ fontSize: 13, padding: '8px 14px', minHeight: 36 }}>📄 PDF</button>
        </div>
      </div>

      <SmartTable
        columns={columns}
        data={tableData}
        showRowNumbers
        rowNumberWidth="1%"
        isLoading={isLoading}
        emptyMessage="لا توجد بنود مصاريف. أضف بنداً جديداً للبدء."
        keyExtractor={(row) => row.id}
      />
    </div>
  );
}
