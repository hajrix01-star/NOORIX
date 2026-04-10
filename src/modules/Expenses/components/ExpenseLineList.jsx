/**
 * ExpenseLineList — قائمة بنود المصاريف
 * نفس إيقاع StaffListScreen: ScreenShell embedded + pt-4، شريط mb-3 min-h-11 border-b، SmartTable compact + innerPadding 8
 */
import React, { useMemo, useCallback } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { exportToExcel, exportTableToPdf } from '../../../utils/exportUtils';
import SmartTable from '../../../components/common/SmartTable';
import { Button, Badge, Input, ScreenShell, cn } from '../../../ui';
import { buildExpenseLineKindBadgeMap } from '../../../constants/badgeMaps';
import { useApp } from '../../../context/AppContext';

const KIND_LABELS = {
  fixed_expense: { label: 'ثابت', bg: 'var(--noorix-muted-12)', color: 'var(--noorix-text-muted)' },
  expense: { label: 'متغير', bg: 'var(--noorix-amber-12)', color: 'var(--noorix-accent-amber)' },
};

const REFRESH_ICON = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M3 21v-5h5" />
  </svg>
);

export default function ExpenseLineList({
  embedded,
  expenseLines,
  isLoading,
  filterKind,
  onFilterKindChange,
  onCreateLine,
  onRefresh,
  onLineClick,
  onEditLine,
  onDeleteLine,
}) {
  const { t, lang } = useTranslation();
  const { activeCompanyId, companies = [] } = useApp();
  const activeCompany = companies.find((c) => c.id === activeCompanyId);
  const companyName = activeCompany?.nameAr || activeCompany?.name || '';
  const kindBadgeMap = useMemo(() => buildExpenseLineKindBadgeMap(t), [t]);

  const columns = useMemo(() => [
    {
      key: 'nameAr',
      label: 'اسم البند',
      sortable: true,
      minWidth: 160,
      render: (v, row) => (
        <Button
          variant="raw"
          size="auto"
          className="nx-cell-bold text-[13px] text-noorix-blue hover:underline cursor-pointer p-0 bg-transparent text-start max-w-full"
          onClick={() => onLineClick(row)}
        >
          {v || row.nameEn || '—'}
        </Button>
      ),
    },
    {
      key: 'kind',
      label: 'النوع',
      sortable: true,
      width: 110,
      minWidth: 100,
      render: (v) => <Badge {...Badge.fromStatus(v, kindBadgeMap)} size="sm" />,
    },
    {
      key: 'categoryName',
      label: 'الفئة',
      sortable: true,
      minWidth: 120,
      render: (v) => <span className="nx-cell-ellipsis text-[13px]">{v || '—'}</span>,
    },
    {
      key: 'supplierName',
      label: 'المورد',
      sortable: true,
      minWidth: 120,
      render: (v) => <span className="nx-cell-ellipsis text-[13px]">{v || '—'}</span>,
    },
    {
      key: 'serviceNumber',
      label: 'رقم الخدمة',
      width: 120,
      minWidth: 100,
      render: (v) => <span className="nx-cell-num text-[13px]">{v || '—'}</span>,
    },
    {
      key: 'actions',
      label: 'إجراءات',
      width: '5%',
      align: 'center',
      render: (_, row) => (
        <span className="inline-flex gap-1.5">
          <Button size="sm" onClick={(e) => { e.stopPropagation(); onEditLine?.(row); }}>{t('edit')}</Button>
          <Button size="sm" variant="danger" onClick={(e) => { e.stopPropagation(); onDeleteLine?.(row); }}>{t('delete')}</Button>
        </span>
      ),
    },
  ], [onLineClick, onEditLine, onDeleteLine, kindBadgeMap, t]);

  const tableData = useMemo(() =>
    expenseLines.map((line) => ({
      ...line,
      categoryName: line.category?.nameAr || line.category?.nameEn || '—',
      supplierName: (lang === 'en' ? line.supplier?.nameEn || line.supplier?.nameAr : line.supplier?.nameAr || line.supplier?.nameEn) || '—',
    })),
  [expenseLines, lang]);

  const exportData = useMemo(() =>
    tableData.map((r) => ({
      'اسم البند': r.nameAr || r.nameEn || '—',
      'النوع': KIND_LABELS[r.kind]?.label || r.kind,
      'الفئة': r.categoryName,
      'المورد': r.supplierName,
      'رقم الخدمة': r.serviceNumber || '—',
    })),
  [tableData]);

  const renderMobileCard = useCallback((row) => (
    <div>
      <div className="flex justify-between items-start mb-2">
        <Button
          variant="raw"
          size="auto"
          className="nx-mc__name text-noorix-blue font-bold text-[14px] hover:underline cursor-pointer p-0 bg-transparent text-start"
          onClick={() => onLineClick(row)}
        >
          {row.nameAr || row.nameEn || '—'}
        </Button>
        <Badge {...Badge.fromStatus(row.kind, kindBadgeMap)} size="sm" />
      </div>
      <div className="text-[12px] text-noorix-muted mb-2 flex flex-wrap gap-2.5">
        {row.categoryName && row.categoryName !== '—' && <span>{row.categoryName}</span>}
        {row.supplierName && row.supplierName !== '—' && <span>{row.supplierName}</span>}
        {row.serviceNumber && <span className="nx-cell-num">#{row.serviceNumber}</span>}
      </div>
      <div className="flex gap-2 justify-end">
        <Button size="sm" onClick={() => onEditLine?.(row)}>{t('edit')}</Button>
        <Button size="sm" variant="danger" onClick={() => onDeleteLine?.(row)}>{t('delete')}</Button>
      </div>
    </div>
  ), [onLineClick, onEditLine, onDeleteLine, kindBadgeMap, t]);

  function handlePrint() {
    const rows = tableData.map((r) =>
      `<tr><td>${(r.nameAr || r.nameEn || '—').replace(/</g, '&lt;')}</td><td>${(KIND_LABELS[r.kind]?.label || r.kind).replace(/</g, '&lt;')}</td><td>${(r.categoryName || '—').replace(/</g, '&lt;')}</td><td>${(r.supplierName || '—').replace(/</g, '&lt;')}</td><td>${(r.serviceNumber || '—').replace(/</g, '&lt;')}</td></tr>`,
    ).join('');
    const printTitle = String(t('expenseLinesPrintTitle') || '').replace(/</g, '&lt;');
    const printDate = new Date().toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${printTitle}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap" rel="stylesheet"><style>@page{size:A4;margin:15mm 15mm 20mm;@bottom-center{content:"صفحة " counter(page) " من " counter(pages);font-family:'Cairo',Arial,sans-serif;font-size:10px;color:#555}}*{box-sizing:border-box}body{font-family:'Cairo',Arial,sans-serif;margin:0;padding:24px;font-size:14px;color:#1a1a1a;line-height:1.6}table{width:100%;border-collapse:collapse;font-size:14px}td,th{padding:8px 12px;border:1px solid #ddd}th{background:#2563eb;color:#fff;font-weight:700}.print-footer{margin-top:24px;padding-top:8px;border-top:1px solid #ddd;text-align:center;font-size:11px;color:#777}@media print{body{padding:0}}</style></head><body>
<div style="text-align:center;border-bottom:2px solid #333;padding-bottom:16px;margin-bottom:24px">${companyName ? `<h1 style="margin:0;font-size:20px">${companyName.replace(/</g, '&lt;')}</h1><p style="margin:6px 0 0;font-size:14px">${printTitle}</p>` : `<h1 style="margin:0;font-size:20px">${printTitle}</h1>`}</div>
<table><thead><tr><th>اسم البند</th><th>النوع</th><th>الفئة</th><th>المورد</th><th>رقم الخدمة</th></tr></thead><tbody>${rows || '<tr><td colspan="5">لا توجد بيانات</td></tr>'}</tbody></table>
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

  return (
    <ScreenShell
      embedded={!!embedded}
      className={cn(
        embedded && 'pt-4',
      )}
    >
      <div className="mb-3 flex min-h-11 flex-col gap-3 border-b border-noorix-border pb-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2">
        <div className="nx-toolbar min-w-0 flex-1">
          <div className="w-full min-w-0 sm:w-[min(100%,11rem)] shrink-0">
            <Input
              type="select"
              size="sm"
              value={filterKind}
              onChange={(e) => onFilterKindChange(e.target.value)}
              className="w-full"
              aria-label={t('allTypes')}
            >
              <option value="">{t('allTypes')}</option>
              <option value="fixed_expense">{t('fixedExpense')}</option>
              <option value="expense">{t('variableExpense')}</option>
            </Input>
          </div>
          <Button
            size="sm"
            className="whitespace-nowrap shrink-0"
            icon={REFRESH_ICON}
            onClick={onRefresh}
          >
            {t('refresh')}
          </Button>
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
        <Button variant="primary" size="sm" className="shrink-0 whitespace-nowrap" onClick={onCreateLine}>
          {t('addExpenseLine')}
        </Button>
      </div>

      <SmartTable
        compact
        showRowNumbers
        rowNumberWidth="1%"
        innerPadding={8}
        columns={columns}
        data={tableData}
        isLoading={isLoading}
        title={t('expenseLinesTab')}
        badge={<span className="nx-pill nx-pill--blue nx-pill--sm">{tableData.length}</span>}
        showSearchInHeader={false}
        emptyMessage={t('expenseLinesEmptyState')}
        keyExtractor={(row) => row.id}
        renderMobileCard={renderMobileCard}
      />
    </ScreenShell>
  );
}
