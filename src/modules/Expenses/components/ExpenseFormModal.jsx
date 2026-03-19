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

  const { vaultsList = [] } = useVaults({ companyId });
  const activeVaults = vaultsList.filter((v) => !v.isArchived);

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

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid var(--noorix-border)',
    background: 'var(--noorix-bg-surface)',
    fontSize: 14,
    boxSizing: 'border-box',
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 24,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: 'var(--noorix-bg-surface)',
          borderRadius: 12,
          maxWidth: 480,
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit} style={{ padding: 24 }}>
          <h2 style={{ margin: '0 0 20px 0', fontSize: 18, fontWeight: 700 }}>تسجيل مصروف</h2>
          {error && (
            <div style={{ padding: 12, marginBottom: 16, background: 'rgba(239,68,68,0.1)', borderRadius: 8, color: '#ef4444', fontSize: 13 }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>بند المصروف *</label>
            <select
              value={form.expenseLineId}
              onChange={(e) => setForm((p) => ({ ...p, expenseLineId: e.target.value }))}
              style={inputStyle}
              required
            >
              <option value="">— اختر البند —</option>
              {expenseLines.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nameAr || l.nameEn} ({l.kind === 'fixed_expense' ? 'ثابت' : 'متغير'})
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>رقم فاتورة المورد {selectedLine?.category?.account?.taxExempt ? '(اختياري — معفى من الضريبة)' : '*'}</label>
            <input
              type="text"
              value={form.supplierInvoiceNumber}
              onChange={(e) => setForm((p) => ({ ...p, supplierInvoiceNumber: e.target.value }))}
              placeholder="الرقم الموجود على فاتورة المورد (مثال: INV-2024-001)"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>المبلغ (شامل الضريبة) *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={form.totalAmount}
              onChange={(e) => setForm((p) => ({ ...p, totalAmount: e.target.value }))}
              placeholder="0.00"
              style={inputStyle}
              required
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>تاريخ العملية *</label>
            <input
              type="date"
              value={form.transactionDate}
              onChange={(e) => setForm((p) => ({ ...p, transactionDate: e.target.value }))}
              style={inputStyle}
              required
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>الخزينة *</label>
            <select
              value={form.vaultId}
              onChange={(e) => setForm((p) => ({ ...p, vaultId: e.target.value }))}
              style={inputStyle}
              required
            >
              <option value="">— اختر الخزينة —</option>
              {activeVaults.map((v) => (
                <option key={v.id} value={v.id}>{v.nameAr || v.nameEn}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>ملاحظات (للخدمة ورقمها)</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="مثال: كهرباء - عداد 12345 - 1,200 ر.س"
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-page)', cursor: 'pointer' }}>
              إلغاء
            </button>
            <button type="submit" disabled={createMutation.isPending} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: 'var(--noorix-accent-blue)', color: 'white', fontWeight: 600, cursor: 'pointer' }}>
              {createMutation.isPending ? 'جاري الحفظ...' : 'حفظ وإصدار الفاتورة'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
