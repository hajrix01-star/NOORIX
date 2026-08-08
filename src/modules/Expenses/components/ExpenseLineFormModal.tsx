import React, { useMemo, useState } from 'react';
import { useApiMutation } from '../../../hooks/useApiMutation';
import { createExpenseLine, updateExpenseLine } from '../../../services/api';
import { useCategories } from '../../../hooks/useCategories';
import { useSuppliers } from '../../../hooks/useSuppliers';
import { useTranslation } from '../../../i18n/useTranslation';
import { fmt } from '../../../utils/format';
import { AdaptiveSheet, Button, Checkbox, DialogActions, Input, SearchableOptionsPicker } from '../../../ui';
import type {
  ExpenseLineCreatePayload,
  ExpenseLineRecord,
  ExpenseLineUpdatePayload,
  ExpenseSupplierRef,
} from '../../../types/api';
import {
  buildExpenseLinePayload,
  emptyExpenseLineForm,
  EXPENSE_INSTALLMENT_INTERVALS,
  expenseCategoryDisplayName,
  expenseLineKindLabel,
  expenseSupplierDisplayName,
  initExpenseLineForm,
  isExpenseCategoryRef,
  suggestedExpenseLinePaymentAmount,
  validateExpenseLineForm,
  type ExpenseLineFormState,
} from '../expenseModels';

type ExpenseLineFormModalProps = {
  companyId: string;
  editing: ExpenseLineRecord | null;
  onClose: () => void;
  onSaved: () => void;
};

type CategoryOption = { value: string; label: string };
type SupplierOption = { value: string; label: string };

export default function ExpenseLineFormModal({
  companyId,
  editing,
  onClose,
  onSaved,
}: ExpenseLineFormModalProps) {
  const { lang, t } = useTranslation();
  const [form, setForm] = useState<ExpenseLineFormState>(() => editing ? initExpenseLineForm(editing) : emptyExpenseLineForm());
  const [error, setError] = useState('');

  const { categories = [] } = useCategories(companyId);
  const { suppliers = [] } = useSuppliers(companyId);
  const expenseCategories = categories
    .filter(isExpenseCategoryRef)
    .filter((category) => category.type === 'expense');
  const supplierOptions: ExpenseSupplierRef[] = suppliers;

  const categoryPickerOptions = useMemo<CategoryOption[]>(() => {
    const out: CategoryOption[] = [];
    for (const parent of expenseCategories) {
      out.push({ value: parent.id, label: `${expenseCategoryDisplayName(parent, lang)} - ${lang === 'en' ? 'main' : 'رئيسية'}` });
      for (const child of parent.children || []) {
        out.push({ value: child.id, label: `↳ ${expenseCategoryDisplayName(child, lang)} - ${lang === 'en' ? 'sub' : 'فرعية'}` });
      }
    }
    return out;
  }, [expenseCategories, lang]);

  const supplierPickerOptions = useMemo<SupplierOption[]>(
    () =>
      supplierOptions
        .filter((supplier): supplier is ExpenseSupplierRef & { id: string } => Boolean(supplier.id))
        .map((supplier) => ({ value: supplier.id, label: expenseSupplierDisplayName(supplier, lang) })),
    [supplierOptions, lang],
  );

  const installmentOptions = useMemo(
    () =>
      EXPENSE_INSTALLMENT_INTERVALS.map((months) => ({
        value: String(months),
        label: `${months} ${lang === 'en' ? 'months' : 'أشهر'}`,
      })),
    [lang],
  );

  const suggestedPerPayment = suggestedExpenseLinePaymentAmount(form);

  const createMutation = useApiMutation({
    mutationFn: (body: ExpenseLineCreatePayload) => createExpenseLine(body),
    showErrorToast: false,
    onSuccess: onSaved,
    onError: (err: Error) => setError(err.message || t('saveFailed')),
  });

  const updateMutation = useApiMutation({
    mutationFn: ({ id, body }: { id: string; body: ExpenseLineUpdatePayload }) => updateExpenseLine(id, body, companyId),
    showErrorToast: false,
    onSuccess: onSaved,
    onError: (err: Error) => setError(err.message || t('saveFailed')),
  });

  const set = <K extends keyof ExpenseLineFormState>(key: K, value: ExpenseLineFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    const validationKey = validateExpenseLineForm(form);
    if (validationKey) {
      setError(t(validationKey));
      return;
    }
    if (editing) {
      const payload = buildExpenseLinePayload(form, companyId, editing);
      updateMutation.mutate({ id: editing.id, body: payload });
    } else {
      const payload = buildExpenseLinePayload(form, companyId, null);
      createMutation.mutate(payload);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const isFixed = form.kind === 'fixed_expense';

  const footer = (
    <DialogActions
      actions={[
        { key: 'cancel', label: t('cancel'), role: 'cancel', disabled: isPending, onClick: onClose },
        {
          key: 'save',
          label: isPending ? t('saving') : editing ? t('update') : t('save'),
          role: 'save',
          type: 'submit',
          form: 'expense-line-form-modal',
          disabled: isPending,
        },
      ]}
    />
  );

  return (
    <AdaptiveSheet
      open
      onClose={onClose}
      title={editing ? t('edit') : t('addExpenseLine')}
      size="md"
      side="start"
      className="expense-line-form-drawer"
      footer={footer}
    >
      <form id="expense-line-form-modal" onSubmit={handleSubmit} className="flex flex-col gap-2.5">
        {error ? (
          <div className="p-3 rounded-lg text-[13px] bg-noorix-bg-muted border border-noorix-border text-noorix-red">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-2.5 min-[540px]:grid-cols-2">
          <Input
            type="text"
            label={`${t('expenseLineNameCol')} *`}
            value={form.nameAr}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => set('nameAr', event.target.value)}
            placeholder={lang === 'en' ? 'Example: branch electricity' : 'مثال: كهرباء الفرع'}
            required
          />
          <Input
            type="text"
            label={t('nameEnLabel')}
            value={form.nameEn}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => set('nameEn', event.target.value)}
            placeholder={t('optional')}
          />
        </div>

        <section className="rounded-xl border border-noorix-border bg-noorix-bg-muted/45 p-2.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[12px] font-semibold text-noorix-text">{t('expenseLineKindCol')}</span>
            <span className="text-[11px] text-noorix-muted">{isFixed ? 'يتكرر بحسب دورة السداد' : 'تسجيل عملية عند حدوثها'}</span>
          </div>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label={t('expenseLineKindCol')}>
            <Button type="button" size="sm" variant={isFixed ? 'primary' : 'secondary'} aria-pressed={isFixed} onClick={() => set('kind', 'fixed_expense')}>
              {expenseLineKindLabel('fixed_expense', lang)}
            </Button>
            <Button type="button" size="sm" variant={!isFixed ? 'primary' : 'secondary'} aria-pressed={!isFixed} onClick={() => set('kind', 'expense')}>
              {expenseLineKindLabel('expense', lang)}
            </Button>
          </div>
        </section>

        {isFixed ? (
          <section className="rounded-xl border border-noorix-green/20 bg-noorix-green/5 p-2.5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[12px] font-semibold text-noorix-text">إعدادات المصروف الدوري</span>
              <span className="text-[11px] text-noorix-muted">التقدير السنوي اختياري</span>
            </div>
            <div className="grid grid-cols-1 gap-2.5 min-[540px]:grid-cols-2">
              <Input
                type="number"
                label={`${t('expenseLineAnnualTotal')} (${t('optional')})`}
                step="0.01"
                min="0"
                value={form.annualTotalAmount}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => set('annualTotalAmount', event.target.value)}
                placeholder="120000"
                className="ltr"
              />
              <SearchableOptionsPicker
                label={t('expenseLineInstallmentInterval')}
                allowEmpty
                emptyValue=""
                emptyLabel="-"
                value={form.installmentIntervalMonths}
                onChange={(value) => set('installmentIntervalMonths', value)}
                options={installmentOptions}
                aria-label={t('expenseLineInstallmentInterval')}
              />
            </div>
            {suggestedPerPayment != null ? (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-noorix-border bg-white/70 px-3 py-2">
                <span className="text-[12px] text-noorix-muted">
                  {t('expenseLineSuggestedPerPayment')}:{' '}
                  <span className="font-semibold text-noorix-text ltr">{fmt(suggestedPerPayment)}</span>{' '}
                  <span className="nx-sar">SR</span>
                </span>
                <Button type="button" size="sm" variant="ghost" onClick={() => set('referenceAmount', String(suggestedPerPayment))}>
                  {t('expenseLineApplySuggestedReference')}
                </Button>
              </div>
            ) : null}

            <div className="mt-2 grid grid-cols-1 gap-2.5 min-[540px]:grid-cols-2">
              <Input
                type="number"
                label={t('expenseLineReferenceAmount')}
                step="0.01"
                min="0"
                value={form.referenceAmount}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => set('referenceAmount', event.target.value)}
                placeholder="30000"
                className="ltr"
              />
              <label className="flex min-h-11 items-center gap-2.5 rounded-lg border border-noorix-border bg-white/70 px-3 text-[12px] text-noorix-text cursor-pointer">
              <Checkbox
                className="shrink-0"
                checked={form.allowPaymentAmountOverride}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => set('allowPaymentAmountOverride', event.target.checked)}
              />
              <span>
                <span className="font-medium">{t('expenseLineAllowPaymentAmountOverride')}</span>
                <span className="block text-[10px] text-noorix-muted">يمكن تعديل مبلغ كل سداد</span>
              </span>
              </label>
            </div>
          </section>
        ) : null}

        <div className="grid grid-cols-1 gap-2.5 min-[540px]:grid-cols-2">
          <SearchableOptionsPicker
            label={`${t('category')} *`}
            allowEmpty
            emptyValue=""
            emptyLabel={t('selectCategory')}
            value={form.categoryId}
            onChange={(value) => set('categoryId', value)}
            options={categoryPickerOptions}
            aria-label={t('category')}
          />
          <SearchableOptionsPicker
            label={`${t('supplier')} *`}
            allowEmpty
            emptyValue=""
            emptyLabel={t('selectSupplier')}
            value={form.supplierId}
            onChange={(value) => set('supplierId', value)}
            options={supplierPickerOptions}
            aria-label={t('supplier')}
          />
        </div>

        <div className="grid grid-cols-1 gap-2.5 min-[540px]:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <Input
            type="text"
            label={t('expenseLineServiceNumberCol')}
            value={form.serviceNumber}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => set('serviceNumber', event.target.value)}
            placeholder={t('optional')}
          />
          <Input
            multiline
            label={t('notes')}
            value={form.notes}
            onChange={(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set('notes', event.target.value)}
            placeholder={isFixed ? t('expenseLineNotesPlaceholderFixed') : t('optional')}
            rows={2}
          />
        </div>
      </form>
    </AdaptiveSheet>
  );
}
