/**
 * ExpenseLineList — قائمة بنود المصاريف (جدول موحّد على كل العروض)
 */
import React, { useMemo, useCallback } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { exportToExcel, exportTableToPdf } from '../../../utils/exportUtils';
import { buildPrintRecordsTableHtml } from '../../../utils/printTableHtml';
import { openPrintWindow } from '../../../utils/printUtils';
import { fmt } from '../../../utils/format';
import { Button, Badge, ScreenShell, cn, SmartTable, FmtNum, KebabMenu, FilterToolbar, SearchableOptionsPicker } from '../../../ui';
import { buildExpenseLineKindBadgeMap } from '../../../constants/badgeMaps';
import { useApp } from '../../../context/AppContext';
import { monthlyAmountFromExpenseLine } from '../../Reports/costAccountingAppsFixedExpenseImport';
import { expenseLineDisplayName, expenseLineKindShortLabel } from './expenseLineTableUtils';

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

function ExpenseLineMoneyCell({ amount }: { amount: number | null }) {
  if (amount == null) {
    return <span className="nx-expense-line-cell nx-expense-line-cell--muted">—</span>;
  }
  return (
    <span dir="ltr" className="nx-expense-line-money inline-flex max-w-full items-baseline justify-end gap-0.5">
      <FmtNum n={amount} className="nx-cell-num nx-expense-line-cell font-semibold tabular-nums" />
      <span className="nx-sar nx-expense-line-cell-sar">SR</span>
    </span>
  );
}

function ExpenseLineTextCell({ value, muted }: { value: string; muted?: boolean }) {
  const text = value && value !== '—' ? value : '—';
  return (
    <span
      className={cn(
        'nx-expense-line-cell block min-w-0 truncate',
        muted || text === '—' ? 'nx-expense-line-cell--muted' : 'text-noorix-text',
      )}
      title={text !== '—' ? text : undefined}
    >
      {text}
    </span>
  );
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
      key: 'displayName',
      label: t('expenseLineNameCol'),
      sortable: true,
      width: '22%',
      minWidth: '11em',
      cellClassName: 'nx-col-expense-name',
      align: 'start',
      render: (_v: any, row: any) => (
        <Button
          variant="raw"
          size="auto"
          className="nx-expense-line-name-cell nx-cell-bold nx-expense-line-cell !h-auto !min-h-0 w-full max-w-full cursor-pointer !p-0 text-start font-bold text-noorix-blue hover:underline"
          onClick={() => onLineClick(row)}
        >
          <span className="block min-w-0 truncate" title={row.displayName}>
            {row.displayName}
          </span>
        </Button>
      ),
    },
    {
      key: 'kind',
      label: t('expenseLineKindCol'),
      sortable: true,
      minWidth: '7.5em',
      shrink: true,
      cellClassName: 'nx-col-expense-kind',
      align: 'center',
      render: (v: any) => {
        const { color } = Badge.fromStatus(v, kindBadgeMap);
        return (
          <div className="flex justify-center">
            <Badge color={color} size="sm" className="whitespace-nowrap">
              {expenseLineKindShortLabel(v, t)}
            </Badge>
          </div>
        );
      },
    },
    {
      key: 'categoryName',
      label: t('category'),
      sortable: true,
      width: '14%',
      minWidth: '8.5em',
      cellClassName: 'nx-col-expense-text',
      align: 'start',
      render: (v: any) => <ExpenseLineTextCell value={v} />,
    },
    {
      key: 'supplierName',
      label: t('supplier'),
      sortable: true,
      width: '14%',
      minWidth: '8.5em',
      cellClassName: 'nx-col-expense-text',
      align: 'start',
      render: (v: any) => <ExpenseLineTextCell value={v} />,
    },
    {
      key: 'serviceNumber',
      label: t('expenseLineServiceNumberCol'),
      width: '1%',
      minWidth: '4.75em',
      maxWidth: '13ch',
      shrink: true,
      cellClassName: 'nx-col-expense-service',
      align: 'center',
      render: (v: any) => (
        <span
          dir="ltr"
          className="nx-cell-num nx-expense-line-cell mx-auto block max-w-full min-w-0 truncate text-center tabular-nums text-noorix-text"
          title={v ? String(v) : undefined}
        >
          {v || '—'}
        </span>
      ),
    },
    {
      key: 'monthlyAmount',
      label: (
        <span className="nx-expense-line-th-money" title={t('expenseLineListMonthlyAmount')}>
          {t('expenseLineMonthlyColShort')}
        </span>
      ),
      shrink: true,
      cellClassName: 'nx-col-expense-money',
      numeric: true,
      render: (_: unknown, row: any) => (
        <ExpenseLineMoneyCell amount={monthlyAnnualForExpenseLineRow(row).monthly} />
      ),
    },
    {
      key: 'annualAmount',
      label: (
        <span className="nx-expense-line-th-money" title={t('expenseLineListAnnualAmount')}>
          {t('expenseLineAnnualColShort')}
        </span>
      ),
      shrink: true,
      cellClassName: 'nx-col-expense-money',
      numeric: true,
      render: (_: unknown, row: any) => (
        <ExpenseLineMoneyCell amount={monthlyAnnualForExpenseLineRow(row).annual} />
      ),
    },
    {
      key: 'actions',
      label: t('actions'),
      minWidth: '3.25em',
      shrink: true,
      cellClassName: 'nx-col-expense-actions',
      align: 'center',
      render: (_: any, row: any) => (
        <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
          <KebabMenu
            ariaLabel={t('actions')}
            items={[
              {
                key: 'open',
                label: t('view'),
                onClick: () => onLineClick(row),
              },
              {
                key: 'edit',
                label: t('edit'),
                style: { color: 'var(--noorix-accent-green)' },
                onClick: () => onEditLine?.(row),
              },
              {
                key: 'delete',
                label: t('delete'),
                style: { color: 'var(--noorix-accent-red)' },
                onClick: () => onDeleteLine?.(row),
              },
            ]}
          />
        </div>
      ),
    },
  ], [onLineClick, onEditLine, onDeleteLine, kindBadgeMap, t, lang]);

  const tableData = useMemo(
    () =>
      expenseLines.map((line: any) => ({
        ...line,
        displayName: expenseLineDisplayName(line, lang),
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
          [t('expenseLineNameCol')]: r.displayName,
          [t('expenseLineKindCol')]: cat ? `${kindLabel} / ${cat}` : kindLabel,
          [t('category')]: r.categoryName,
          [t('supplier')]: r.supplierName,
          [t('expenseLineServiceNumberCol')]: r.serviceNumber || '—',
          [t('expenseLineListMonthlyAmount')]: monthly != null ? fmt(monthly) : '—',
          [t('expenseLineListAnnualAmount')]: annual != null ? fmt(annual) : '—',
        };
      }),
    [tableData, t],
  );

  const getRowClassName = useCallback(() => 'nx-expense-line-tr', []);

  function handlePrint() {
    const thMonthly = t('expenseLineListMonthlyAmount');
    const thAnnual = t('expenseLineListAnnualAmount');
    const printTitle = t('expenseLinesPrintTitle') || 'بنود المصاريف';
    openPrintWindow({
      title: printTitle,
      companyName,
      subtitle: printTitle,
      body: buildPrintRecordsTableHtml({
        records: exportData,
        emptyMessage: 'لا توجد بيانات',
        numericKeys: [thMonthly, thAnnual],
      }),
    });
  }

  return (
    <ScreenShell embedded={!!embedded} className={cn(embedded && 'pt-4')}>
      <FilterToolbar
        className="mb-3 min-h-11 min-w-0 border-b border-noorix-border pb-3"
        filtersClassName="nx-toolbar min-w-0 max-w-full flex-1 overflow-x-auto pb-0.5"
        actions={(
          <Button variant="primary" size="sm" className="shrink-0 whitespace-nowrap" onClick={onCreateLine}>
            {t('addExpenseLine')}
          </Button>
        )}
      >
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
          <Button size="sm" className="shrink-0 whitespace-nowrap" icon={REFRESH_ICON} onClick={onRefresh}>
            {t('refresh')}
          </Button>
          <Button size="sm" className="shrink-0 whitespace-nowrap" onClick={handlePrint} disabled={!tableData.length}>
            {t('print')}
          </Button>
          <Button size="sm" className="shrink-0 whitespace-nowrap" onClick={() => exportToExcel(exportData, 'expense-lines.xlsx')} disabled={!tableData.length}>
            {t('exportExcel')}
          </Button>
          <Button size="sm" className="shrink-0 whitespace-nowrap" onClick={() => exportTableToPdf({ data: exportData, title: t('expenseLinesPrintTitle'), filename: 'expense-lines.pdf' })} disabled={!tableData.length}>
            {t('exportPdf')}
          </Button>
      </FilterToolbar>

      <div className="nx-expense-line-table-wrap min-w-0">
        <SmartTable
          compact
          showRowNumbers
          rowNumberWidth="2.25em"
          innerPadding={8}
          columns={columns}
          data={tableData}
          isLoading={isLoading}
          title={t('expenseLinesTab')}
          badge={<span className="nx-pill nx-pill--blue nx-pill--sm">{tableData.length}</span>}
          showSearchInHeader={false}
          emptyMessage={t('expenseLinesEmptyState')}
          keyExtractor={(row: any) => row.id}
          getRowClassName={getRowClassName}
          tableId="expense-lines"
          tableLayout="auto"
          tableMinWidth="62em"
          stickyActionColumn
        />
      </div>
    </ScreenShell>
  );
}
