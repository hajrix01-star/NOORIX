/**
 * ExpenseLineFormModal — نموذج إنشاء/تعديل بند مصروف (هاتف 1، كهرب 1، إيجار محل)
 */
import React, { useState, useEffect } from 'react';
import { useApiMutation } from '../../../hooks/useApiMutation';
import { createExpenseLine, updateExpenseLine } from '../../../services/api';
import { useCategories } from '../../../hooks/useCategories';
import { useSuppliers } from '../../../hooks/useSuppliers';
import { useTranslation } from '../../../i18n/useTranslation';
import { Button, AdaptiveSheet, Input } from '../../../ui';

export default function ExpenseLineFormModal({ companyId, editing, onClose, onSaved }) {
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
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (editing) {
      const ref = editing.referenceAmount;
      const refNum = ref != null && ref !== '' ? Number(ref) : NaN;
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
      });
    } else {
      setForm({
        nameAr: '', nameEn: '', kind: 'expense', categoryId: '', supplierId: '', serviceNumber: '', notes: '',
        referenceAmount: '', allowPaymentAmountOverride: true,
      });
    }
  }, [editing]);

  const { categories = [] } = useCategories(companyId);
  const { suppliers = [] } = useSuppliers(companyId);
  const expenseCategoriesGrouped = categories.filter((c) => c.type === 'expense');

  const createMutation = useApiMutation({
    mutationFn: (body) => createExpenseLine(body),
    showErrorToast: false,
    onSuccess: () => onSaved?.(),
    onError: (err) => setError(err?.message || 'حدث خطأ'),
  });

  const updateMutation = useApiMutation({
    mutationFn: ({ id, body }) => updateExpenseLine(id, body, companyId),
    showErrorToast: false,
    onSuccess: () => onSaved?.(),
    onError: (err) => setError(err?.message || 'حدث خطأ'),
  });

  const handleSubmit = (e) => {
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
    if (isFixed && form.referenceAmount?.trim() && (Number.isNaN(refParsed) || refParsed < 0)) {
      setError(t('validationInvalidAmount') || 'مبلغ غير صالح');
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
          <div className="p-3 mb-4 rounded-lg text-[13px]" style={{ background: 'var(--noorix-red-10)', color: 'var(--noorix-accent-red)' }}>
            {error}
          </div>
        )}

        <Input
          type="text"
          label="اسم البند (عربي) *"
          value={form.nameAr}
          onChange={(e) => setForm((p) => ({ ...p, nameAr: e.target.value }))}
          placeholder="مثال: هاتف رقم 1، كهرباء الفرع 1"
          required
        />

        <Input
          type="select"
          label="النوع *"
          value={form.kind}
          onChange={(e) => setForm((p) => ({ ...p, kind: e.target.value }))}
        >
          <option value="expense">متغير</option>
          <option value="fixed_expense">ثابت</option>
        </Input>

        {form.kind === 'fixed_expense' && (
          <>
            <Input
              type="number"
              label={t('expenseLineReferenceAmount')}
              step="0.01"
              min="0"
              value={form.referenceAmount}
              onChange={(e) => setForm((p) => ({ ...p, referenceAmount: e.target.value }))}
              placeholder="30,000"
              className="ltr"
            />
            <p className="text-[11px] text-noorix-muted -mt-2 mb-1">{t('expenseLineReferenceAmountHint')}</p>
            <label className="flex items-start gap-2.5 text-[13px] text-noorix-text cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 shrink-0"
                checked={form.allowPaymentAmountOverride}
                onChange={(e) => setForm((p) => ({ ...p, allowPaymentAmountOverride: e.target.checked }))}
              />
              <span>
                <span className="font-medium">{t('expenseLineAllowPaymentAmountOverride')}</span>
                <span className="block text-[11px] text-noorix-muted mt-0.5">{t('expenseLineAllowPaymentAmountOverrideHint')}</span>
              </span>
            </label>
          </>
        )}

        <Input
          type="select"
          label="الفئة *"
          value={form.categoryId}
          onChange={(e) => setForm((p) => ({ ...p, categoryId: e.target.value }))}
          required
        >
          <option value="">— اختر الفئة —</option>
          {expenseCategoriesGrouped.map((parent) => (
            <optgroup key={parent.id} label={`${parent.nameAr || parent.nameEn || '—'} (فئة رئيسية)`}>
              <option value={parent.id}>{parent.nameAr || parent.nameEn} — رئيسية</option>
              {(parent.children || []).map((child) => (
                <option key={child.id} value={child.id}>↳ {child.nameAr || child.nameEn} — فرعية</option>
              ))}
            </optgroup>
          ))}
        </Input>

        <Input
          type="select"
          label="المورد *"
          value={form.supplierId}
          onChange={(e) => setForm((p) => ({ ...p, supplierId: e.target.value }))}
          required
        >
          <option value="">— اختر المورد —</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{(lang === 'en' ? s.nameEn || s.nameAr : s.nameAr || s.nameEn)}</option>
          ))}
        </Input>

        <Input
          type="text"
          label="رقم الخدمة / العداد"
          value={form.serviceNumber}
          onChange={(e) => setForm((p) => ({ ...p, serviceNumber: e.target.value }))}
          placeholder="اختياري"
        />

        <Input
          multiline
          label="ملاحظات"
          value={form.notes}
          onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
          placeholder={form.kind === 'fixed_expense' ? t('expenseLineNotesPlaceholderFixed') : 'اختياري'}
          rows={3}
        />
      </form>
    </AdaptiveSheet>
  );
}
