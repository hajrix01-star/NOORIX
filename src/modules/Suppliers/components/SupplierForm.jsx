/**
 * SupplierForm — نموذج إضافة مورد جديد.
 * Props: companyId, categories (flat), onSave(body), isSaving, onCancel
 */
import React, { useState, memo } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';

const IS = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-surface)',
  color: 'var(--noorix-text)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box',
};


const EMPTY = { nameAr: '', nameEn: '', taxNumber: '', phone: '', supplierCategoryId: '', supplierType: 'purchases' };

export const SupplierForm = memo(function SupplierForm({ companyId, flatCategories = [], onSave, isSaving, onCancel }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(EMPTY);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  // فلترة الفئات حسب نوع المورد: مشتريات → purchase، مصروفات → expense
  const filteredCategories = flatCategories.filter((c) => {
    if (form.supplierType === 'purchases') return c.type === 'purchase';
    if (form.supplierType === 'expenses') return c.type === 'expense';
    return true;
  });

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.nameAr.trim()) return;
    onSave({
      companyId,
      nameAr:             form.nameAr.trim(),
      nameEn:             form.nameEn.trim() || undefined,
      taxNumber:          form.taxNumber.trim() || undefined,
      phone:              form.phone.trim() || undefined,
      supplierType:       form.supplierType,
      supplierCategoryId: form.supplierCategoryId || undefined,
    });
  }

  return (
    <div className="noorix-surface-card" style={{ padding: 20, borderRadius: 14 }}>
      <h4 style={{ margin: '0 0 16px', fontSize: 14 }}>{t('newSupplier')}</h4>
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
              <option value="purchases">{t('supplierTypePurchases')}</option>
              <option value="expenses">{t('supplierTypeExpenses')}</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('categoryLinked')}</label>
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
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" className="noorix-btn-nav noorix-btn-success" disabled={isSaving || !form.nameAr.trim()}>
            {isSaving ? t('saving') : t('saveSupplier')}
          </button>
          {onCancel && (
            <button type="button" className="noorix-btn-nav" onClick={onCancel}>{t('cancel')}</button>
          )}
        </div>
      </form>
    </div>
  );
});

export default SupplierForm;
