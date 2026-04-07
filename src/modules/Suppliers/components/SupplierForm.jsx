/**
 * SupplierForm — نموذج إضافة مورد جديد.
 * Props: companyId, categories (flat), onSave(body), isSaving, onCancel
 */
import React, { useState, memo } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { Button, Input, Card, FormRow } from '../../../ui';

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
    <Card>
      <h4 className="text-[14px] mt-0 mb-4">{t('newSupplier')}</h4>
      <form onSubmit={handleSubmit}>
        <FormRow cols={2}>
          <Input
            label={t('nameAr')}
            value={form.nameAr}
            onChange={(e) => set('nameAr', e.target.value)}
            placeholder={t('nameArPlaceholder')}
            required
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
            <option value="purchases">{t('supplierTypePurchases')}</option>
            <option value="expenses">{t('supplierTypeExpenses')}</option>
          </Input>
          <Input
            type="select"
            label={t('categoryLinked')}
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
        <div className="nx-toolbar" style={{ marginTop: 14 }}>
          <Button type="submit" variant="primary" disabled={isSaving || !form.nameAr.trim()}>
            {isSaving ? t('saving') : t('saveSupplier')}
          </Button>
          {onCancel && (
            <Button type="button" onClick={onCancel}>{t('cancel')}</Button>
          )}
        </div>
      </form>
    </Card>
  );
});

export default SupplierForm;
