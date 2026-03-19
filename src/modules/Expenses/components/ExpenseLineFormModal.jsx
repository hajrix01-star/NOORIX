/**
 * ExpenseLineFormModal — نموذج إنشاء/تعديل بند مصروف (هاتف 1، كهرب 1، إيجار محل)
 */
import React, { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { createExpenseLine, updateExpenseLine } from '../../../services/api';
import { useCategories } from '../../../hooks/useCategories';
import { useSuppliers } from '../../../hooks/useSuppliers';

export default function ExpenseLineFormModal({ companyId, editing, onClose, onSaved }) {
  const [form, setForm] = useState({
    nameAr: '',
    nameEn: '',
    kind: 'expense',
    categoryId: '',
    supplierId: '',
    serviceNumber: '',
    notes: '',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (editing) {
      setForm({
        nameAr: editing.nameAr || '',
        nameEn: editing.nameEn || '',
        kind: editing.kind || 'expense',
        categoryId: editing.categoryId || '',
        supplierId: editing.supplierId || '',
        serviceNumber: editing.serviceNumber || '',
        notes: editing.notes || '',
      });
    } else {
      setForm({ nameAr: '', nameEn: '', kind: 'expense', categoryId: '', supplierId: '', serviceNumber: '', notes: '' });
    }
  }, [editing]);

  const { categories = [] } = useCategories(companyId);
  const { suppliers = [] } = useSuppliers(companyId);
  const expenseCategoriesGrouped = categories.filter((c) => c.type === 'expense');

  const createMutation = useMutation({
    mutationFn: (body) => createExpenseLine(body),
    onSuccess: (res) => {
      if (res?.success !== false) {
        onSaved?.();
      } else {
        setError(res?.error || 'فشل الحفظ');
      }
    },
    onError: (err) => setError(err?.message || 'حدث خطأ'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }) => updateExpenseLine(id, body, companyId),
    onSuccess: (res) => {
      if (res?.success !== false) {
        onSaved?.();
      } else {
        setError(res?.error || 'فشل التحديث');
      }
    },
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
      });
    }
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
          <h2 style={{ margin: '0 0 20px 0', fontSize: 18, fontWeight: 700 }}>{editing ? 'تعديل بند مصروف' : 'إضافة بند مصروف'}</h2>
          {error && (
            <div style={{ padding: 12, marginBottom: 16, background: 'rgba(239,68,68,0.1)', borderRadius: 8, color: '#ef4444', fontSize: 13 }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>اسم البند (عربي) *</label>
            <input
              type="text"
              value={form.nameAr}
              onChange={(e) => setForm((p) => ({ ...p, nameAr: e.target.value }))}
              placeholder="مثال: هاتف رقم 1، كهرباء الفرع 1"
              style={inputStyle}
              required
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>النوع *</label>
            <select
              value={form.kind}
              onChange={(e) => setForm((p) => ({ ...p, kind: e.target.value }))}
              style={inputStyle}
            >
              <option value="expense">متغير</option>
              <option value="fixed_expense">ثابت</option>
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>الفئة *</label>
            <select
              value={form.categoryId}
              onChange={(e) => setForm((p) => ({ ...p, categoryId: e.target.value }))}
              style={inputStyle}
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
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>المورد *</label>
            <select
              value={form.supplierId}
              onChange={(e) => setForm((p) => ({ ...p, supplierId: e.target.value }))}
              style={inputStyle}
              required
            >
              <option value="">— اختر المورد —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.nameAr || s.nameEn}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>رقم الخدمة / العداد</label>
            <input
              type="text"
              value={form.serviceNumber}
              onChange={(e) => setForm((p) => ({ ...p, serviceNumber: e.target.value }))}
              placeholder="اختياري"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>ملاحظات</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="اختياري"
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-page)', cursor: 'pointer' }}>
              إلغاء
            </button>
            <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: 'var(--noorix-accent-blue)', color: 'white', fontWeight: 600, cursor: 'pointer' }}>
              {createMutation.isPending || updateMutation.isPending ? 'جاري الحفظ...' : (editing ? 'تحديث' : 'حفظ')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
