import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '../../../context/ToastContext';
import { useApiMutation } from '../../../hooks/useApiMutation';
import { useApiListQuery } from '../../../hooks/useApiQuery';
import { useTranslation } from '../../../i18n/useTranslation';
import { createInvoice, getExpenseLines, throwIfApiFailed, uploadInvoiceAttachment } from '../../../services/api';
import { useVaults } from '../../../hooks/useVaults';
import { expenseKeys } from '../../../services/queryKeys';
import { fmt } from '../../../utils/format';
import { vatRateDecimalFromCompany } from '../../../utils/vatRate';
import { useApp } from '../../../context/AppContext';
import { Button, AdaptiveSheet, Checkbox, DialogActions, TransactionDatePicker, FileTrigger, Input, SearchableOptionsPicker } from '../../../ui';
import {
  canExemptThisExpensePayment,
  isExpenseSupplierInvoiceNumberRequired,
  isExpensePaymentTaxable,
  supplierAppliesVat,
} from '../utils/expenseTax';
import type { ExpenseLineRecord, ExpensePaymentCreatePayload } from '../../../types/api';
import {
  buildExpensePaymentPayload,
  emptyExpensePaymentForm,
  expenseLineDisplayName,
  expenseLineKindLabel,
  isExpensePaymentAmountLocked,
  paymentVaultOptions,
  splitExpenseTaxDraft,
  syncExpensePaymentFormFromLine,
  validateExpensePaymentForm,
  type ExpensePaymentFormState,
} from '../expenseModels';

type ExpenseFormModalProps = {
  companyId: string;
  onClose: () => void;
  onSaved: () => void;
};

type InvoiceCreateResult = {
  data?: {
    id?: string;
    invoice?: { id?: string };
  };
  id?: string;
  invoice?: { id?: string };
};

function invoiceIdFromResult(result: InvoiceCreateResult): string | undefined {
  return result.data?.invoice?.id || result.data?.id || result.invoice?.id || result.id;
}

export default function ExpenseFormModal({ companyId, onClose, onSaved }: ExpenseFormModalProps) {
  const { t, lang } = useTranslation();
  const { showToast } = useToast();
  const { companies } = useApp();
  const activeCompany = companies.find((company) => company.id === companyId);
  const vatRateDecimal = useMemo(() => vatRateDecimalFromCompany(activeCompany), [activeCompany]);
  const [form, setForm] = useState<ExpensePaymentFormState>(() => emptyExpensePaymentForm());
  const [secondVaultEnabled, setSecondVaultEnabled] = useState(false);
  const [secondVaultId, setSecondVaultId] = useState('');
  const [secondAmount, setSecondAmount] = useState('');
  const [error, setError] = useState('');
  const [exemptThisPayment, setExemptThisPayment] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const receiptInputRef = useRef<HTMLInputElement | null>(null);
  const lastPrefilledLineIdRef = useRef<string | null>(null);

  const { data: expenseLines = [] } = useApiListQuery<ExpenseLineRecord>({
    queryKey: expenseKeys.lines(companyId),
    queryFn: () => getExpenseLines(companyId),
    fallbackMessage: t('loadingError'),
    enabled: !!companyId,
  });

  const { paymentVaults: activeVaults = [] } = useVaults({ companyId });
  const selectedLine = expenseLines.find((line) => line.id === form.expenseLineId);
  const isTaxable = isExpensePaymentTaxable(selectedLine, exemptThisPayment);
  const supplierInvoiceNumberRequired = isExpenseSupplierInvoiceNumberRequired(selectedLine, isTaxable);
  const amountLocked = isExpensePaymentAmountLocked(selectedLine);
  const taxPreview = splitExpenseTaxDraft(form.totalAmount, isTaxable, vatRateDecimal);
  const hasTaxPreview = Number(form.totalAmount) > 0;

  const taxStatusKind = useMemo(() => {
    if (!selectedLine) return null;
    if (selectedLine.category?.account?.taxExempt) return 'account_exempt';
    if (!supplierAppliesVat(selectedLine.supplier)) return 'supplier_not_registered';
    return 'default_taxable';
  }, [selectedLine]);

  useEffect(() => {
    setExemptThisPayment(false);
    if (!form.expenseLineId) {
      lastPrefilledLineIdRef.current = null;
      return;
    }
    if (!selectedLine || lastPrefilledLineIdRef.current === form.expenseLineId) return;
    lastPrefilledLineIdRef.current = form.expenseLineId;
    setForm((previous) => syncExpensePaymentFormFromLine(previous, selectedLine));
  }, [form.expenseLineId, selectedLine]);

  useEffect(() => {
    if (!selectedLine || selectedLine.kind !== 'fixed_expense') return;
    setForm((previous) => syncExpensePaymentFormFromLine(previous, selectedLine));
  }, [form.transactionDate, selectedLine]);

  const createMutation = useApiMutation({
    mutationFn: (body: ExpensePaymentCreatePayload) => createInvoice(body),
    showErrorToast: false,
    onSuccess: async (result: InvoiceCreateResult) => {
      const invoiceId = invoiceIdFromResult(result);
      if (receiptFile && invoiceId && companyId) {
        try {
          const uploadResult = await uploadInvoiceAttachment(invoiceId, companyId, receiptFile);
          throwIfApiFailed(uploadResult);
        } catch (uploadError: unknown) {
          showToast(uploadError instanceof Error ? uploadError.message : t('invoiceReceiptUploadFailed'), 'error');
        }
      }
      if (receiptInputRef.current) receiptInputRef.current.value = '';
      setReceiptFile(null);
      onSaved();
    },
    onError: (err: Error) => setError(err.message || t('saveFailed')),
  });

  const expenseLinePickerOptions = useMemo(
    () =>
      expenseLines.map((line) => ({
        value: line.id,
        label: `${expenseLineDisplayName(line, lang)} (${expenseLineKindLabel(line.kind, lang)})`,
      })),
    [expenseLines, lang],
  );

  const vaultPickerOptions = useMemo(() => paymentVaultOptions(activeVaults, lang), [activeVaults, lang]);

  const coverageModeOptions = useMemo(
    () => [
      { value: 'quarter', label: t('expenseCoverageModeQuarter') },
      { value: 'month_range', label: t('expenseCoverageModeMonths') },
    ],
    [t],
  );

  const quarterOptions = useMemo(() => [1, 2, 3, 4].map((quarter) => ({ value: String(quarter), label: `Q${quarter}` })), []);
  const monthOptions = useMemo(() => Array.from({ length: 12 }, (_item, index) => ({ value: String(index + 1), label: String(index + 1) })), []);

  const set = <K extends keyof ExpensePaymentFormState>(key: K, value: ExpensePaymentFormState[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    const validationKey = validateExpensePaymentForm({
      form,
      selectedLine,
      isTaxable,
      secondVault: { enabled: secondVaultEnabled, vaultId: secondVaultId, amount: secondAmount },
    });
    if (validationKey) {
      setError(t(validationKey));
      return;
    }
    if (!selectedLine) return;
    createMutation.mutate(buildExpensePaymentPayload({
      companyId,
      form,
      selectedLine,
      isTaxable,
      secondVault: { enabled: secondVaultEnabled, vaultId: secondVaultId, amount: secondAmount },
    }));
  };

  const footer = (
    <DialogActions
      actions={[
        { key: 'cancel', label: t('cancel'), role: 'cancel', onClick: onClose },
        {
          key: 'save',
          label: createMutation.isPending ? t('saving') : t('save'),
          role: 'save',
          type: 'submit',
          form: 'expense-form-modal',
          disabled: createMutation.isPending,
        },
      ]}
    />
  );

  return (
    <AdaptiveSheet open onClose={onClose} title={t('expenseRecordNew')} size="md" side="start" className="expense-form-drawer" footer={footer}>
      <form id="expense-form-modal" onSubmit={handleSubmit} className="flex flex-col gap-3">
        {error ? (
          <div className="p-3 rounded-lg text-[13px] bg-noorix-bg-muted border border-noorix-border text-noorix-red">
            {error}
          </div>
        ) : null}

        <SearchableOptionsPicker
          label={`${t('expenseLineNameCol')} *`}
          allowEmpty
          emptyValue=""
          emptyLabel={t('select')}
          value={form.expenseLineId}
          onChange={(value) => set('expenseLineId', value)}
          options={expenseLinePickerOptions}
          aria-label={t('expenseLineNameCol')}
        />

        <Input
          type="text"
          label={`${t('supplierInvoiceNumber')}${supplierInvoiceNumberRequired ? ' *' : ''}`}
          value={form.supplierInvoiceNumber}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => set('supplierInvoiceNumber', event.target.value)}
          placeholder={t('supplierInvoiceNumber')}
        />

        {selectedLine && taxStatusKind === 'account_exempt' ? <p className="m-0 text-[12px] text-noorix-muted">{t('expenseTaxAccountExemptHint')}</p> : null}
        {selectedLine && taxStatusKind === 'supplier_not_registered' ? <p className="m-0 text-[12px] text-noorix-muted">{t('expenseTaxSupplierNotRegisteredHint')}</p> : null}
        {selectedLine && taxStatusKind === 'default_taxable' ? <p className="m-0 text-[12px] text-noorix-muted">{t('expenseTaxDefaultFromSupplierHint')}</p> : null}

        {selectedLine && canExemptThisExpensePayment(selectedLine) ? (
          <label className="flex items-start gap-2.5 min-h-[44px] cursor-pointer rounded-lg border border-noorix-border bg-noorix-surface px-3 py-2.5">
            <Checkbox
              checked={exemptThisPayment}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => setExemptThisPayment(event.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 rounded border-noorix-border accent-noorix-blue"
            />
            <span className="text-[13px] font-semibold text-noorix-text leading-snug">{t('expenseTaxExemptThisPayment')}</span>
          </label>
        ) : null}

        <Input
          type="number"
          label={`${t('amount')} (${t('taxInclusive')}) *`}
          step="0.01"
          min="0.01"
          value={form.totalAmount}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => set('totalAmount', event.target.value)}
          placeholder="0.00"
          required
          disabled={amountLocked}
          className="ltr"
        />
        {hasTaxPreview ? (
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
        ) : null}
        {selectedLine?.referenceAmount != null && selectedLine.allowPaymentAmountOverride !== false && !amountLocked ? (
          <p className="text-[11px] text-noorix-muted -mt-2">{t('expensePaymentPrefilledFromLine')}</p>
        ) : null}
        {amountLocked ? <p className="text-[11px] text-noorix-muted -mt-2">{t('expensePaymentAmountLocked')}</p> : null}

        {selectedLine?.kind === 'fixed_expense' ? (
          <div className="rounded-xl border border-noorix-border bg-noorix-surface p-3 flex flex-col gap-2">
            <div className="text-[12px] font-semibold text-noorix-text">{t('expenseCoverageSection')}</div>
            <p className="text-[11px] text-noorix-muted m-0">{t('expenseCoverageHint')}</p>
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
        ) : null}

        <TransactionDatePicker
          label={`${t('date')} *`}
          value={form.transactionDate}
          onValueChange={(value) => set('transactionDate', value)}
          required
        />

        <div className="rounded-xl border border-noorix-border bg-noorix-bg-muted p-3 flex flex-col gap-2">
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

        <Input
          multiline
          label={t('notes')}
          value={form.notes}
          onChange={(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set('notes', event.target.value)}
          placeholder={t('optional')}
          rows={3}
        />

        <div className="rounded-xl border border-noorix-border bg-noorix-surface px-3 py-2.5 flex flex-col gap-2">
          <div className="text-[12px] font-semibold text-noorix-text">{t('invoiceReceiptAttachment')}</div>
          <p className="text-[11px] text-noorix-muted m-0">{t('invoiceReceiptAttachmentHint')}</p>
          <FileTrigger
            ref={receiptInputRef}
            accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,.pdf,.jpg,.jpeg,.png,.webp"
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setReceiptFile(event.target.files?.[0] || null)}
            label={receiptFile ? receiptFile.name : t('invoiceReceiptChooseFile')}
            buttonProps={{ variant: 'secondary', size: 'sm', className: 'max-w-full truncate' }}
          />
          {receiptFile ? <span className="text-[11px] text-noorix-muted truncate" title={receiptFile.name}>{receiptFile.name}</span> : null}
        </div>

        <label className="flex items-start gap-2.5 min-h-[44px] cursor-pointer rounded-lg border border-noorix-border bg-noorix-surface px-3 py-2.5">
          <Checkbox
            checked={form.warrantyFollowUp}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => set('warrantyFollowUp', event.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 rounded border-noorix-border accent-noorix-blue"
          />
          <span className="text-[13px] font-semibold text-noorix-text leading-snug">{t('warrantyFollowUpStack')}</span>
        </label>
      </form>
    </AdaptiveSheet>
  );
}
