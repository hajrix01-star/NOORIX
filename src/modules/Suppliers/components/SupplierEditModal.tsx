/**
 * SupplierEditModal — نافذة تعديل المورد.
 * Props: supplier, flatCategories, onSave(body), onClose, isSaving
 */
import React, { useState, useEffect, memo, useMemo } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { Button, Input, AdaptiveSheet, FormRow } from '../../../ui';
import { SearchableOptionsPicker } from '../../../components/common/SearchableOptionsPicker';

export type SupplierEditModalProps = {
  supplier: any;
  flatCategories?: any[];
  onSave: (body: any) => void;
  onClose: () => void;
  isSaving: boolean;
};

export const SupplierEditModal = memo(function SupplierEditModal({
  supplier, flatCategories = [], onSave, onClose, isSaving,
}: SupplierEditModalProps) {
  const { t, lang } = useTranslation();
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

  const set = (k: any, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const filteredCategories = flatCategories.filter((c: any) => {
    if (form.supplierType === 'purchases') return c.type === 'purchase';
    if (form.supplierType === 'expenses') return c.type === 'expense';
    return true;
  });

  const categoryPickerOptions = useMemo(
    () =>
      filteredCategories.map((c: any) => {
        const icon = c.icon || c.account?.icon || '';
        const displayCode = c.code || c.account?.code || '';
        const code = displayCode ? ` [${displayCode}]` : '';
        const name = lang === 'en' ? c.nameEn || c.nameAr : c.nameAr || c.nameEn;
        return {
          value: c.id,
          label: `${icon} ${c.parentId ? `↳ ${name}` : name}${code}`.trim(),
        };
      }),
    [filteredCategories, lang],
  );

  function handleSubmit(e: any) {
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
            onChange={(e: any) => set('nameAr', e.target.value)}
            placeholder={t('nameArPlaceholder')}
            required
            autoComplete="off"
          />
          <Input
            label={t('nameEn')}
            value={form.nameEn}
            onChange={(e: any) => set('nameEn', e.target.value)}
            placeholder={t('nameEnPlaceholder')}
          />
          <Input
            label={t('taxNumber')}
            value={form.taxNumber}
            onChange={(e: any) => set('taxNumber', e.target.value)}
            placeholder="300000000000003"
          />
          <Input
            label={t('phone')}
            value={form.phone}
            onChange={(e: any) => set('phone', e.target.value)}
            placeholder="05xxxxxxxx"
          />
          <SearchableOptionsPicker
            label={t('supplierType')}
            value={form.supplierType}
            onChange={(v) => set('supplierType', v)}
            options={SUPPLIER_TYPES}
            aria-label={t('supplierType')}
          />
          <SearchableOptionsPicker
            label={t('category')}
            allowEmpty
            emptyValue=""
            emptyLabel={t('noCategory')}
            value={form.supplierCategoryId}
            onChange={(v) => set('supplierCategoryId', v)}
            options={categoryPickerOptions}
            aria-label={t('category')}
          />
        </FormRow>

        <label className="nx-checkbox flex items-center gap-2 mt-3 cursor-pointer select-none text-[13px] text-noorix-text">
          <input
            type="checkbox"
            checked={form.isTaxRegistered}
            onChange={(e: any) => set('isTaxRegistered', e.target.checked)}
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
          <Button type="button" size="sm" onClick={onClose}>{t('cancel')}</Button>
          <Button type="submit" size="sm" variant="primary" disabled={isSaving || !form.nameAr.trim()}>
            {isSaving ? t('saving') : t('saveChanges')}
          </Button>
        </div>
      </form>
    </AdaptiveSheet>
  );
});

export default SupplierEditModal;
