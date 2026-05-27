/**
 * ExpenseLineList — قائمة بنود المصاريف
 */
import React, { useMemo, useCallback } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { exportToExcel, exportTableToPdf } from '../../../utils/exportUtils';
import { openPrintWindow } from '../../../utils/printUtils';
import { fmt } from '../../../utils/format';
import { Button, Badge, ScreenShell, cn, SmartTable, FmtNum } from '../../../ui';
import { SearchableOptionsPicker } from '../../../components/common/SearchableOptionsPicker';
import { buildExpenseLineKindBadgeMap } from '../../../constants/badgeMaps';
import { useApp } from '../../../context/AppContext';
import { monthlyAmountFromExpenseLine } from '../../Reports/costAccountingAppsFixedExpenseImport';
import {
  ExpenseLineCompactRow,
  ExpenseLineMobileCard,
  expenseLineKindShortLabel,
  type ExpenseLineRowModel,
} from './ExpenseLineListRow';

/** عرض شهري/سنوي تقديري لبند ثابت */
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

  const columns = useMemo(() => [
    {
      key: 'nameAr',
      label: t('expenseLineNameCol'),
      sortable: true,
      width: '18%',
      align: 'start',
      render: (v: any, row: any) => (
        <Button
          variant="raw"
          size="auto"
          className="nx-expense-line-name-cell nx-cell-bold !h-auto !min-h-0 w-full max-w-full cursor-pointer !p-0 text-start text-[13px] font-bold text-noorix-blue hover:underline"
          onClick={() => onLineClick(row)}
        >
          <span className="block min-w-0 truncate" title={v || row.nameEn || ''}>
            {v || row.nameEn || '—'}
          </span>
        </Button>
      ),
    },
    {
      key: 'kind',
      label: t('expenseLineKindCol'),
      sortable: true,
      width: '12%',
      align: 'center',
      render: (v: any) => {
        const { color } = Badge.fromStatus(v, kindBadgeMap);
        return (
          <Badge color={color} size="sm" className="whitespace-nowrap">
            {expenseLineKindShortLabel(v, t)}
          </Badge>
        );
      },
    },
    {
      key: 'categoryName',
      label: t('category'),
      sortable: true,
      width: '14%',
      align: 'start',
      render: (v: any) => (
        <span className="block min-w-0 truncate text-start text-[13px] text-noorix-text" title={v || ''}>
          {v || '—'}
        </span>
      ),
    },
    {
      key: 'supplierName',
      label: t('supplier'),
      sortable: true,
      width: '14%',
      align: 'start',
      render: (v: any) => (
        <span className="block min-w-0 truncate text-start text-[13px] text-noorix-text" title={v || ''}>
          {v || '—'}
        </span>
      ),
    },
    {
      key: 'serviceNumber',
      label: t('expenseLineServiceNumberCol'),
      width: '9%',
      align: 'center',
      render: (v: any) => <span className="nx-cell-num text-[13px]">{v || '—'}</span>,
    },
    {
      key: 'monthlyAmount',
      label: t('expenseLineListMonthlyAmount'),
      width: '11%',
      numeric: true,
      render: (_: unknown, row: any) => {
        const { monthly } = monthlyAnnualForExpenseLineRow(row);
        if (monthly == null) return <span className="text-[13px] text-noorix-muted">—</span>;
        return (
          <span dir="ltr" className="inline-flex items-baseline justify-end gap-0.5">
            <FmtNum n={monthly} className="nx-cell-num text-[13px] font-semibold" />
            <span className="nx-sar text-[11px]">SR</span>
          </span>
        );
      },
    },
    {
      key: 'annualAmount',
      label: t('expenseLineListAnnualAmount'),
      width: '11%',
      numeric: true,
      render: (_: unknown, row: any) => {
        const { annual } = monthlyAnnualForExpenseLineRow(row);
        if (annual == null) return <span className="text-[13px] text-noorix-muted">—</span>;
        return (
          <span dir="ltr" className="inline-flex items-baseline justify-end gap-0.5">
            <FmtNum n={annual} className="nx-cell-num text-[13px] font-semibold" />
            <span className="nx-sar text-[11px]">SR</span>
          </span>
        );
      },
    },
    {
      key: 'actions',
      label: t('actions'),
      width: '11%',
      align: 'center',
      render: (_: any, row: any) => (
        <div className="noorix-actions-row flex flex-nowrap items-center justify-center gap-1.5">
          <Button size="sm" onClick={(e: any) => { e.stopPropagation(); onEditLine?.(row); }}>{t('edit')}</Button>
          <Button size="sm" variant="danger" onClick={(e: any) => { e.stopPropagation(); onDeleteLine?.(row); }}>{t('delete')}</Button>
        </div>
      ),
    },
  ], [onLineClick, onEditLine, onDeleteLine, kindBadgeMap, t]);

  const tableData = useMemo(
    () =>
      expenseLines.map((line: any) => ({
        ...line,
        categoryName:
          (lang === 'en'
            ? line.category?.nameEn || line.category?.nameAr
            : line.category?.nameAr || line.category?.nameEn) || '—',
        supplierName:
          (lang === 'en'
            ? line.supplier?.nameEn || line.supplier?.nameAr
            : line.supplier?.nameAr || line.supplier?.nameEn) || '—',
      })),
    [expenseLines, lang],
  );

  const exportData = useMemo(
    () =>
      tableData.map((r: any) => {
        const { monthly, annual } = monthlyAnnualForExpenseLineRow(r);
        const kindLabel = expenseLineKindShortLabel(r.kind, t);
        const cat = r.categoryName && r.categoryName !== '—' ? r.categoryName : '';
        return {
          [t('expenseLineNameCol')]: r.nameAr || r.nameEn || '—',
          [t('expenseLineKindCol')]: cat ? `${kindLabel} / ${cat}` : kindLabel,
          [t('supplier')]: r.supplierName,
          [t('expenseLineServiceNumberCol')]: r.serviceNumber || '—',
          [t('expenseLineListMonthlyAmount')]: monthly != null ? fmt(monthly) : '—',
          [t('expenseLineListAnnualAmount')]: annual != null ? fmt(annual) : '—',
        };
      }),
    [tableData, t],
  );

  const rowHandlers = useCallback(
    (row: ExpenseLineRowModel) => ({
      kindShortLabel: expenseLineKindShortLabel(row.kind, t),
      amounts: monthlyAnnualForExpenseLineRow(row),
      onOpen: () => onLineClick(row),
      onEdit: () => onEditLine?.(row),
      onDelete: () => onDeleteLine?.(row),
    }),
    [t, onLineClick, onEditLine, onDeleteLine],
  );

  const renderCompactRow = useCallback(
    (row: ExpenseLineRowModel) => (
      <ExpenseLineCompactRow row={row} kindBadgeMap={kindBadgeMap} {...rowHandlers(row)} />
    ),
    [kindBadgeMap, rowHandlers],
  );

  const renderMobileCard = useCallback(
    (row: ExpenseLineRowModel) => (
      <ExpenseLineMobileCard row={row} kindBadgeMap={kindBadgeMap} {...rowHandlers(row)} />
    ),
    [kindBadgeMap, rowHandlers],
  );

  function handlePrint() {
    const thMonthly = t('expenseLineListMonthlyAmount');
    const thAnnual = t('expenseLineListAnnualAmount');
    const rows = tableData
      .map((r: any) => {
        const { monthly, annual } = monthlyAnnualForExpenseLineRow(r);
        const mCell = monthly != null ? fmt(monthly) : '—';
        const aCell = annual != null ? fmt(annual) : '—';
        const kindLabel = expenseLineKindShortLabel(r.kind, t);
        const cat = r.categoryName && r.categoryName !== '—' ? r.categoryName : '—';
        return `<tr><td>${(r.nameAr || r.nameEn || '—').replace(/</g, '&lt;')}</td><td>${kindLabel.replace(/</g, '&lt;')}</td><td>${cat.replace(/</g, '&lt;')}</td><td>${(r.supplierName || '—').replace(/</g, '&lt;')}</td><td>${(r.serviceNumber || '—').replace(/</g, '&lt;')}</td><td style="text-align:end" dir="ltr">${String(mCell).replace(/</g, '&lt;')}</td><td style="text-align:end" dir="ltr">${String(aCell).replace(/</g, '&lt;')}</td></tr>`;
      })
      .join('');
    const printTitle = t('expenseLinesPrintTitle') || 'بنود المصاريف';
    openPrintWindow({
      title: printTitle,
      companyName,
      subtitle: printTitle,
      body: `<table><thead><tr><th>${t('expenseLineNameCol')}</th><th>${t('expenseLineKindCol')}</th><th>${t('category')}</th><th>${t('supplier')}</th><th>${t('expenseLineServiceNumberCol')}</th><th>${thMonthly}</th><th>${thAnnual}</th></tr></thead><tbody>${rows || '<tr><td colspan="7">لا توجد بيانات</td></tr>'}</tbody></table>`,
    });
  }

  return (
    <ScreenShell embedded={!!embedded} className={cn(embedded && 'pt-4')}>
      <div className="mb-3 flex min-h-11 min-w-0 flex-col gap-3 border-b border-noorix-border pb-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2">
        <div className="nx-toolbar min-w-0 max-w-full flex-1 overflow-x-auto pb-0.5">
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
          <Button size="sm" className="shitespace-nowrap shrink-0" icon={REFRESH_ICON} onClick={onRefresh}>
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

      <div className="nx-expense-line-table-wrap min-w-0">
        <SmartTable
          compact
          showRowNumbers
          rowNumberWidth={44}
          innerPadding={0}
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
          tableMinWidth={1040}
          stickyActionColumn={false}
        />
      </div>
    </ScreenShell>
  );
}
