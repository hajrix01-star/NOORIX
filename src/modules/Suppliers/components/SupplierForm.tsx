/**
 * SupplierForm — نموذج إضافة مورد جديد.
 * Props: companyId, categories (flat), onSave(body), isSaving, onCancel
 */
import React, { useState, memo, useMemo } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { Button, Checkbox, Input, Card, FormRow, SearchableOptionsPicker } from '../../../ui';

const EMPTY = { nameAr: '', nameEn: '', taxNumber: '', phone: '', supplierCategoryId: '', supplierType: 'purchases', isTaxRegistered: true };

export type SupplierFormProps = {
  companyId: any;
  flatCategories?: any[];
  onSave: (body: any) => void;
  isSaving: boolean;
  onCancel: () => void;
};

export const SupplierForm = memo(function SupplierForm({ companyId, flatCategories = [], onSave, isSaving, onCancel }: SupplierFormProps) {
  const { t, lang } = useTranslation();
  const [form, setForm] = useState(EMPTY);

  const set = (k: any, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  // فلترة الفئات حسب نوع المورد: مشتريات → purchase، مصروفات → expense
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

  const supplierTypeOptions = useMemo(
    () => [
      { value: 'purchases', label: t('supplierTypePurchases') },
      { value: 'expenses', label: t('supplierTypeExpenses') },
    ],
    [t],
  );

  function handleSubmit(e: any) {
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
      isTaxRegistered:    form.isTaxRegistered,
    });
  }

  return (
    <Card>
      <h4 className="text-[14px] mt-0 mb-4">{t('newSupplier')}</h4>
      <form onSubmit={handleSubmit}>
        <FormRow cols={2}>
          <Input
            label={t('nameAr')}
            value={form.nameAr}
            onChange={(e: any) => set('nameAr', e.target.value)}
            placeholder={t('nameArPlaceholder')}
            required
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
            options={supplierTypeOptions}
            aria-label={t('supplierType')}
          />
          <SearchableOptionsPicker
            label={t('categoryLinked')}
            allowEmpty
            emptyValue=""
            emptyLabel={t('noCategory')}
            value={form.supplierCategoryId}
            onChange={(v) => set('supplierCategoryId', v)}
            options={categoryPickerOptions}
            aria-label={t('categoryLinked')}
          />
        </FormRow>

        <Checkbox
          checked={form.isTaxRegistered}
          onChange={(e: any) => set('isTaxRegistered', e.target.checked)}
          className="w-[18px] h-[18px]"
          containerClassName="nx-checkbox flex items-center gap-2 mt-3 cursor-pointer select-none text-[13px] text-noorix-text"
          label={(
            <span>
            {t('isTaxRegistered')}
            <span className="ms-1 text-[11px] text-noorix-muted">
              — {form.isTaxRegistered ? t('taxRegisteredHint') : t('taxNotRegisteredHint')}
            </span>
            </span>
          )}
        />

        <div className="nx-toolbar mt-[14px]">
          <Button type="submit" size="sm" variant="primary" disabled={isSaving || !form.nameAr.trim()}>
            {isSaving ? t('saving') : t('saveSupplier')}
          </Button>
          {onCancel && (
            <Button type="button" size="sm" onClick={onCancel}>{t('cancel')}</Button>
          )}
        </div>
      </form>
    </Card>
  );
});

export default SupplierForm;
