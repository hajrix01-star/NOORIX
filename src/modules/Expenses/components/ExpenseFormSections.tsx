import React from 'react';
import { Button, Checkbox, FileTrigger, Input, SearchableOptionsPicker } from '../../../ui';
import type { ExpenseLineRecord } from '../../../types/api';
import type { ExpensePaymentFormState } from '../expenseModels';
import { canExemptThisExpensePayment } from '../utils/expenseTax';
import { fmt } from '../../../utils/format';

type TranslateFn = (key: string) => string;
type PickerOption = { value: string; label: string };
type SetExpenseFormField = <K extends keyof ExpensePaymentFormState>(
  key: K,
  value: ExpensePaymentFormState[K],
) => void;

type TaxStatusKind = 'account_exempt' | 'supplier_not_registered' | 'default_taxable' | null;

export function ExpenseTaxGuidance({
  selectedLine,
  taxStatusKind,
  exemptThisPayment,
  setExemptThisPayment,
  t,
}: {
  selectedLine: ExpenseLineRecord | undefined;
  taxStatusKind: TaxStatusKind;
  exemptThisPayment: boolean;
  setExemptThisPayment: (value: boolean) => void;
  t: TranslateFn;
}) {
  return (
    <>
      {selectedLine && taxStatusKind === 'account_exempt' ? <p className="m-0 text-[12px] text-noorix-muted">{t('expenseTaxAccountExemptHint')}</p> : null}
      {selectedLine && taxStatusKind === 'supplier_not_registered' ? <p className="m-0 text-[12px] text-noorix-muted">{t('expenseTaxSupplierNotRegisteredHint')}</p> : null}
      {selectedLine && taxStatusKind === 'default_taxable' ? <p className="m-0 text-[12px] text-noorix-muted">{t('expenseTaxDefaultFromSupplierHint')}</p> : null}

      {selectedLine && canExemptThisExpensePayment(selectedLine) ? (
        <label className="flex min-h-[44px] cursor-pointer items-start gap-2.5 rounded-lg border border-noorix-border bg-noorix-surface px-3 py-2.5">
          <Checkbox
            checked={exemptThisPayment}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setExemptThisPayment(event.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 rounded border-noorix-border accent-noorix-blue"
          />
          <span className="text-[13px] font-semibold leading-snug text-noorix-text">{t('expenseTaxExemptThisPayment')}</span>
        </label>
      ) : null}
    </>
  );
}

export function ExpenseTaxPreview({
  hasTaxPreview,
  isTaxable,
  taxPreview,
  t,
}: {
  hasTaxPreview: boolean;
  isTaxable: boolean;
  taxPreview: { net: number; tax: number };
  t: TranslateFn;
}) {
  if (!hasTaxPreview) return null;
  return (
    <div className="rounded-lg border border-noorix-border bg-noorix-bg-muted px-3 py-2.5 text-[12px] leading-relaxed text-noorix-text">
      <div className="mb-1 font-semibold text-noorix-muted">{t('expenseTaxBreakdownTitle')}</div>
      {isTaxable ? (
        <div className="flex flex-wrap gap-x-4 gap-y-1 nx-font-numbers">
          <span>{t('expenseTaxBreakdownNet')}: {fmt(taxPreview.net)} <span className="nx-sar text-[11px]">SR</span></span>
          <span>{t('expenseTaxBreakdownVat')}: {fmt(taxPreview.tax)} <span className="nx-sar text-[11px]">SR</span></span>
        </div>
      ) : (
        <span>{t('expenseTaxBreakdownNoVat')}</span>
      )}
    </div>
  );
}

export function ExpenseCoverageSection({
  selectedLine,
  form,
  set,
  coverageModeOptions,
  quarterOptions,
  monthOptions,
  t,
}: {
  selectedLine: ExpenseLineRecord | undefined;
  form: ExpensePaymentFormState;
  set: SetExpenseFormField;
  coverageModeOptions: PickerOption[];
  quarterOptions: PickerOption[];
  monthOptions: PickerOption[];
  t: TranslateFn;
}) {
  if (selectedLine?.kind !== 'fixed_expense') return null;
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-noorix-border bg-noorix-surface p-3">
      <div className="text-[12px] font-semibold text-noorix-text">{t('expenseCoverageSection')}</div>
      <p className="m-0 text-[11px] text-noorix-muted">{t('expenseCoverageHint')}</p>
      <Input
        type="number"
        label={t('expenseCoverageYear')}
        min={2000}
        max={2100}
        step={1}
        value={form.expenseCoverageYear}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => set('expenseCoverageYear', Number(event.target.value))}
        className="ltr"
        required
      />
      <SearchableOptionsPicker
        label={t('expenseCoverageModeLabel')}
        value={form.coverageMode}
        onChange={(value) => set('coverageMode', value === 'month_range' ? 'month_range' : 'quarter')}
        options={coverageModeOptions}
        aria-label={t('expenseCoverageModeLabel')}
      />
      {form.coverageMode === 'quarter' ? (
        <SearchableOptionsPicker
          label={t('expenseCoverageQuarter')}
          value={String(form.expenseCoverageQuarter)}
          onChange={(value) => set('expenseCoverageQuarter', Number(value))}
          options={quarterOptions}
          aria-label={t('expenseCoverageQuarter')}
        />
      ) : (
        <>
          <SearchableOptionsPicker
            label={t('expenseCoverageMonthStart')}
            value={String(form.expenseCoverageMonthStart)}
            onChange={(value) => set('expenseCoverageMonthStart', Number(value))}
            options={monthOptions}
            aria-label={t('expenseCoverageMonthStart')}
          />
          <SearchableOptionsPicker
            label={t('expenseCoverageMonthsCount')}
            value={String(form.expenseMonthsCovered)}
            onChange={(value) => set('expenseMonthsCovered', Number(value))}
            options={monthOptions}
            aria-label={t('expenseCoverageMonthsCount')}
          />
        </>
      )}
    </div>
  );
}

export function ExpenseVaultSection({
  form,
  set,
  secondVaultEnabled,
  setSecondVaultEnabled,
  secondVaultId,
  setSecondVaultId,
  secondAmount,
  setSecondAmount,
  vaultPickerOptions,
  t,
}: {
  form: ExpensePaymentFormState;
  set: SetExpenseFormField;
  secondVaultEnabled: boolean;
  setSecondVaultEnabled: (value: boolean) => void;
  secondVaultId: string;
  setSecondVaultId: (value: string) => void;
  secondAmount: string;
  setSecondAmount: (value: string) => void;
  vaultPickerOptions: PickerOption[];
  t: TranslateFn;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-noorix-border bg-noorix-bg-muted p-3">
      <div className="text-[12px] font-semibold text-noorix-text">{t('invoiceVaultColumn')} *</div>
      <SearchableOptionsPicker
        label={t('selectVault')}
        allowEmpty
        emptyValue=""
        emptyLabel={t('selectVault')}
        value={form.primaryVaultId}
        onChange={(value) => set('primaryVaultId', value)}
        options={vaultPickerOptions}
        aria-label={t('selectVault')}
      />

      {!secondVaultEnabled ? (
        <Button type="button" size="sm" variant="ghost" className="self-start" onClick={() => setSecondVaultEnabled(true)}>
          {t('addSecondVaultBtn')}
        </Button>
      ) : (
        <>
          <div className="text-[11px] text-noorix-muted">{t('secondVaultHint')}</div>
          <SearchableOptionsPicker
            label={t('secondVaultSelectLabel')}
            allowEmpty
            emptyValue=""
            emptyLabel={t('selectVault')}
            value={secondVaultId}
            onChange={setSecondVaultId}
            options={vaultPickerOptions}
            getOptionDisabled={(option) => option.value === form.primaryVaultId}
            aria-label={t('secondVaultSelectLabel')}
          />
          <Input
            type="number"
            step="0.01"
            min="0.01"
            label={t('secondVaultAmountLabel')}
            value={secondAmount}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSecondAmount(event.target.value)}
            className="ltr"
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="self-start"
            onClick={() => {
              setSecondVaultEnabled(false);
              setSecondVaultId('');
              setSecondAmount('');
            }}
          >
            {t('removeSecondVaultBtn')}
          </Button>
        </>
      )}
    </div>
  );
}

export function ExpenseAttachmentField({
  receiptInputRef,
  receiptFile,
  setReceiptFile,
  t,
}: {
  receiptInputRef: React.RefObject<HTMLInputElement>;
  receiptFile: File | null;
  setReceiptFile: (file: File | null) => void;
  t: TranslateFn;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-noorix-border bg-noorix-surface px-3 py-2.5">
      <div className="text-[12px] font-semibold text-noorix-text">{t('invoiceReceiptAttachment')}</div>
      <p className="m-0 text-[11px] text-noorix-muted">{t('invoiceReceiptAttachmentHint')}</p>
      <FileTrigger
        ref={receiptInputRef}
        accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,.pdf,.jpg,.jpeg,.png,.webp"
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => setReceiptFile(event.target.files?.[0] || null)}
        label={receiptFile ? receiptFile.name : t('invoiceReceiptChooseFile')}
        buttonProps={{ variant: 'secondary', size: 'sm', className: 'max-w-full truncate' }}
      />
      {receiptFile ? <span className="truncate text-[11px] text-noorix-muted" title={receiptFile.name}>{receiptFile.name}</span> : null}
    </div>
  );
}
