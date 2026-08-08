import React, { useMemo, useCallback } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { exportToExcel } from '../../../utils/exportUtils';
import { buildPrintRecordsTableHtml } from '../../../utils/printTableHtml';
import { fmt } from '../../../utils/format';
import { Button, Badge, ScreenShell, cn, SmartTable, FmtNum, FilterToolbar, SearchableOptionsPicker, usePrintPreview } from '../../../ui';
import type { SmartTableColumn } from '../../../ui';
import { buildExpenseLineKindBadgeMap } from '../../../constants/badgeMaps';
import { useApp } from '../../../context/AppContext';
import { monthlyAmountFromExpenseLine } from '../../Reports/costAccountingAppsFixedExpenseImport';
import type { ExpenseLineKind, ExpenseLineRecord, LoanRecord } from '../../../types/api';
import {
  expenseCategoryDisplayName,
  expenseLineDisplayName,
  expenseLineKindLabel,
  expenseSupplierDisplayName,
} from '../expenseModels';

type ExpenseLineListProps = {
  embedded?: boolean;
  expenseLines: ExpenseLineRecord[];
  loans?: LoanRecord[];
  isLoading: boolean;
  isError: boolean;
  filterKind: ExpenseLineKind | '';
  onFilterKindChange: (kind: ExpenseLineKind | '') => void;
  onCreateLine: () => void;
  onRefresh: () => void;
  onLineClick: (line: ExpenseLineRecord) => void;
  onLoanClick?: (loan: LoanRecord) => void;
  onCreateLoan?: () => void;
};

type ExpenseLineTableRow = {
  id: string;
  recordType: 'expense' | 'loan';
  sourceExpense?: ExpenseLineRecord;
  sourceLoan?: LoanRecord;
  kind: string;
  displayName: string;
  categoryName: string;
  supplierName: string;
  serviceNumber: string | null;
  monthlyAmount: number | null;
  annualAmount: number | null;
  outstandingAmount: number | null;
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
  loans = [],
  isLoading,
  isError,
  filterKind,
  onFilterKindChange,
  onCreateLine,
  onRefresh,
  onLineClick,
  onLoanClick,
  onCreateLoan,
}: ExpenseLineListProps) {
  const { t, lang } = useTranslation();
  const { activeCompanyId, companies = [] } = useApp();
  const activeCompany = companies.find((company) => company.id === activeCompanyId);
  const companyName = activeCompany?.nameAr || activeCompany?.name || '';
  const companyLogoUrl = String(activeCompany?.logoUrl || '').trim();
  const { openPrintDocumentPreview, printPreviewModal } = usePrintPreview({
    title: t('expenseLinesPrintTitle'),
    closeLabel: t('close') || 'إغلاق',
    printLabel: `${t('print')} / PDF`,
  });
  const kindBadgeMap = useMemo(() => buildExpenseLineKindBadgeMap(t), [t]);

  const kindFilterOptions = useMemo(
    () => [
      { value: 'fixed_expense', label: t('fixedExpense') },
      { value: 'expense', label: t('variableExpense') },
    ],
    [t],
  );

  const tableData = useMemo<ExpenseLineTableRow[]>(() => {
    const expenseRows = expenseLines.map((line) => {
        const { monthly, annual } = monthlyAnnualForExpenseLineRow(line);
        return {
          id: line.id,
          recordType: 'expense' as const,
          sourceExpense: line,
          kind: line.kind,
          displayName: expenseLineDisplayName(line, lang),
          categoryName: expenseCategoryDisplayName(line.category, lang),
          supplierName: expenseSupplierDisplayName(line.supplier, lang),
          serviceNumber: line.serviceNumber || null,
          monthlyAmount: monthly,
          annualAmount: annual,
          outstandingAmount: null,
        };
      });
    const loanRows = (filterKind ? [] : loans).map((loan) => ({
      id: loan.id,
      recordType: 'loan' as const,
      sourceLoan: loan,
      kind: 'loan',
      displayName: loan.nameAr,
      categoryName: 'التزامات مالية',
      supplierName: loan.creditorName || '-',
      serviceNumber: loan.dueDate ? String(loan.dueDate).slice(0, 10) : null,
      monthlyAmount: null,
      annualAmount: null,
      outstandingAmount: Number(loan.outstandingAmount),
    }));
    return [...expenseRows, ...loanRows];
  }, [expenseLines, loans, lang, filterKind]);

  const columns = useMemo<SmartTableColumn<ExpenseLineTableRow>[]>(() => [
    {
      key: 'displayName',
      size: 'name',
      label: t('expenseLineNameCol'),
      sortable: true,
      render: (_value, row) => (
        <Button
          variant="raw"
          size="auto"
          className="nx-expense-line-name-cell nx-cell-bold nx-expense-line-cell !h-auto !min-h-0 w-full max-w-full cursor-pointer !p-0 text-start font-bold text-noorix-blue hover:underline"
          onClick={() => row.recordType === 'loan' ? onLoanClick?.(row.sourceLoan!) : onLineClick(row.sourceExpense!)}
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
      shrink: true,
      render: (value) => {
        const { color } = value === 'loan' ? { color: 'violet' } : Badge.fromStatus(value, kindBadgeMap);
        return (
          <div className="flex justify-center">
            <Badge color={color} size="sm" className="whitespace-nowrap">
              {value === 'loan' ? 'قرض' : expenseLineKindLabel(String(value), lang)}
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
      render: (value) => <ExpenseLineTextCell value={String(value || '-')} />,
    },
    {
      key: 'supplierName',
      size: 'supplier',
      label: t('supplier'),
      sortable: true,
      render: (value) => <ExpenseLineTextCell value={String(value || '-')} />,
    },
    {
      key: 'serviceNumber',
      size: 'code-sm',
      label: t('expenseLineServiceNumberCol'),
      shrink: true,
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
      numeric: true,
      render: (_value, row) => <ExpenseLineMoneyCell amount={row.monthlyAmount} />,
    },
    {
      key: 'annualAmount',
      size: 'money-md',
      label: <span className="nx-expense-line-th-money" title={t('expenseLineListAnnualAmount')}>{t('expenseLineAnnualColShort')}</span>,
      shrink: true,
      numeric: true,
      render: (_value, row) => <ExpenseLineMoneyCell amount={row.annualAmount} />,
    },
    {
      key: 'outstandingAmount',
      size: 'money-md',
      label: 'الرصيد المتبقي',
      shrink: true,
      numeric: true,
      render: (_value, row) => <ExpenseLineMoneyCell amount={row.outstandingAmount} />,
    },
  ], [onLineClick, kindBadgeMap, t, lang]);

  const exportData = useMemo(
    () =>
      tableData.map((row) => {
        const kindLabel = row.recordType === 'loan' ? 'قرض' : expenseLineKindLabel(row.kind, lang);
        const category = row.categoryName && row.categoryName !== '-' ? row.categoryName : '';
        return {
          [t('expenseLineNameCol')]: row.displayName,
          [t('expenseLineKindCol')]: category ? `${kindLabel} / ${category}` : kindLabel,
          [t('category')]: row.categoryName,
          [t('supplier')]: row.supplierName,
          [t('expenseLineServiceNumberCol')]: row.serviceNumber || '-',
          [t('expenseLineListMonthlyAmount')]: row.monthlyAmount != null ? fmt(row.monthlyAmount) : '-',
          [t('expenseLineListAnnualAmount')]: row.annualAmount != null ? fmt(row.annualAmount) : '-',
          ['الرصيد المتبقي']: row.outstandingAmount != null ? fmt(row.outstandingAmount) : '-',
        };
      }),
    [tableData, t, lang],
  );

  const getRowClassName = useCallback(() => 'nx-expense-line-tr', []);

  function handlePrint() {
    const thMonthly = t('expenseLineListMonthlyAmount');
    const thAnnual = t('expenseLineListAnnualAmount');
    const printTitle = t('expenseLinesPrintTitle');
    openPrintDocumentPreview({
      title: printTitle,
      companyName,
      logoUrl: companyLogoUrl,
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
      {printPreviewModal}
      <FilterToolbar
        className="mb-3 min-h-11 min-w-0 border-b border-noorix-border pb-3"
        filtersClassName="nx-toolbar min-w-0 max-w-full flex-1 overflow-x-auto pb-0.5"
        actions={(
          <div className="flex items-center gap-2">
            {onCreateLoan ? <Button variant="secondary" size="sm" className="shrink-0 whitespace-nowrap" onClick={onCreateLoan}>إضافة قرض</Button> : null}
            <Button variant="primary" size="sm" className="shrink-0 whitespace-nowrap" onClick={onCreateLine}>{t('addExpenseLine')}</Button>
          </div>
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
        <Button size="sm" className="shrink-0 whitespace-nowrap" onClick={() => exportToExcel(exportData, 'expense-lines.xlsx')} disabled={!tableData.length}>{t('exportExcel')}</Button>
        <Button size="sm" className="shrink-0 whitespace-nowrap" onClick={handlePrint} disabled={!tableData.length}>{t('print')} / PDF</Button>
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
          tableMinWidth="70em"
          stickyActionColumn
        />
      </div>
    </ScreenShell>
  );
}
