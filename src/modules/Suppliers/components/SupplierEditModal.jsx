/**
 * SupplierEditModal — نافذة تعديل المورد.
 * Props: supplier, flatCategories, onSave(body), onClose, isSaving
 */
import React, { useState, useEffect, memo } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { Button, Input, Modal, FormRow } from '../../../ui';

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
        supplierType: supplier.supplierType === 'expenses' ? 'expenses' : 'purchases',
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

  return (
    <Modal open={!!supplier} onClose={onClose} title={t('editSupplier')} size="md">
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
              const code = c.account?.code ? ` [${c.account.code}]` : '';
              return (
                <option key={c.id} value={c.id}>
                  {icon} {c.parentId ? `↳ ${c.nameAr}` : c.nameAr}{code}
                </option>
              );
            })}
          </Input>
        </FormRow>
        <div className="nx-toolbar nx-flex-end" style={{ marginTop: 14 }}>
          <Button type="button" onClick={onClose}>{t('cancel')}</Button>
          <Button type="submit" variant="success" disabled={isSaving || !form.nameAr.trim()}>
            {isSaving ? t('saving') : t('saveChanges')}
          </Button>
        </div>
      </form>
    </Modal>
  );
});

export default SupplierEditModal;
