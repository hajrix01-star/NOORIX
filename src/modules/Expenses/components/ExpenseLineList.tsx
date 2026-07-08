import React, { useMemo, useCallback } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { exportToExcel, exportTableToPdf } from '../../../utils/exportUtils';
import { buildPrintRecordsTableHtml } from '../../../utils/printTableHtml';
import { openPrintWindow } from '../../../utils/printUtils';
import { fmt } from '../../../utils/format';
import { Button, Badge, ScreenShell, cn, SmartTable, FmtNum, KebabMenu, FilterToolbar, SearchableOptionsPicker } from '../../../ui';
import type { SmartTableColumn } from '../../../ui';
import { buildExpenseLineKindBadgeMap } from '../../../constants/badgeMaps';
import { useApp } from '../../../context/AppContext';
import { monthlyAmountFromExpenseLine } from '../../Reports/costAccountingAppsFixedExpenseImport';
import type { ExpenseLineKind, ExpenseLineRecord } from '../../../types/api';
import {
  expenseCategoryDisplayName,
  expenseLineDisplayName,
  expenseLineKindLabel,
  expenseSupplierDisplayName,
} from '../expenseModels';

type ExpenseLineListProps = {
  embedded?: boolean;
  expenseLines: ExpenseLineRecord[];
  isLoading: boolean;
  isError: boolean;
  filterKind: ExpenseLineKind | '';
  onFilterKindChange: (kind: ExpenseLineKind | '') => void;
  onCreateLine: () => void;
  onRefresh: () => void;
  onLineClick: (line: ExpenseLineRecord) => void;
  onEditLine: (line: ExpenseLineRecord) => void;
  onDeleteLine: (line: ExpenseLineRecord) => void;
};

type ExpenseLineTableRow = ExpenseLineRecord & {
  displayName: string;
  categoryName: string;
  supplierName: string;
  monthlyAmount: number | null;
  annualAmount: number | null;
};

const REFRESH_ICON = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M3 21v-5h5" />
  </svg>
);

function monthlyAnnualForExpenseLineRow(line: ExpenseLineRecord) {
  if (line.kind !== 'fixed_expense') return { monthly: null, annual: null };
  const monthly = monthlyAmountFromExpenseLine(line);
  if (monthly == null || monthly.lte(0)) return { monthly: null, annual: null };
  const annualFromRecord = line.annualTotalAmount != null && line.annualTotalAmount !== '' ? Number(line.annualTotalAmount) : Number.NaN;
  const annual = Number.isFinite(annualFromRecord) && annualFromRecord > 0 ? annualFromRecord : monthly.mul(12).toNumber();
  return { monthly: monthly.toNumber(), annual };
}

function ExpenseLineMoneyCell({ amount }: { amount: number | null }) {
  if (amount == null) return <span className="nx-expense-line-cell nx-expense-line-cell--muted">-</span>;
  return (
    <span dir="ltr" className="nx-expense-line-money inline-flex max-w-full items-baseline justify-end gap-0.5">
      <FmtNum n={amount} className="nx-cell-num nx-expense-line-cell font-semibold tabular-nums" />
      <span className="nx-sar nx-expense-line-cell-sar">SR</span>
    </span>
  );
}

function ExpenseLineTextCell({ value, muted }: { value: string; muted?: boolean }) {
  const text = value && value !== '-' ? value : '-';
  return (
    <span
      className={cn(
        'nx-expense-line-cell block min-w-0 truncate',
        muted || text === '-' ? 'nx-expense-line-cell--muted' : 'text-noorix-text',
      )}
      title={text !== '-' ? text : undefined}
    >
      {text}
    </span>
  );
}

export default function ExpenseLineList({
  embedded,
  expenseLines,
  isLoading,
  isError,
  filterKind,
  onFilterKindChange,
  onCreateLine,
  onRefresh,
  onLineClick,
  onEditLine,
  onDeleteLine,
}: ExpenseLineListProps) {
  const { t, lang } = useTranslation();
  const { activeCompanyId, companies = [] } = useApp();
  const activeCompany = companies.find((company) => company.id === activeCompanyId);
  const companyName = activeCompany?.nameAr || activeCompany?.name || '';
  const kindBadgeMap = useMemo(() => buildExpenseLineKindBadgeMap(t), [t]);

  const kindFilterOptions = useMemo(
    () => [
      { value: 'fixed_expense', label: t('fixedExpense') },
      { value: 'expense', label: t('variableExpense') },
    ],
    [t],
  );

  const tableData = useMemo<ExpenseLineTableRow[]>(
    () =>
      expenseLines.map((line) => {
        const { monthly, annual } = monthlyAnnualForExpenseLineRow(line);
        return {
          ...line,
          displayName: expenseLineDisplayName(line, lang),
          categoryName: expenseCategoryDisplayName(line.category, lang),
          supplierName: expenseSupplierDisplayName(line.supplier, lang),
          monthlyAmount: monthly,
          annualAmount: annual,
        };
      }),
    [expenseLines, lang],
  );

  const columns = useMemo<SmartTableColumn<ExpenseLineTableRow>[]>(() => [
    {
      key: 'displayName',
      size: 'name',
      label: t('expenseLineNameCol'),
      sortable: true,
      width: '22%',
      minWidth: '11em',
      cellClassName: 'nx-col-expense-name',
      align: 'start',
      render: (_value, row) => (
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
      size: 'document',
      label: t('expenseLineKindCol'),
      sortable: true,
      minWidth: '7.5em',
      shrink: true,
      cellClassName: 'nx-col-expense-kind',
      align: 'center',
      render: (value) => {
        const { color } = Badge.fromStatus(value, kindBadgeMap);
        return (
          <div className="flex justify-center">
            <Badge color={color} size="sm" className="whitespace-nowrap">
              {expenseLineKindLabel(String(value), lang)}
            </Badge>
          </div>
        );
      },
    },
    {
      key: 'categoryName',
      size: 'name',
      label: t('category'),
      sortable: true,
      width: '14%',
      minWidth: '8.5em',
      cellClassName: 'nx-col-expense-text',
      align: 'start',
      render: (value) => <ExpenseLineTextCell value={String(value || '-')} />,
    },
    {
      key: 'supplierName',
      size: 'supplier',
      label: t('supplier'),
      sortable: true,
      width: '14%',
      minWidth: '8.5em',
      cellClassName: 'nx-col-expense-text',
      align: 'start',
      render: (value) => <ExpenseLineTextCell value={String(value || '-')} />,
    },
    {
      key: 'serviceNumber',
      size: 'code-sm',
      label: t('expenseLineServiceNumberCol'),
      width: '1%',
      minWidth: '4.75em',
      maxWidth: '13ch',
      shrink: true,
      cellClassName: 'nx-col-expense-service',
      align: 'center',
      render: (value) => (
        <span
          dir="ltr"
          className="nx-cell-num nx-expense-line-cell mx-auto block max-w-full min-w-0 truncate text-center tabular-nums text-noorix-text"
          title={value ? String(value) : undefined}
        >
          {String(value || '-')}
        </span>
      ),
    },
    {
      key: 'monthlyAmount',
      size: 'money-sm',
      label: <span className="nx-expense-line-th-money" title={t('expenseLineListMonthlyAmount')}>{t('expenseLineMonthlyColShort')}</span>,
      shrink: true,
      cellClassName: 'nx-col-expense-money',
      numeric: true,
      render: (_value, row) => <ExpenseLineMoneyCell amount={row.monthlyAmount} />,
    },
    {
      key: 'annualAmount',
      size: 'money-md',
      label: <span className="nx-expense-line-th-money" title={t('expenseLineListAnnualAmount')}>{t('expenseLineAnnualColShort')}</span>,
      shrink: true,
      cellClassName: 'nx-col-expense-money',
      numeric: true,
      render: (_value, row) => <ExpenseLineMoneyCell amount={row.annualAmount} />,
    },
    {
      key: 'actions',
      kind: 'actions',
      label: t('actions'),
      minWidth: '3.25em',
      shrink: true,
      cellClassName: 'nx-col-expense-actions',
      align: 'center',
      render: (_value, row) => (
        <div className="flex justify-center" onClick={(event) => event.stopPropagation()}>
          <KebabMenu
            ariaLabel={t('actions')}
            items={[
              { key: 'open', label: t('view'), onClick: () => onLineClick(row) },
              { key: 'edit', label: t('edit'), style: { color: 'var(--noorix-accent-green)' }, onClick: () => onEditLine(row) },
              { key: 'delete', label: t('delete'), style: { color: 'var(--noorix-accent-red)' }, onClick: () => onDeleteLine(row) },
            ]}
          />
        </div>
      ),
    },
  ], [onLineClick, onEditLine, onDeleteLine, kindBadgeMap, t, lang]);

  const exportData = useMemo(
    () =>
      tableData.map((row) => {
        const kindLabel = expenseLineKindLabel(row.kind, lang);
        const category = row.categoryName && row.categoryName !== '-' ? row.categoryName : '';
        return {
          [t('expenseLineNameCol')]: row.displayName,
          [t('expenseLineKindCol')]: category ? `${kindLabel} / ${category}` : kindLabel,
          [t('category')]: row.categoryName,
          [t('supplier')]: row.supplierName,
          [t('expenseLineServiceNumberCol')]: row.serviceNumber || '-',
          [t('expenseLineListMonthlyAmount')]: row.monthlyAmount != null ? fmt(row.monthlyAmount) : '-',
          [t('expenseLineListAnnualAmount')]: row.annualAmount != null ? fmt(row.annualAmount) : '-',
        };
      }),
    [tableData, t, lang],
  );

  const getRowClassName = useCallback(() => 'nx-expense-line-tr', []);

  function handlePrint() {
    const thMonthly = t('expenseLineListMonthlyAmount');
    const thAnnual = t('expenseLineListAnnualAmount');
    const printTitle = t('expenseLinesPrintTitle');
    openPrintWindow({
      title: printTitle,
      companyName,
      subtitle: printTitle,
      body: buildPrintRecordsTableHtml({
        records: exportData,
        emptyMessage: t('noData'),
        numericKeys: [thMonthly, thAnnual],
      }),
    });
  }

  if (isError) {
    return (
      <ScreenShell embedded={!!embedded} className={cn(embedded && 'pt-4')}>
        <div className="noorix-surface-card nx-empty-state text-noorix-red">{t('loadingError')}</div>
      </ScreenShell>
    );
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
            onChange={(value) => onFilterKindChange(value === 'fixed_expense' || value === 'expense' ? value : '')}
            options={kindFilterOptions}
          />
        </div>
        <Button size="sm" className="shrink-0 whitespace-nowrap" icon={REFRESH_ICON} onClick={onRefresh}>{t('refresh')}</Button>
        <Button size="sm" className="shrink-0 whitespace-nowrap" onClick={handlePrint} disabled={!tableData.length}>{t('print')}</Button>
        <Button size="sm" className="shrink-0 whitespace-nowrap" onClick={() => exportToExcel(exportData, 'expense-lines.xlsx')} disabled={!tableData.length}>{t('exportExcel')}</Button>
        <Button size="sm" className="shrink-0 whitespace-nowrap" onClick={() => exportTableToPdf({ data: exportData, title: t('expenseLinesPrintTitle'), filename: 'expense-lines.pdf' })} disabled={!tableData.length}>{t('exportPdf')}</Button>
      </FilterToolbar>

      <div className="nx-expense-line-table-wrap min-w-0">
        <SmartTable
          compact
          showRowNumbers
          innerPadding={8}
          columns={columns}
          data={tableData}
          isLoading={isLoading}
          title={t('expenseLinesTab')}
          badge={<span className="nx-pill nx-pill--blue nx-pill--sm">{tableData.length}</span>}
          showSearchInHeader={false}
          emptyMessage={t('expenseLinesEmptyState')}
          keyExtractor={(row) => row.id}
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
