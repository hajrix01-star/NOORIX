/**
 * ExpenseFormModal — نموذج تسجيل مصروف (إصدار فاتورة)
 * افتراضياً: خزنة واحدة للمبلغ كاملاً. اختياري: إضافة خزنة ثانية بمبلغ محدد (الباقي من الأولى).
 */
import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '../../../hooks/useApiMutation';
import { useTranslation } from '../../../i18n/useTranslation';
import { createInvoice, getExpenseLines } from '../../../services/api';
import { useVaults } from '../../../hooks/useVaults';
import { getSaudiToday } from '../../../utils/saudiDate';
import { Button, AdaptiveSheet, Input } from '../../../ui';

export default function ExpenseFormModal({ companyId, onClose, onSaved }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    expenseLineId: '',
    totalAmount: '',
    transactionDate: getSaudiToday(),
    primaryVaultId: '',
    supplierInvoiceNumber: '',
    notes: '',
  });
  const [secondVaultEnabled, setSecondVaultEnabled] = useState(false);
  const [secondVaultId, setSecondVaultId] = useState('');
  const [secondAmount, setSecondAmount] = useState('');
  const [error, setError] = useState('');

  const { data: expenseLines = [] } = useQuery({
    queryKey: ['expense-lines', companyId],
    queryFn: async () => {
      const res = await getExpenseLines(companyId);
      return res?.data ?? (Array.isArray(res) ? res : []);
    },
    enabled: !!companyId,
  });

  const { paymentVaults: activeVaults = [] } = useVaults({ companyId });

  const selectedLine = expenseLines.find((l) => l.id === form.expenseLineId);

  const createMutation = useApiMutation({
    mutationFn: (body) => createInvoice(body),
    showErrorToast: false,
    onSuccess: () => onSaved?.(),
    onError: (err) => setError(err?.message || 'حدث خطأ'),
  });

  const vaultOptions = useMemo(
    () => activeVaults.map((v) => ({ id: v.id, label: v.nameAr || v.nameEn || v.id })),
    [activeVaults],
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (!form.expenseLineId) {
      setError('اختر بند المصروف');
      return;
    }
    if (!form.totalAmount || Number(form.totalAmount) <= 0) {
      setError('المبلغ يجب أن يكون أكبر من صفر');
      return;
    }
    if (!selectedLine) {
      setError('بند المصروف غير صالح');
      return;
    }

    const isTaxable = !selectedLine.category?.account?.taxExempt;
    if (isTaxable && !form.supplierInvoiceNumber?.trim()) {
      setError('رقم فاتورة المورد مطلوب للفواتير الخاضعة للضريبة');
      return;
    }

    if (!form.primaryVaultId?.trim()) {
      setError(t('selectVault'));
      return;
    }

    const total = Number(form.totalAmount);

    const basePayload = {
      companyId,
      expenseLineId: form.expenseLineId,
      categoryId: selectedLine.categoryId,
      supplierId: selectedLine.supplierId,
      supplierInvoiceNumber: form.supplierInvoiceNumber.trim(),
      kind: selectedLine.kind,
      totalAmount: total,
      isTaxable: !selectedLine.category?.account?.taxExempt,
      transactionDate: form.transactionDate,
      notes: form.notes?.trim() || undefined,
    };

    if (secondVaultEnabled) {
      const a2 = parseFloat(secondAmount);
      if (!secondVaultId?.trim()) {
        setError(t('selectVault'));
        return;
      }
      if (secondVaultId === form.primaryVaultId) {
        setError(t('invoiceVaultsMustDiffer'));
        return;
      }
      if (Number.isNaN(a2) || a2 <= 0) {
        setError(t('secondVaultAmountInvalid'));
        return;
      }
      if (a2 >= total - 0.01) {
        setError(t('vaultSplitsMustMatchTotal'));
        return;
      }
      const a1 = Math.round((total - a2) * 100) / 100;
      if (a1 <= 0) {
        setError(t('vaultSplitsMustMatchTotal'));
        return;
      }
      createMutation.mutate({
        ...basePayload,
        vaultSplits: [
          { vaultId: form.primaryVaultId.trim(), amount: a1 },
          { vaultId: secondVaultId.trim(), amount: a2 },
        ],
      });
      return;
    }

    createMutation.mutate({
      ...basePayload,
      vaultId: form.primaryVaultId.trim(),
    });
  };

  const footer = (
    <>
      <Button onClick={onClose}>{t('cancel')}</Button>
      <Button variant="primary" type="submit" form="expense-form-modal" disabled={createMutation.isPending}>
        {createMutation.isPending ? t('saving') : 'حفظ وإصدار الفاتورة'}
      </Button>
    </>
  );

  return (
    <AdaptiveSheet open={true} onClose={onClose} title="تسجيل مصروف" size="md" side="start" className="expense-form-drawer" footer={footer}>
      <form id="expense-form-modal" onSubmit={handleSubmit} className="flex flex-col gap-3">
        {error && (
          <div className="p-3 rounded-lg text-[13px] bg-noorix-bg-muted border border-noorix-border text-noorix-red">
            {error}
          </div>
        )}

        <Input
          type="select"
          label="بند المصروف *"
          value={form.expenseLineId}
          onChange={(e) => setForm((p) => ({ ...p, expenseLineId: e.target.value }))}
          required
        >
          <option value="">— اختر البند —</option>
          {expenseLines.map((l) => (
            <option key={l.id} value={l.id}>
              {l.nameAr || l.nameEn} ({l.kind === 'fixed_expense' ? 'ثابت' : 'متغير'})
            </option>
          ))}
        </Input>

        <Input
          type="text"
          label={`رقم فاتورة المورد ${selectedLine?.category?.account?.taxExempt ? '(اختياري — معفى من الضريبة)' : '*'}`}
          value={form.supplierInvoiceNumber}
          onChange={(e) => setForm((p) => ({ ...p, supplierInvoiceNumber: e.target.value }))}
          placeholder="الرقم الموجود على فاتورة المورد (مثال: INV-2024-001)"
        />

        <Input
          type="number"
          label="المبلغ (شامل الضريبة) *"
          step="0.01"
          min="0.01"
          value={form.totalAmount}
          onChange={(e) => setForm((p) => ({ ...p, totalAmount: e.target.value }))}
          placeholder="0.00"
          required
        />

        <Input
          type="date"
          label="تاريخ العملية *"
          value={form.transactionDate}
          onChange={(e) => setForm((p) => ({ ...p, transactionDate: e.target.value }))}
          required
        />

        <div className="rounded-xl border border-noorix-border bg-noorix-bg-muted p-3 flex flex-col gap-2">
          <div className="text-[12px] font-semibold text-noorix-text">{t('invoiceVaultColumn')} *</div>
          <Input
            type="select"
            label={t('selectVault')}
            value={form.primaryVaultId}
            onChange={(e) => setForm((p) => ({ ...p, primaryVaultId: e.target.value }))}
            required
          >
            <option value="">— {t('selectVault')} —</option>
            {vaultOptions.map((v) => (
              <option key={v.id} value={v.id}>{v.label}</option>
            ))}
          </Input>

          {!secondVaultEnabled ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="self-start"
              onClick={() => {
                setSecondVaultEnabled(true);
                setError('');
              }}
            >
              {t('addSecondVaultBtn')}
            </Button>
          ) : (
            <>
              <div className="text-[11px] text-noorix-muted">{t('secondVaultHint')}</div>
              <Input
                type="select"
                label={t('secondVaultSelectLabel')}
                value={secondVaultId}
                onChange={(e) => setSecondVaultId(e.target.value)}
              >
                <option value="">— {t('selectVault')} —</option>
                {vaultOptions.map((v) => (
                  <option key={v.id} value={v.id} disabled={v.id === form.primaryVaultId}>{v.label}</option>
                ))}
              </Input>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                label={t('secondVaultAmountLabel')}
                value={secondAmount}
                onChange={(e) => setSecondAmount(e.target.value)}
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
                  setError('');
                }}
              >
                {t('removeSecondVaultBtn')}
              </Button>
            </>
          )}
        </div>

        <Input
          multiline
          label="ملاحظات (للخدمة ورقمها)"
          value={form.notes}
          onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
          placeholder="مثال: كهرباء - عداد 12345 - 1,200 SR"
          rows={3}
        />
      </form>
    </AdaptiveSheet>
  );
}
