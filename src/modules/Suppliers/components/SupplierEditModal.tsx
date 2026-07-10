import React, { memo, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { Button, Checkbox, Input, AdaptiveSheet, FormRow, SearchableOptionsPicker } from '../../../ui';
import type {
  SupplierCategoryRecord,
  SupplierFormState,
  SupplierRecord,
  SupplierUpdatePayload,
} from '../supplierTypes';
import {
  buildSupplierCategoryOptions,
  buildSupplierTypeOptions,
  buildSupplierUpdatePayload,
  isSupplierFormSubmittable,
  supplierFormFromRecord,
  type SupplierFormField,
  type SupplierFormValue,
} from '../supplierFormModel';

export type SupplierEditModalProps = {
  supplier: SupplierRecord | null;
  flatCategories?: SupplierCategoryRecord[];
  onSave: (body: SupplierUpdatePayload) => void;
  onClose: () => void;
  isSaving: boolean;
};

export const SupplierEditModal = memo(function SupplierEditModal({
  supplier,
  flatCategories = [],
  onSave,
  onClose,
  isSaving,
}: SupplierEditModalProps) {
  const { t, lang } = useTranslation();
  const [form, setForm] = useState<SupplierFormState>(() => supplierFormFromRecord(supplier));

  useEffect(() => {
    setForm(supplierFormFromRecord(supplier));
  }, [supplier]);

  function setField<TField extends SupplierFormField>(field: TField, value: SupplierFormValue<TField>) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  const categoryPickerOptions = useMemo(
    () => buildSupplierCategoryOptions(flatCategories, form.supplierType, lang),
    [flatCategories, form.supplierType, lang],
  );

  const supplierTypeOptions = useMemo(() => buildSupplierTypeOptions(t), [t]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isSupplierFormSubmittable(form)) return;
    onSave(buildSupplierUpdatePayload(form));
  }

  return (
    <AdaptiveSheet open={!!supplier} onClose={onClose} title={t('editSupplier')} size="md" side="start" className="supplier-edit-drawer">
      <form onSubmit={handleSubmit}>
        <FormRow cols={2}>
          <Input
            label={t('nameAr')}
            value={form.nameAr}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setField('nameAr', event.target.value)}
            placeholder={t('nameArPlaceholder')}
            required
            autoComplete="off"
          />
          <Input
            label={t('nameEn')}
            value={form.nameEn}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setField('nameEn', event.target.value)}
            placeholder={t('nameEnPlaceholder')}
          />
          <Input
            label={t('taxNumber')}
            value={form.taxNumber}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setField('taxNumber', event.target.value)}
            placeholder="300000000000003"
          />
          <Input
            label={t('phone')}
            value={form.phone}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setField('phone', event.target.value)}
            placeholder="05xxxxxxxx"
          />
          <SearchableOptionsPicker
            label={t('supplierType')}
            value={form.supplierType}
            onChange={(value) => setField('supplierType', value === 'expenses' ? 'expenses' : 'purchases')}
            options={supplierTypeOptions}
            aria-label={t('supplierType')}
          />
          <SearchableOptionsPicker
            label={t('category')}
            allowEmpty
            emptyValue=""
            emptyLabel={t('noCategory')}
            value={form.supplierCategoryId}
            onChange={(value) => setField('supplierCategoryId', value)}
            options={categoryPickerOptions}
            aria-label={t('category')}
          />
        </FormRow>

        <Checkbox
          checked={form.isTaxRegistered}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setField('isTaxRegistered', event.target.checked)}
          className="w-[18px] h-[18px]"
          containerClassName="nx-checkbox flex items-center gap-2 mt-3 cursor-pointer select-none text-[13px] text-noorix-text"
          label={(
            <span>
              {t('isTaxRegistered')}
              <span className="ms-1 text-[11px] text-noorix-muted">
                - {form.isTaxRegistered ? t('taxRegisteredHint') : t('taxNotRegisteredHint')}
              </span>
            </span>
          )}
        />

        <div className="nx-toolbar flex items-center justify-end mt-[14px]">
          <Button type="button" size="sm" onClick={onClose}>{t('cancel')}</Button>
          <Button type="submit" size="sm" variant="primary" disabled={isSaving || !isSupplierFormSubmittable(form)}>
            {isSaving ? t('saving') : t('saveChanges')}
          </Button>
        </div>
      </form>
    </AdaptiveSheet>
  );
});

export default SupplierEditModal;
