/**
 * SupplierEditModal — نافذة تعديل المورد.
 * Props: supplier, flatCategories, onSave(body), onClose, isSaving
 */
import React, { useState, useEffect, memo } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';

const IS = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-surface)',
  color: 'var(--noorix-text)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box',
};

export const SupplierEditModal = memo(function SupplierEditModal({
  supplier, flatCategories = [], onSave, onClose, isSaving,
}) {
  const { t } = useTranslation();
  const SUPPLIER_TYPES = [
    { value: 'purchases', label: t('supplierTypePurchases') },
    { value: 'expenses',  label: t('supplierTypeExpenses') },
  ];
  const [form, setForm] = useState({
    nameAr: '', nameEn: '', taxNumber: '', phone: '',
    supplierCategoryId: '', supplierType: 'purchases',
  });

  useEffect(() => {
    if (supplier) {
      setForm({
        nameAr: supplier.nameAr || '',
        nameEn: supplier.nameEn || '',
        taxNumber: supplier.taxNumber || '',
        phone: supplier.phone || '',
        supplierCategoryId: supplier.supplierCategoryId || '',
        supplierType: (supplier.categoryId || supplier.supplierType) === 'expenses' ? 'expenses' : 'purchases',
      });
    }
  }, [supplier]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const filteredCategories = flatCategories.filter((c) => {
    if (form.supplierType === 'purchases') return c.type === 'purchase';
    if (form.supplierType === 'expenses') return c.type === 'expense';
    return true;
  });

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.nameAr.trim()) return;
    onSave({
      nameAr: form.nameAr.trim(),
      nameEn: form.nameEn.trim() || undefined,
      taxNumber: form.taxNumber.trim() || undefined,
      phone: form.phone.trim() || undefined,
      supplierType: form.supplierType,
      supplierCategoryId: form.supplierCategoryId || undefined,
    });
  }

  if (!supplier) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.4)', padding: 20,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="noorix-surface-card"
        style={{ width: '100%', maxWidth: 480, borderRadius: 14, padding: 24, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{t('editSupplier')}</h4>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--noorix-text-muted)' }}
          >
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('nameAr')}</label>
              <input value={form.nameAr} onChange={(e) => set('nameAr', e.target.value)} placeholder={t('nameArPlaceholder')} required style={IS} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('nameEn')}</label>
              <input value={form.nameEn} onChange={(e) => set('nameEn', e.target.value)} placeholder={t('nameEnPlaceholder')} style={IS} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('taxNumber')}</label>
              <input value={form.taxNumber} onChange={(e) => set('taxNumber', e.target.value)} placeholder="300000000000003" style={IS} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('phone')}</label>
              <input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="05xxxxxxxx" style={IS} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('supplierType')}</label>
              <select value={form.supplierType} onChange={(e) => set('supplierType', e.target.value)} style={IS}>
                {SUPPLIER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('category')}</label>
              <select value={form.supplierCategoryId} onChange={(e) => set('supplierCategoryId', e.target.value)} style={IS}>
                <option value="">{t('noCategory')}</option>
                {filteredCategories.map((c) => {
                  const icon = c.icon || c.account?.icon || '📁';
                  const code = c.account?.code ? ` [${c.account.code}]` : '';
                  return (
                    <option key={c.id} value={c.id}>
                      {icon} {c.parentId ? `↳ ${c.nameAr}` : c.nameAr}{code}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="noorix-btn-nav" onClick={onClose}>{t('cancel')}</button>
            <button type="submit" className="noorix-btn-nav noorix-btn-success" disabled={isSaving || !form.nameAr.trim()}>
              {isSaving ? t('saving') : t('saveChanges')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

export default SupplierEditModal;
