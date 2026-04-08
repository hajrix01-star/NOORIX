/**
 * ExpenseFormModal — نموذج تسجيل مصروف (إصدار فاتورة)
 * يدعم سداداً من خزنة واحدة أو توزيعاً على عدة خزائن.
 */
import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '../../../hooks/useApiMutation';
import { useTranslation } from '../../../i18n/useTranslation';
import { createInvoice, getExpenseLines } from '../../../services/api';
import { useVaults } from '../../../hooks/useVaults';
import { getSaudiToday } from '../../../utils/saudiDate';
import { Button, AdaptiveSheet, Input } from '../../../ui';

const MAX_SPLITS = 8;

export default function ExpenseFormModal({ companyId, onClose, onSaved }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    expenseLineId: '',
    totalAmount: '',
    transactionDate: getSaudiToday(),
    vaultId: '',
    supplierInvoiceNumber: '',
    notes: '',
  });
  const [splitMode, setSplitMode] = useState(false);
  const [splits, setSplits] = useState([
    { vaultId: '', amount: '' },
    { vaultId: '', amount: '' },
  ]);
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

  function setSplitRow(i, field, value) {
    setSplits((prev) => prev.map((row, j) => (j === i ? { ...row, [field]: value } : row)));
  }

  function addSplitRow() {
    setSplits((prev) => (prev.length >= MAX_SPLITS ? prev : [...prev, { vaultId: '', amount: '' }]));
  }

  function removeSplitRow(i) {
    setSplits((prev) => (prev.length <= 2 ? prev : prev.filter((_, j) => j !== i)));
  }

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

    if (splitMode) {
      const parsed = splits
        .map((s) => ({
          vaultId: (s.vaultId || '').trim(),
          amount: parseFloat(s.amount),
        }))
        .filter((s) => s.vaultId && !Number.isNaN(s.amount) && s.amount > 0);
      if (parsed.length < 2) {
        setError(t('vaultSplitsNeedTwo'));
        return;
      }
      const sumParsed = parsed.reduce((a, s) => a + s.amount, 0);
      if (Math.abs(sumParsed - total) >= 0.02) {
        setError(t('vaultSplitsMustMatchTotal'));
        return;
      }
      createMutation.mutate({
        ...basePayload,
        vaultSplits: parsed.map((p) => ({ vaultId: p.vaultId, amount: p.amount })),
      });
      return;
    }

    if (!form.vaultId) {
      setError('اختر الخزينة');
      return;
    }
    createMutation.mutate({
      ...basePayload,
      vaultId: form.vaultId,
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

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={splitMode ? 'primary' : 'ghost'}
            onClick={() => {
              setSplitMode((m) => !m);
              setError('');
            }}
          >
            {t('splitPaymentAcrossVaults')}
          </Button>
        </div>

        {!splitMode ? (
          <Input
            type="select"
            label="الخزينة *"
            value={form.vaultId}
            onChange={(e) => setForm((p) => ({ ...p, vaultId: e.target.value }))}
            required
          >
            <option value="">— اختر الخزينة —</option>
            {vaultOptions.map((v) => (
              <option key={v.id} value={v.id}>{v.label}</option>
            ))}
          </Input>
        ) : (
          <div className="flex flex-col gap-2 rounded-xl border border-noorix-border bg-noorix-bg-muted p-3">
            <div className="text-[12px] font-semibold text-noorix-text">{t('invoiceVaultSplitsDetail')}</div>
            {splits.map((row, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_120px_auto] gap-2 items-end">
                <Input
                  type="select"
                  label={i === 0 ? t('invoiceVaultColumn') : '\u00a0'}
                  value={row.vaultId}
                  onChange={(e) => setSplitRow(i, 'vaultId', e.target.value)}
                >
                  <option value="">— {t('selectVault')} —</option>
                  {vaultOptions.map((v) => (
                    <option key={v.id} value={v.id}>{v.label}</option>
                  ))}
                </Input>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  label={i === 0 ? t('vaultSplitAmount') : '\u00a0'}
                  value={row.amount}
                  onChange={(e) => setSplitRow(i, 'amount', e.target.value)}
                  className="ltr"
                />
                {splits.length > 2 && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => removeSplitRow(i)}>
                    {t('delete')}
                  </Button>
                )}
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="ghost" onClick={addSplitRow} disabled={splits.length >= MAX_SPLITS}>
                {t('addVaultSplit')}
              </Button>
            </div>
            <p className="text-[11px] text-noorix-muted m-0">{t('vaultSplitsMustMatchTotal')}</p>
          </div>
        )}

        <Input
          multiline
          label="ملاحظات (للخدمة ورقمها)"
          value={form.notes}
          onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
          placeholder="مثال: كهرباء - عداد 12345 - 1,200 ر.س"
          rows={3}
        />
      </form>
    </AdaptiveSheet>
  );
}
