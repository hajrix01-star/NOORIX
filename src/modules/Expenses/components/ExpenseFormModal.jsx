/**
 * ExpenseFormModal — نموذج تسجيل مصروف (إصدار فاتورة)
 * يختار المستخدم بند مصروف، مبلغ، تاريخ، خزنة، ملاحظات
 */
import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '../../../i18n/useTranslation';
import { createInvoice, getExpenseLines } from '../../../services/api';
import { useVaults } from '../../../hooks/useVaults';
import { getSaudiToday } from '../../../utils/saudiDate';
import { Button, AdaptiveSheet, Input } from '../../../ui';

export default function ExpenseFormModal({ companyId, onClose, onSaved }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    expenseLineId: '',
    totalAmount: '',
    transactionDate: getSaudiToday(),
    vaultId: '',
    supplierInvoiceNumber: '',
    notes: '',
  });
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

  const createMutation = useMutation({
    mutationFn: (body) => createInvoice(body),
    onSuccess: (res) => {
      if (res?.success !== false) {
        onSaved?.();
      } else {
        setError(res?.error || 'فشل الحفظ');
      }
    },
    onError: (err) => setError(err?.message || 'حدث خطأ'),
  });

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
    if (!form.vaultId) {
      setError('اختر الخزينة');
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
    createMutation.mutate({
      companyId,
      expenseLineId: form.expenseLineId,
      categoryId: selectedLine.categoryId,
      supplierId: selectedLine.supplierId,
      supplierInvoiceNumber: form.supplierInvoiceNumber.trim(),
      kind: selectedLine.kind,
      totalAmount: Number(form.totalAmount),
      isTaxable: !selectedLine.category?.account?.taxExempt,
      transactionDate: form.transactionDate,
      vaultId: form.vaultId,
      notes: form.notes?.trim() || undefined,
    });
  };

  const footer = (
    <>
      <Button onClick={onClose}>إلغاء</Button>
      <Button variant="primary" type="submit" form="expense-form-modal" disabled={createMutation.isPending}>
        {createMutation.isPending ? 'جاري الحفظ...' : 'حفظ وإصدار الفاتورة'}
      </Button>
    </>
  );

  return (
    <AdaptiveSheet open={true} onClose={onClose} title="تسجيل مصروف" size="md" side="start" className="expense-form-drawer" footer={footer}>
      <form id="expense-form-modal" onSubmit={handleSubmit}>
        {error && (
          <div style={{ padding: 12, marginBottom: 16, background: 'var(--noorix-red-10)', borderRadius: 8, color: 'var(--noorix-accent-red)', fontSize: 13 }}>
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

        <Input
          type="select"
          label="الخزينة *"
          value={form.vaultId}
          onChange={(e) => setForm((p) => ({ ...p, vaultId: e.target.value }))}
          required
        >
          <option value="">— اختر الخزينة —</option>
          {activeVaults.map((v) => (
            <option key={v.id} value={v.id}>{v.nameAr || v.nameEn}</option>
          ))}
        </Input>

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
