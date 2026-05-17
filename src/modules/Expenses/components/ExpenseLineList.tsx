/**
 * ExpenseLineList — قائمة بنود المصاريف
 * نفس إيقاع StaffListScreen: ScreenShell embedded + pt-4، شريط mb-3 min-h-11 border-b، SmartTable compact + innerPadding 8
 */
import React, { useMemo, useCallback } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { exportToExcel, exportTableToPdf } from '../../../utils/exportUtils';
import { openPrintWindow } from '../../../utils/printUtils';
import { fmt } from '../../../utils/format';
import { Button, Badge, ScreenShell, cn, KebabMenu, SmartTable, FmtNum } from '../../../ui';
import { SearchableOptionsPicker } from '../../../components/common/SearchableOptionsPicker';
import { buildExpenseLineKindBadgeMap } from '../../../constants/badgeMaps';
import { useApp } from '../../../context/AppContext';
import { monthlyAmountFromExpenseLine } from '../../Reports/costAccountingAppsFixedExpenseImport';

/** عرض شهري/سنوي تقديري لبند ثابت (نفس منطق الاستيراد في حاسبة التكاليف). */
function monthlyAnnualForExpenseLineRow(line: { kind?: string; annualTotalAmount?: unknown } & Record<string, unknown>) {
  if (!line || line.kind !== 'fixed_expense') return { monthly: null as number | null, annual: null as number | null };
  const m = monthlyAmountFromExpenseLine(line);
  if (m == null || m.lte(0)) return { monthly: null, annual: null };
  const annDbRaw = line.annualTotalAmount;
  const annDb = annDbRaw != null && annDbRaw !== '' ? Number(annDbRaw) : Number.NaN;
  const annual = Number.isFinite(annDb) && annDb > 0 ? annDb : m.mul(12).toNumber();
  return { monthly: m.toNumber(), annual };
}


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
}: any) {
  const { t, lang } = useTranslation();
  const { activeCompanyId, companies = [] } = useApp();
  const activeCompany = companies.find((c: any) => c.id === activeCompanyId);
  const companyName = activeCompany?.nameAr || activeCompany?.name || '';
  const kindBadgeMap = useMemo(() => buildExpenseLineKindBadgeMap(t), [t]);

  const kindFilterOptions = useMemo(
    () => [
      { value: 'fixed_expense', label: t('fixedExpense') },
      { value: 'expense', label: t('variableExpense') },
    ],
    [t],
  );

  /** نوع البند (ثابت/متغير) + اسم الفئة المختارة عند العرض */
  const formatKindWithCategory = useCallback((kind: any, categoryName: any) => {
    const cat = categoryName && categoryName !== '—' ? String(categoryName).trim() : '';
    if (kind === 'fixed_expense') {
      const base = t('fixedExpenseType');
      return cat ? `${base} / ${cat}` : base;
    }
    if (kind === 'expense') {
      const base = t('variableExpenseType');
      return cat ? `${base} / ${cat}` : base;
    }
    return kind;
  }, [t]);

  const columns = useMemo(() => [
    {
      key: 'nameAr',
      label: 'اسم البند',
      sortable: true,
      width: '16%',
      render: (v: any, row: any) => (
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
      width: '18%',
      render: (v: any, row: any) => {
        const { color } = Badge.fromStatus(v, kindBadgeMap);
        return (
          <Badge color={color} size="sm" className="max-w-[min(100%,14rem)] whitespace-normal text-start leading-snug">
            {formatKindWithCategory(v, row.categoryName)}
          </Badge>
        );
      },
    },
    {
      key: 'categoryName',
      label: 'الفئة',
      sortable: true,
      width: '14%',
      render: (v: any) => <span className="block min-w-0 truncate text-[13px]" title={v || ''}>{v || '—'}</span>,
    },
    {
      key: 'supplierName',
      label: 'المورد',
      sortable: true,
      width: '14%',
      render: (v: any) => <span className="block min-w-0 truncate text-[13px]" title={v || ''}>{v || '—'}</span>,
    },
    {
      key: 'serviceNumber',
      label: 'رقم الخدمة',
      width: '9%',
      align: 'center',
      render: (v: any) => <span className="nx-cell-num text-[13px]">{v || '—'}</span>,
    },
    {
      key: 'monthlyAmount',
      label: t('expenseLineListMonthlyAmount'),
      width: '10%',
      align: 'center',
      numeric: true,
      render: (_: unknown, row: any) => {
        const { monthly } = monthlyAnnualForExpenseLineRow(row);
        if (monthly == null) return <span className="text-[13px] text-noorix-muted">—</span>;
        return (
          <span dir="ltr" className="inline-block">
            <FmtNum n={monthly} className="nx-cell-num text-[13px]" />
          </span>
        );
      },
    },
    {
      key: 'annualAmount',
      label: t('expenseLineListAnnualAmount'),
      width: '10%',
      align: 'center',
      numeric: true,
      render: (_: unknown, row: any) => {
        const { annual } = monthlyAnnualForExpenseLineRow(row);
        if (annual == null) return <span className="text-[13px] text-noorix-muted">—</span>;
        return (
          <span dir="ltr" className="inline-block">
            <FmtNum n={annual} className="nx-cell-num text-[13px]" />
          </span>
        );
      },
    },
    {
      key: 'actions',
      label: t('actions'),
      width: '12%',
      align: 'center',
      render: (_: any, row: any) => (
        <div className="noorix-actions-row flex flex-wrap justify-center gap-1.5">
          <Button size="sm" onClick={(e: any) => { e.stopPropagation(); onEditLine?.(row); }}>{t('edit')}</Button>
          <Button size="sm" variant="danger" onClick={(e: any) => { e.stopPropagation(); onDeleteLine?.(row); }}>{t('delete')}</Button>
        </div>
      ),
    },
  ], [onLineClick, onEditLine, onDeleteLine, kindBadgeMap, t, formatKindWithCategory]);

  const tableData = useMemo(() =>
    expenseLines.map((line: any) => ({
      ...line,
      categoryName:
        (lang === 'en'
          ? line.category?.nameEn || line.category?.nameAr
          : line.category?.nameAr || line.category?.nameEn) || '—',
      supplierName: (lang === 'en' ? line.supplier?.nameEn || line.supplier?.nameAr : line.supplier?.nameAr || line.supplier?.nameEn) || '—',
    })),
  [expenseLines, lang]);

  const exportData = useMemo(
    () =>
      tableData.map((r: any) => {
        const { monthly, annual } = monthlyAnnualForExpenseLineRow(r);
        return {
          'اسم البند': r.nameAr || r.nameEn || '—',
          'النوع': formatKindWithCategory(r.kind, r.categoryName),
          'المورد': r.supplierName,
          'رقم الخدمة': r.serviceNumber || '—',
          [t('expenseLineListMonthlyAmount')]: monthly != null ? fmt(monthly) : '—',
          [t('expenseLineListAnnualAmount')]: annual != null ? fmt(annual) : '—',
        };
      }),
    [tableData, formatKindWithCategory, t],
  );

  const renderMobileCard = useCallback((row: any) => (
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
        <Badge
          color={Badge.fromStatus(row.kind, kindBadgeMap).color}
          size="sm"
          className="max-w-[min(100%,12rem)] shrink-0 whitespace-normal text-start leading-snug"
        >
          {formatKindWithCategory(row.kind, row.categoryName)}
        </Badge>
      </div>
      <div className="text-[12px] text-noorix-muted mb-2 flex flex-wrap gap-2.5">
        {row.categoryName && row.categoryName !== '—' && <span>{row.categoryName}</span>}
        {row.supplierName && row.supplierName !== '—' && <span>{row.supplierName}</span>}
        {row.serviceNumber && <span className="nx-cell-num">#{row.serviceNumber}</span>}
      </div>
      {(() => {
        const { monthly, annual } = monthlyAnnualForExpenseLineRow(row);
        if (monthly == null && annual == null) return null;
        return (
          <div className="text-[12px] text-noorix-muted mb-2 flex flex-wrap gap-3 gap-y-1" dir="ltr">
            {monthly != null && (
              <span className="tabular-nums">
                {t('expenseLineListMonthlyAmount')}: <FmtNum n={monthly} className="font-semibold text-noorix-text" />
              </span>
            )}
            {annual != null && (
              <span className="tabular-nums">
                {t('expenseLineListAnnualAmount')}: <FmtNum n={annual} className="font-semibold text-noorix-text" />
              </span>
            )}
          </div>
        );
      })()}
      <div className="flex gap-2 justify-end">
        <Button size="sm" onClick={() => onEditLine?.(row)}>{t('edit')}</Button>
        <Button size="sm" variant="danger" onClick={() => onDeleteLine?.(row)}>{t('delete')}</Button>
      </div>
    </div>
  ), [onLineClick, onEditLine, onDeleteLine, kindBadgeMap, t, formatKindWithCategory]);

  const renderCompactRow = useCallback((row: any) => {
    const { monthly, annual } = monthlyAnnualForExpenseLineRow(row);
    return (
      <div onClick={() => onLineClick(row)} style={{ cursor: 'pointer' }}>
        <div className="nx-cr__line1">
          <span className="nx-cr__name text-noorix-blue">{row.nameAr || row.nameEn || '—'}</span>
          <Badge color={Badge.fromStatus(row.kind, kindBadgeMap).color} size="sm">
            {formatKindWithCategory(row.kind, row.categoryName)}
          </Badge>
        </div>
        <div className="nx-cr__line2">
          <div className="nx-cr__line2-start">
            {monthly != null && <span className="nx-cr__meta">{t('expenseLineListMonthlyAmount')}: <FmtNum n={monthly} /></span>}
            {annual != null && <span className="nx-cr__meta">{t('expenseLineListAnnualAmount')}: <FmtNum n={annual} /></span>}
          </div>
          <div className="nx-cr__line2-end">
            <div className="nx-cr__kebab" onClick={(e) => e.stopPropagation()}>
              <KebabMenu
                ariaLabel={t('actions')}
                items={[
                  { key: 'edit', label: t('edit'), style: { color: 'var(--noorix-accent-green)' }, onClick: () => onEditLine?.(row) },
                  { key: 'delete', label: t('delete'), style: { color: 'var(--noorix-accent-red)' }, onClick: () => onDeleteLine?.(row) },
                ]}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }, [onLineClick, onEditLine, onDeleteLine, kindBadgeMap, t, formatKindWithCategory]);

  function handlePrint() {
    const thMonthly = t('expenseLineListMonthlyAmount');
    const thAnnual = t('expenseLineListAnnualAmount');
    const rows = tableData
      .map((r: any) => {
        const { monthly, annual } = monthlyAnnualForExpenseLineRow(r);
        const mCell = monthly != null ? fmt(monthly) : '—';
        const aCell = annual != null ? fmt(annual) : '—';
        return `<tr><td>${(r.nameAr || r.nameEn || '—').replace(/</g, '&lt;')}</td><td>${formatKindWithCategory(r.kind, r.categoryName).replace(/</g, '&lt;')}</td><td>${(r.supplierName || '—').replace(/</g, '&lt;')}</td><td>${(r.serviceNumber || '—').replace(/</g, '&lt;')}</td><td style="text-align:end" dir="ltr">${String(mCell).replace(/</g, '&lt;')}</td><td style="text-align:end" dir="ltr">${String(aCell).replace(/</g, '&lt;')}</td></tr>`;
      })
      .join('');
    const printTitle = t('expenseLinesPrintTitle') || 'بنود المصاريف';
    openPrintWindow({
      title: printTitle,
      companyName,
      subtitle: printTitle,
      body: `<table><thead><tr><th>اسم البند</th><th>النوع</th><th>المورد</th><th>رقم الخدمة</th><th>${thMonthly.replace(/</g, '&lt;')}</th><th>${thAnnual.replace(/</g, '&lt;')}</th></tr></thead><tbody>${rows || '<tr><td colspan="6">لا توجد بيانات</td></tr>'}</tbody></table>`,
    });
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
            <SearchableOptionsPicker
              size="sm"
              className="w-full"
              aria-label={t('allTypes')}
              allowEmpty
              emptyValue=""
              emptyLabel={t('allTypes')}
              value={filterKind}
              onChange={(v) => onFilterKindChange(v)}
              options={kindFilterOptions}
            />
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
        rowNumberWidth={40}
        innerPadding={8}
        columns={columns}
        data={tableData}
        isLoading={isLoading}
        title={t('expenseLinesTab')}
        badge={<span className="nx-pill nx-pill--blue nx-pill--sm">{tableData.length}</span>}
        showSearchInHeader={false}
        emptyMessage={t('expenseLinesEmptyState')}
        keyExtractor={(row: any) => row.id}
        renderCompactRow={renderCompactRow}
        renderMobileCard={renderMobileCard}
        tableId="expense-lines"
        tableLayout="fixed"
        tableMinWidth={1260}
        stickyActionColumn={false}
      />
    </ScreenShell>
  );
}
