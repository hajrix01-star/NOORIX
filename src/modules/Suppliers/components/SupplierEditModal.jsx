/**
 * SupplierEditModal — نافذة تعديل المورد.
 * Props: supplier, flatCategories, onSave(body), onClose, isSaving
 */
import React, { useState, useEffect, memo } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { Button, Input, AdaptiveSheet, FormRow } from '../../../ui';

export const SupplierEditModal = memo(function SupplierEditModal({
  supplier, flatCategories = [], onSave, onClose, isSaving,
}) {
  const { t, lang } = useTranslation();
  const catLabel = (c) => (lang === 'en' ? c.nameEn || c.nameAr : c.nameAr || c.nameEn) || '';
  const SUPPLIER_TYPES = [
    { value: 'purchases', label: t('supplierTypePurchases') },
    { value: 'expenses',  label: t('supplierTypeExpenses') },
  ];
  const [form, setForm] = useState({
    nameAr: '', nameEn: '', taxNumber: '', phone: '',
    supplierCategoryId: '', supplierType: 'purchases', isTaxRegistered: false,
  });

  useEffect(() => {
    if (supplier) {
      setForm({
        nameAr: supplier.nameAr || '',
        nameEn: supplier.nameEn || '',
        taxNumber: supplier.taxNumber || '',
        phone: supplier.phone || '',
        supplierCategoryId: supplier.supplierCategoryId || '',
        supplierType: supplier.supplierType === 'expenses' ? 'expenses' : 'purchases',
        isTaxRegistered: supplier.isTaxRegistered ?? true,
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
      isTaxRegistered: form.isTaxRegistered,
    });
  }

  return (
    <AdaptiveSheet open={!!supplier} onClose={onClose} title={t('editSupplier')} size="md" side="start" className="supplier-edit-drawer">
      <form onSubmit={handleSubmit}>
        <FormRow cols={2}>
          <Input
            label={t('nameAr')}
            value={form.nameAr}
            onChange={(e) => set('nameAr', e.target.value)}
            placeholder={t('nameArPlaceholder')}
            required
            autoComplete="off"
          />
          <Input
            label={t('nameEn')}
            value={form.nameEn}
            onChange={(e) => set('nameEn', e.target.value)}
            placeholder={t('nameEnPlaceholder')}
          />
          <Input
            label={t('taxNumber')}
            value={form.taxNumber}
            onChange={(e) => set('taxNumber', e.target.value)}
            placeholder="300000000000003"
          />
          <Input
            label={t('phone')}
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            placeholder="05xxxxxxxx"
          />
          <Input
            type="select"
            label={t('supplierType')}
            value={form.supplierType}
            onChange={(e) => set('supplierType', e.target.value)}
          >
            {SUPPLIER_TYPES.map((st) => <option key={st.value} value={st.value}>{st.label}</option>)}
          </Input>
          <Input
            type="select"
            label={t('category')}
            value={form.supplierCategoryId}
            onChange={(e) => set('supplierCategoryId', e.target.value)}
          >
            <option value="">{t('noCategory')}</option>
            {filteredCategories.map((c) => {
              const icon = c.icon || c.account?.icon || '';
              const displayCode = c.code || c.account?.code || '';
              const code = displayCode ? ` [${displayCode}]` : '';
              return (
                <option key={c.id} value={c.id}>
                  {icon} {c.parentId ? `↳ ${catLabel(c)}` : catLabel(c)}{code}
                </option>
              );
            })}
          </Input>
        </FormRow>

        <label className="nx-checkbox flex items-center gap-2 mt-3 cursor-pointer select-none text-[13px] text-noorix-text">
          <input
            type="checkbox"
            checked={form.isTaxRegistered}
            onChange={(e) => set('isTaxRegistered', e.target.checked)}
            className="w-[18px] h-[18px]"
          />
          <span>
            {t('isTaxRegistered')}
            <span className="ms-1 text-[11px] text-noorix-muted">
              — {form.isTaxRegistered ? t('taxRegisteredHint') : t('taxNotRegisteredHint')}
            </span>
          </span>
        </label>

        <div className="nx-toolbar flex items-center justify-end mt-[14px]">
          <Button type="button" onClick={onClose}>{t('cancel')}</Button>
          <Button type="submit" variant="primary" disabled={isSaving || !form.nameAr.trim()}>
            {isSaving ? t('saving') : t('saveChanges')}
          </Button>
        </div>
      </form>
    </AdaptiveSheet>
  );
});

export default SupplierEditModal;
