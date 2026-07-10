import React, { useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '../../../hooks/useApiMutation';
import { useApiListQuery } from '../../../hooks/useApiQuery';
import { invalidateOnFinancialMutation } from '../../../utils/queryInvalidation';
import { createInvoiceBatch, getExpenseLines } from '../../../services/api';
import { useVaults } from '../../../hooks/useVaults';
import { expenseKeys } from '../../../services/queryKeys';
import { getSaudiToday } from '../../../utils/saudiDate';
import { vatRateDecimalFromCompany } from '../../../utils/vatRate';
import { useApp } from '../../../context/AppContext';
import { useTranslation } from '../../../i18n/useTranslation';
import { Button, Checkbox, TransactionDatePicker, Input, ScreenShell, cn, FmtNum, SmartTable, SearchableOptionsPicker, SummaryBar } from '../../../ui';
import type { SmartTableColumn } from '../../../ui';
import type { ExpenseLineRecord } from '../../../types/api';
import {
  buildExpenseBatchPayload,
  buildExpenseBatchRows,
  buildExpenseBatchViewRows,
  canShowExpensePaymentExemption,
  paymentVaultOptions,
  summarizeExpenseBatchDraft,
  validExpenseBatchRows,
  type ExpenseBatchRow,
  type ExpenseBatchViewRow,
} from '../expenseModels';

type ExpenseBatchTableProps = {
  companyId: string;
  onSaved: () => void;
  embedded?: boolean;
};

function createExpenseBatchAttemptKey(companyId: string, batchDate: string) {
  const randomPart = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}`;
  return `exp-${companyId}-${batchDate}-${randomPart}`;
}

export default function ExpenseBatchTable({ companyId, onSaved, embedded }: ExpenseBatchTableProps) {
  const { lang, t } = useTranslation();
  const { companies } = useApp();
  const activeCompany = companies.find((company) => company.id === companyId);
  const vatRateDecimal = useMemo(() => vatRateDecimalFromCompany(activeCompany), [activeCompany]);
  const queryClient = useQueryClient();
  const rowSeedRef = useRef(4);
  const [rows, setRows] = useState<ExpenseBatchRow[]>(() => buildExpenseBatchRows(3));
  const [batchDate, setBatchDate] = useState(getSaudiToday());
  const [vaultId, setVaultId] = useState('');

  const { data: expenseLines = [] } = useApiListQuery<ExpenseLineRecord>({
    queryKey: expenseKeys.lines(companyId),
    queryFn: () => getExpenseLines(companyId),
    fallbackMessage: t('loadingError'),
    enabled: !!companyId,
  });

  const { paymentVaults: activeVaults = [] } = useVaults({ companyId });

  const expenseLinePickerOptions = useMemo(
    () =>
      expenseLines.map((line) => ({
        value: line.id,
        label: `${line.nameAr || line.nameEn} (${line.kind === 'fixed_expense' ? t('fixedExpense') : t('variableExpense')})`,
      })),
    [expenseLines, t],
  );

  const vaultPickerOptions = useMemo(() => paymentVaultOptions(activeVaults, lang), [activeVaults, lang]);
  const validRows = useMemo(() => validExpenseBatchRows(rows, expenseLines), [rows, expenseLines]);
  const tableData = useMemo(() => buildExpenseBatchViewRows(rows, expenseLines, lang, vatRateDecimal), [rows, expenseLines, lang, vatRateDecimal]);
  const summary = useMemo(() => summarizeExpenseBatchDraft(rows, expenseLines, vatRateDecimal), [rows, expenseLines, vatRateDecimal]);

  const saveMutation = useApiMutation({
    mutationFn: async () => {
      if (!vaultId) throw new Error(t('expenseBatchSelectVault'));
      if (validRows.length === 0) throw new Error(t('expenseBatchNoValidRows'));
      return createInvoiceBatch(buildExpenseBatchPayload({
        companyId,
        batchDate,
        vaultId,
        idempotencyKey: createExpenseBatchAttemptKey(companyId, batchDate),
        rows,
        expenseLines,
      }));
    },
    successToast: false,
    showErrorToast: true,
    errorToast: (error: Error) => error.message || t('saveFailedGeneric'),
    onSuccess: () => {
      invalidateOnFinancialMutation(queryClient);
      setRows(buildExpenseBatchRows(3, rowSeedRef.current));
      rowSeedRef.current += 3;
      onSaved();
    },
  });

  const updateRow = (index: number, updates: Partial<ExpenseBatchRow>) => {
    setRows((previous) =>
      previous.map((row, rowIndex) => {
        if (rowIndex !== index) return row;
        const next = { ...row, ...updates };
        if (Object.prototype.hasOwnProperty.call(updates, 'expenseLineId') && updates.expenseLineId !== row.expenseLineId) {
          next.exemptThisPayment = false;
        }
        return next;
      }),
    );
  };

  const addRow = () => {
    setRows((previous) => [...previous, buildExpenseBatchRows(1, rowSeedRef.current)[0]]);
    rowSeedRef.current += 1;
  };

  const removeRow = (index: number) => {
    setRows((previous) => (previous.length <= 1 ? buildExpenseBatchRows(1, rowSeedRef.current++) : previous.filter((_row, rowIndex) => rowIndex !== index)));
  };

  const renderMobileCard = (row: ExpenseBatchViewRow) => {
    const index = row.index - 1;
    const line = expenseLines.find((item) => item.id === row.expenseLineId);
    const showExempt = canShowExpensePaymentExemption(line);
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-bold text-noorix-text">#{row.index}</span>
          <Button variant="danger" size="sm" className="min-h-[44px] sm:min-h-0" onClick={() => removeRow(index)}>{t('delete')}</Button>
        </div>
        <SearchableOptionsPicker
          label={t('expenseLineNameCol')}
          size="sm"
          allowEmpty
          emptyValue=""
          emptyLabel={t('select')}
          value={row.expenseLineId}
          onChange={(value) => updateRow(index, { expenseLineId: value })}
          options={expenseLinePickerOptions}
          aria-label={t('expenseLineNameCol')}
        />
        <div className="nx-mc__grid nx-mc__grid--2">
          <div>
            <div className="nx-mc__stat-label">{t('category')}</div>
            <div className="text-[12px] text-noorix-text break-words">{row.categoryName}</div>
          </div>
          <div>
            <div className="nx-mc__stat-label">{t('supplier')}</div>
            <div className="text-[12px] text-noorix-text break-words">{row.supplierName}</div>
          </div>
        </div>
        {showExempt ? (
          <Checkbox
            checked={row.exemptThisPayment}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => updateRow(index, { exemptThisPayment: event.target.checked })}
            className="h-4 w-4 shrink-0 rounded border-noorix-border accent-noorix-blue"
            aria-label={t('expenseBatchTaxExemptHint')}
            label={t('expenseBatchTaxExemptShort')}
            containerClassName="cursor-pointer items-center text-[13px] font-medium text-noorix-text"
          />
        ) : null}
        <Input
          label={t('supplierInvoiceNumber')}
          type="text"
          size="sm"
          value={row.supplierInvoiceNumber}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => updateRow(index, { supplierInvoiceNumber: event.target.value })}
          placeholder={t('optional')}
        />
        <Input
          label={t('total')}
          type="number"
          step="0.01"
          min="0"
          value={row.totalInclusive}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => updateRow(index, { totalInclusive: event.target.value })}
          placeholder="0.00"
        />
        <div className="nx-mc__grid nx-mc__grid--2">
          <div>
            <div className="nx-mc__stat-label">{t('expenseTaxBreakdownNet')}</div>
            <FmtNum n={row.net} className="text-[14px] font-bold text-noorix-green ltr" />
          </div>
          <div>
            <div className="nx-mc__stat-label">{t('expenseTaxBreakdownVat')}</div>
            <FmtNum n={row.tax} className="text-[14px] font-bold text-noorix-amber ltr" />
          </div>
        </div>
        <Input
          label={t('notes')}
          type="text"
          size="sm"
          value={row.notes}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => updateRow(index, { notes: event.target.value })}
          placeholder={t('optional')}
        />
        <Checkbox
          checked={row.warrantyFollowUp}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => updateRow(index, { warrantyFollowUp: event.target.checked })}
          className="h-4 w-4 shrink-0 rounded border-noorix-border accent-noorix-blue"
          aria-label={t('warrantyFollowUpColHint')}
          label={t('warrantyFollowUpCol')}
          containerClassName="cursor-pointer items-center text-[13px] font-medium text-noorix-text"
        />
      </div>
    );
  };

  const columns: SmartTableColumn<ExpenseBatchViewRow>[] = [
    { key: 'index', size: 'count', label: '#', shrink: true, render: (value) => <span className="nx-cell-muted">{String(value ?? '')}</span> },
    {
      key: 'expenseLineId',
      size: 'name',
      label: t('expenseLineNameCol'),
      render: (_value, row) => (
        <SearchableOptionsPicker
          size="sm"
          allowEmpty
          emptyValue=""
          emptyLabel={t('select')}
          value={row.expenseLineId}
          onChange={(value) => updateRow(row.index - 1, { expenseLineId: value })}
          options={expenseLinePickerOptions}
          aria-label={t('expenseLineNameCol')}
        />
      ),
    },
    { key: 'categoryName', size: 'name', label: t('category'), render: (value) => <span className="nx-cell-muted block min-w-0 truncate text-[13px]" title={String(value)}>{String(value)}</span> },
    { key: 'supplierName', size: 'supplier', label: t('supplier'), render: (value) => <span className="nx-cell-muted block min-w-0 truncate text-[13px]" title={String(value)}>{String(value)}</span> },
    {
      key: 'exemptThisPayment',
      size: 'document',
      label: t('expenseBatchTaxExemptShort'),
      align: 'center',
      render: (_value, row) => {
        const line = expenseLines.find((item) => item.id === row.expenseLineId);
        if (!canShowExpensePaymentExemption(line)) return <span className="nx-cell-muted text-[11px]">-</span>;
        return (
          <Checkbox
            checked={row.exemptThisPayment}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => updateRow(row.index - 1, { exemptThisPayment: event.target.checked })}
            className="h-4 w-4 shrink-0 rounded border-noorix-border accent-noorix-blue"
            title={t('expenseBatchTaxExemptHint')}
            aria-label={`${t('expenseBatchTaxExemptHint')} - ${row.index}`}
          />
        );
      },
    },
    {
      key: 'supplierInvoiceNumber',
      size: 'document',
      label: t('supplierInvoiceNumber'),
      render: (value, row) => (
        <Input
          type="text"
          size="sm"
          value={String(value || '')}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => updateRow(row.index - 1, { supplierInvoiceNumber: event.target.value })}
          placeholder={t('optional')}
        />
      ),
    },
    {
      key: 'totalInclusive',
      size: 'money-md',
      label: t('total'),
      render: (value, row) => (
        <Input
          type="number"
          step="0.01"
          min="0"
          value={String(value || '')}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => updateRow(row.index - 1, { totalInclusive: event.target.value })}
          placeholder="0.00"
        />
      ),
    },
    { key: 'net', size: 'money-sm', label: t('expenseTaxBreakdownNet'), numeric: true, render: (value) => <FmtNum n={Number(value)} className="nx-cell-num nx-cell-num--green" /> },
    { key: 'tax', size: 'tax', label: t('expenseTaxBreakdownVat'), numeric: true, render: (value) => <FmtNum n={Number(value)} className="nx-cell-num text-noorix-amber" /> },
    {
      key: 'notes',
      size: 'name',
      label: t('notes'),
      render: (value, row) => (
        <Input
          type="text"
          size="sm"
          value={String(value || '')}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => updateRow(row.index - 1, { notes: event.target.value })}
          placeholder={t('optional')}
        />
      ),
    },
    {
      key: 'warrantyFollowUp',
      size: 'document',
      label: t('warrantyFollowUpCol'),
      align: 'center',
      render: (_value, row) => (
        <Checkbox
          checked={row.warrantyFollowUp}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => updateRow(row.index - 1, { warrantyFollowUp: event.target.checked })}
          className="h-4 w-4 shrink-0 rounded border-noorix-border accent-noorix-blue"
          title={t('warrantyFollowUpColHint')}
          aria-label={`${t('warrantyFollowUpCol')} - ${row.index}`}
        />
      ),
    },
    {
      key: 'actions',
      kind: 'actions',
      label: t('actions'),
      align: 'center',
      render: (_value, row) => (
        <Button variant="danger" size="sm" onClick={() => removeRow(row.index - 1)}>{t('delete')}</Button>
      ),
    },
  ];

  if (!companyId) {
    return (
      <ScreenShell embedded={!!embedded} className={cn(embedded && 'pt-4')}>
        <div className="noorix-surface-card nx-empty-state">{t('pleaseSelectCompany')}</div>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell embedded={!!embedded} className={cn(embedded && 'pt-4')}>
      <div className="mb-3 flex min-h-11 flex-col gap-3 border-b border-noorix-border pb-3 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between lg:gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-0 w-full sm:w-[min(100%,11rem)]">
            <TransactionDatePicker label={t('date')} size="sm" className="w-full min-w-0 max-w-full" value={batchDate} onValueChange={setBatchDate} />
          </div>
          <div className="min-w-0 w-full sm:w-[min(100%,14rem)] sm:max-w-xs">
            <SearchableOptionsPicker
              label={`${t('invoiceVaultColumn')} *`}
              size="sm"
              allowEmpty
              emptyValue=""
              emptyLabel={t('expenseBatchSelectVault')}
              value={vaultId}
              onChange={setVaultId}
              options={vaultPickerOptions}
              aria-label={t('invoiceVaultColumn')}
            />
          </div>
        </div>
        <Button size="sm" className="shrink-0 whitespace-nowrap self-end lg:self-auto" onClick={addRow}>{t('expenseBatchAddRow')}</Button>
      </div>

      <SmartTable
        compact
        innerPadding={8}
        columns={columns}
        data={tableData}
        keyExtractor={(row) => row.key}
        title={t('expenseBatchTab')}
        badge={<span className="nx-pill nx-pill--blue nx-pill--sm">{rows.length}</span>}
        showSearchInHeader={false}
        tableId="expense-batch"
        tableLayout="fixed"
        tableMinWidth={1040}
        stickyActionColumn={false}
        renderMobileCard={renderMobileCard}
        stripeMobileCards
      />

      <SummaryBar
        className="mt-6"
        items={[
          {
            key: 'rows',
            label: t('rows'),
            value: rows.length,
            tone: 'blue',
            helper: `${summary.count} ${t('expenseBatchRowsValidHint')}`,
          },
          { key: 'net', label: t('expenseTaxBreakdownNet'), value: summary.totalNet, tone: 'green', currency: 'SR' },
          { key: 'tax', label: t('expenseTaxBreakdownVat'), value: summary.totalTax, tone: 'amber', currency: 'SR' },
          { key: 'total', label: t('total'), value: summary.total, currency: 'SR' },
        ]}
      />
      <Button
        variant="primary"
        size="md"
        onClick={() => saveMutation.mutate(undefined)}
        disabled={saveMutation.isPending || validRows.length === 0 || !vaultId}
        className="mt-3 w-full min-h-[44px] sm:min-h-0"
      >
        {saveMutation.isPending ? t('saving') : t('save')}
      </Button>
    </ScreenShell>
  );
}
