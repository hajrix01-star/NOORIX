/**
 * ExpenseLineFormModal — نموذج إنشاء/تعديل بند مصروف (هاتف 1، كهرب 1، إيجار محل)
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useApiMutation } from '../../../hooks/useApiMutation';
import { createExpenseLine, updateExpenseLine } from '../../../services/api';
import { useCategories } from '../../../hooks/useCategories';
import { useSuppliers } from '../../../hooks/useSuppliers';
import { useTranslation } from '../../../i18n/useTranslation';
import { fmt } from '../../../utils/format';
import { Button, AdaptiveSheet, Checkbox, Input, SearchableOptionsPicker } from '../../../ui';

const INSTALLMENT_INTERVALS = [1, 2, 3, 4, 6, 12];

export default function ExpenseLineFormModal({ companyId, editing, onClose, onSaved }: any) {
  const { lang, t } = useTranslation();
  const [form, setForm] = useState({
    nameAr: '',
    nameEn: '',
    kind: 'expense',
    categoryId: '',
    supplierId: '',
    serviceNumber: '',
    notes: '',
    referenceAmount: '',
    allowPaymentAmountOverride: true,
    annualTotalAmount: '',
    installmentIntervalMonths: '',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (editing) {
      const ref = editing.referenceAmount;
      const refNum = ref != null && ref !== '' ? Number(ref) : NaN;
      const ann = editing.annualTotalAmount;
      const annNum = ann != null && ann !== '' ? Number(ann) : NaN;
      setForm({
        nameAr: editing.nameAr || '',
        nameEn: editing.nameEn || '',
        kind: editing.kind || 'expense',
        categoryId: editing.categoryId || '',
        supplierId: editing.supplierId || '',
        serviceNumber: editing.serviceNumber || '',
        notes: editing.notes || '',
        referenceAmount: Number.isFinite(refNum) ? String(refNum) : '',
        allowPaymentAmountOverride: editing.allowPaymentAmountOverride !== false,
        annualTotalAmount: Number.isFinite(annNum) ? String(annNum) : '',
        installmentIntervalMonths:
          editing.installmentIntervalMonths != null ? String(editing.installmentIntervalMonths) : '',
      });
    } else {
      setForm({
        nameAr: '',
        nameEn: '',
        kind: 'expense',
        categoryId: '',
        supplierId: '',
        serviceNumber: '',
        notes: '',
        referenceAmount: '',
        allowPaymentAmountOverride: true,
        annualTotalAmount: '',
        installmentIntervalMonths: '',
      });
    }
  }, [editing]);

  const suggestedPerPayment = useMemo(() => {
    const annual = parseFloat(form.annualTotalAmount);
    const interval = parseInt(form.installmentIntervalMonths, 10);
    if (!Number.isFinite(annual) || annual <= 0 || !Number.isFinite(interval) || interval <= 0) return null;
    if (12 % interval !== 0) return null;
    const periods = 12 / interval;
    return Math.round((annual / periods) * 100) / 100;
  }, [form.annualTotalAmount, form.installmentIntervalMonths]);

  const { categories = [] } = useCategories(companyId);
  const { suppliers = [] } = useSuppliers(companyId);
  const expenseCategoriesGrouped = categories.filter((c: any) => c.type === 'expense');

  const expenseKindOptions = useMemo(
    () => [
      { value: 'expense', label: lang === 'en' ? 'Variable' : 'متغير' },
      { value: 'fixed_expense', label: lang === 'en' ? 'Fixed' : 'ثابت' },
    ],
    [lang],
  );

  const categoryPickerOptions = useMemo(() => {
    const out: { value: string; label: string }[] = [];
    for (const parent of expenseCategoriesGrouped) {
      const pn = parent.nameAr || parent.nameEn || '—';
      out.push({ value: parent.id, label: `${pn} — ${lang === 'en' ? 'main' : 'رئيسية'}` });
      for (const child of parent.children || []) {
        const cn = child.nameAr || child.nameEn || '—';
        out.push({ value: child.id, label: `↳ ${cn} — ${lang === 'en' ? 'sub' : 'فرعية'}` });
      }
    }
    return out;
  }, [expenseCategoriesGrouped, lang]);

  const supplierPickerOptions = useMemo(
    () =>
      suppliers.map((s: any) => ({
        value: s.id,
        label: (lang === 'en' ? s.nameEn || s.nameAr : s.nameAr || s.nameEn) || '',
      })),
    [suppliers, lang],
  );

  const installmentOptions = useMemo(
    () =>
      INSTALLMENT_INTERVALS.map((n: number) => ({
        value: String(n),
        label: `${n} ${lang === 'en' ? 'months' : 'أشهر'}`,
      })),
    [lang],
  );

  const createMutation = useApiMutation({
    mutationFn: (body: any) => createExpenseLine(body),
    showErrorToast: false,
    onSuccess: () => onSaved?.(),
    onError: (err: any) => setError(err?.message || 'حدث خطأ'),
  });

  const updateMutation = useApiMutation({
    mutationFn: ({ id, body }: any) => updateExpenseLine(id, body, companyId),
    showErrorToast: false,
    onSuccess: () => onSaved?.(),
    onError: (err: any) => setError(err?.message || 'حدث خطأ'),
  });

  const applySuggestedReference = () => {
    if (suggestedPerPayment == null) return;
    setForm((p: any) => ({ ...p, referenceAmount: String(suggestedPerPayment) }));
  };

  const handleSubmit = (e: any) => {
    e.preventDefault();
    setError('');
    if (!form.nameAr?.trim()) {
      setError('اسم البند مطلوب');
      return;
    }
    if (!form.categoryId) {
      setError('الفئة مطلوبة');
      return;
    }
    if (!form.supplierId) {
      setError('المورد مطلوب');
      return;
    }
    const isFixed = form.kind === 'fixed_expense';
    const refParsed = form.referenceAmount?.trim() ? Number(form.referenceAmount) : null;
    if (isFixed && form.referenceAmount?.trim() && (refParsed == null || Number.isNaN(refParsed) || refParsed < 0)) {
      setError(t('validationInvalidAmount') || 'مبلغ غير صالح');
      return;
    }

    const annualParsed = form.annualTotalAmount?.trim() ? Number(form.annualTotalAmount) : null;
    const intervalParsed = form.installmentIntervalMonths ? parseInt(form.installmentIntervalMonths, 10) : null;
    if (isFixed && annualParsed != null && !Number.isNaN(annualParsed) && annualParsed > 0) {
      if (intervalParsed == null || Number.isNaN(intervalParsed) || 12 % intervalParsed !== 0) {
        setError(t('validationInvalidAmount') || 'فترة الدفع غير صالحة للإجمالي السنوي');
        return;
      }
    }
    if (isFixed && intervalParsed != null && !Number.isNaN(intervalParsed) && 12 % intervalParsed !== 0) {
      setError(t('validationInvalidAmount') || 'فترة الدفع يجب أن تقسم 12 بدون باقٍ (1،2،3،4،6،12)');
      return;
    }

    if (editing) {
      updateMutation.mutate({
        id: editing.id,
        body: {
          nameAr: form.nameAr.trim(),
          nameEn: form.nameEn?.trim() || undefined,
          kind: form.kind,
          categoryId: form.categoryId,
          supplierId: form.supplierId,
          serviceNumber: form.serviceNumber?.trim() || undefined,
          notes: form.notes?.trim() || undefined,
          referenceAmount: isFixed ? (refParsed != null && refParsed >= 0 ? refParsed : null) : null,
          allowPaymentAmountOverride: isFixed ? form.allowPaymentAmountOverride : true,
          annualTotalAmount: isFixed && annualParsed != null && !Number.isNaN(annualParsed) && annualParsed > 0
            ? annualParsed
            : isFixed
              ? null
              : undefined,
          installmentIntervalMonths:
            isFixed && intervalParsed != null && !Number.isNaN(intervalParsed)
              ? intervalParsed
              : isFixed
                ? null
                : undefined,
        },
      });
    } else {
      createMutation.mutate({
        companyId,
        nameAr: form.nameAr.trim(),
        nameEn: form.nameEn?.trim() || undefined,
        kind: form.kind,
        categoryId: form.categoryId,
        supplierId: form.supplierId,
        serviceNumber: form.serviceNumber?.trim() || undefined,
        notes: form.notes?.trim() || undefined,
        referenceAmount: isFixed && refParsed != null && refParsed >= 0 ? refParsed : undefined,
        allowPaymentAmountOverride: isFixed ? form.allowPaymentAmountOverride : true,
        annualTotalAmount:
          isFixed && annualParsed != null && !Number.isNaN(annualParsed) && annualParsed > 0 ? annualParsed : undefined,
        installmentIntervalMonths:
          isFixed && intervalParsed != null && !Number.isNaN(intervalParsed) ? intervalParsed : undefined,
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const footer = (
    <>
      <Button onClick={onClose}>إلغاء</Button>
      <Button variant="primary" type="submit" form="expense-line-form-modal" disabled={isPending}>
        {isPending ? 'جاري الحفظ...' : (editing ? 'تحديث' : 'حفظ')}
      </Button>
    </>
  );

  return (
    <AdaptiveSheet
      open={true}
      onClose={onClose}
      title={editing ? 'تعديل بند مصروف' : 'إضافة بند مصروف'}
      size="md"
      side="start"
      className="expense-line-form-drawer"
      footer={footer}
    >
      <form id="expense-line-form-modal" onSubmit={handleSubmit}>
        {error && (
          <div className="p-3 mb-4 rounded-lg text-[13px] bg-noorix-bg-muted border border-noorix-border text-noorix-red">
            {error}
          </div>
        )}

        <Input
          type="text"
          label="اسم البند (عربي) *"
          value={form.nameAr}
          onChange={(e: any) => setForm((p: any) => ({ ...p, nameAr: e.target.value }))}
          placeholder="مثال: هاتف رقم 1، كهرباء الفرع 1"
          required
        />

        <SearchableOptionsPicker
          label="النوع *"
          value={form.kind}
          onChange={(v) => setForm((p: any) => ({ ...p, kind: v }))}
          options={expenseKindOptions}
          aria-label="النوع"
        />

        {form.kind === 'fixed_expense' && (
          <>
            <Input
              type="number"
              label={t('expenseLineAnnualTotal')}
              step="0.01"
              min="0"
              value={form.annualTotalAmount}
              onChange={(e: any) => setForm((p: any) => ({ ...p, annualTotalAmount: e.target.value }))}
              placeholder="120000"
              className="ltr"
            />
            <p className="text-[11px] text-noorix-muted -mt-2 mb-1">{t('expenseLineAnnualTotalHint')}</p>

            <SearchableOptionsPicker
              label={t('expenseLineInstallmentInterval')}
              allowEmpty
              emptyValue=""
              emptyLabel="—"
              value={form.installmentIntervalMonths}
              onChange={(v) => setForm((p: any) => ({ ...p, installmentIntervalMonths: v }))}
              options={installmentOptions}
              aria-label={t('expenseLineInstallmentInterval')}
            />

            {suggestedPerPayment != null && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-noorix-border bg-noorix-bg-muted px-3 py-2 mb-2">
                <span className="text-[12px] text-noorix-muted">
                  {t('expenseLineSuggestedPerPayment')}:{' '}
                  <span className="font-semibold text-noorix-text ltr">{fmt(suggestedPerPayment)}</span>{' '}
                  <span className="nx-sar">SR</span>
                </span>
                <Button type="button" size="sm" variant="ghost" onClick={applySuggestedReference}>
                  {t('expenseLineApplySuggestedReference')}
                </Button>
              </div>
            )}

            <Input
              type="number"
              label={t('expenseLineReferenceAmount')}
              step="0.01"
              min="0"
              value={form.referenceAmount}
              onChange={(e: any) => setForm((p: any) => ({ ...p, referenceAmount: e.target.value }))}
              placeholder="30000"
              className="ltr"
            />
            <p className="text-[11px] text-noorix-muted -mt-2 mb-1">{t('expenseLineReferenceAmountHint')}</p>
            <label className="flex items-start gap-2.5 text-[13px] text-noorix-text cursor-pointer">
              <Checkbox
                className="mt-0.5 shrink-0"
                checked={form.allowPaymentAmountOverride}
                onChange={(e: any) => setForm((p: any) => ({ ...p, allowPaymentAmountOverride: e.target.checked }))}
              />
              <span>
                <span className="font-medium">{t('expenseLineAllowPaymentAmountOverride')}</span>
                <span className="block text-[11px] text-noorix-muted mt-0.5">{t('expenseLineAllowPaymentAmountOverrideHint')}</span>
              </span>
            </label>
          </>
        )}

        <SearchableOptionsPicker
          label="الفئة *"
          allowEmpty
          emptyValue=""
          emptyLabel="— اختر الفئة —"
          value={form.categoryId}
          onChange={(v) => setForm((p: any) => ({ ...p, categoryId: v }))}
          options={categoryPickerOptions}
          aria-label="الفئة"
        />

        <SearchableOptionsPicker
          label="المورد *"
          allowEmpty
          emptyValue=""
          emptyLabel="— اختر المورد —"
          value={form.supplierId}
          onChange={(v) => setForm((p: any) => ({ ...p, supplierId: v }))}
          options={supplierPickerOptions}
          aria-label="المورد"
        />

        <Input
          type="text"
          label="رقم الخدمة / العداد"
          value={form.serviceNumber}
          onChange={(e: any) => setForm((p: any) => ({ ...p, serviceNumber: e.target.value }))}
          placeholder="اختياري"
        />

        <Input
          multiline
          label="ملاحظات"
          value={form.notes}
          onChange={(e: any) => setForm((p: any) => ({ ...p, notes: e.target.value }))}
          placeholder={form.kind === 'fixed_expense' ? t('expenseLineNotesPlaceholderFixed') : 'اختياري'}
          rows={3}
        />
      </form>
    </AdaptiveSheet>
  );
}
