import React, { type ChangeEvent, useEffect, useState } from 'react';
import { useTranslation } from '../../../../i18n/useTranslation';
import { AdaptiveSheet, Button, Checkbox, Input } from '../../../../ui';
import type { OrderCategory, OrderProductType, OrderProductVariant, OrderSection } from '../../../../types/api';
import { productHasAdvancedVariants } from './catalogProductUtils';

export type CatalogProductFormState = {
  id?: string;
  nameAr: string;
  nameEn: string;
  categoryId: string;
  sectionIds: string[];
  productType: OrderProductType;
  simpleLastPrice: string;
  variants: OrderProductVariant[];
  _advanced?: boolean;
};

type CatalogOption = {
  ar: string;
  en?: string;
};

type CatalogProductFormSheetProps = {
  open: boolean;
  mode: 'create' | 'edit';
  productType: OrderProductType;
  form: CatalogProductFormState | null;
  setForm: React.Dispatch<React.SetStateAction<CatalogProductFormState | null>>;
  categories: OrderCategory[];
  sections: OrderSection[];
  sizesOptions: CatalogOption[];
  packagingOptions: CatalogOption[];
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  onDelete?: () => void;
  onAddSize: () => void;
  onAddPackaging: () => void;
  addVariant: () => void;
  updateVariant: (idx: number, field: keyof OrderProductVariant, value: string) => void;
  removeVariant: (idx: number) => void;
};

function VariantsTable({
  t,
  variants,
  sizesOptions,
  packagingOptions,
  updateVariant,
  removeVariant,
  onAddSize,
  onAddPackaging,
  addVariant,
}: {
  t: (key: string) => string;
  variants: OrderProductVariant[];
  sizesOptions: CatalogOption[];
  packagingOptions: CatalogOption[];
  updateVariant: (idx: number, field: keyof OrderProductVariant, value: string) => void;
  removeVariant: (idx: number) => void;
  onAddSize: () => void;
  onAddPackaging: () => void;
  addVariant: () => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-[12px] text-noorix-muted">{t('ordersProductVariants')}</label>
        <Button type="button" size="sm" onClick={addVariant}>+ {t('ordersAddVariant')}</Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-noorix-border">
        <table className="w-full min-w-[400px] border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-noorix-border bg-noorix-bg-muted">
              <th className="px-2.5 py-2 text-right font-semibold">{t('ordersProductSize')}</th>
              <th className="px-2.5 py-2 text-right font-semibold">{t('ordersProductPackaging')}</th>
              <th className="px-2.5 py-2 text-right font-semibold">{t('unit')}</th>
              <th className="px-2.5 py-2 text-right font-semibold">{t('ordersVariantPrice')}</th>
              <th className="w-10 px-1 py-2" />
            </tr>
          </thead>
          <tbody>
            {variants.map((variant, index) => (
              <tr key={`${index}-${variant.size}-${variant.packaging}`} className="border-b border-noorix-border">
                <td className="px-2 py-1.5">
                  <div className="flex gap-1">
                    <Input
                      type="select"
                      value={variant.size}
                      onChange={(event: ChangeEvent<HTMLSelectElement>) => updateVariant(index, 'size', event.target.value)}
                      className="min-w-0 flex-1"
                    >
                      <option value="">-</option>
                      {sizesOptions.map((option) => (
                        <option key={option.ar} value={option.ar}>{option.ar}</option>
                      ))}
                    </Input>
                    <Button type="button" size="sm" onClick={onAddSize} title={t('add')}>+</Button>
                  </div>
                </td>
                <td className="px-2 py-1.5">
                  <div className="flex gap-1">
                    <Input
                      type="select"
                      value={variant.packaging}
                      onChange={(event: ChangeEvent<HTMLSelectElement>) => updateVariant(index, 'packaging', event.target.value)}
                      className="min-w-0 flex-1"
                    >
                      <option value="">-</option>
                      {packagingOptions.map((option) => (
                        <option key={option.ar} value={option.ar}>{option.ar}</option>
                      ))}
                    </Input>
                    <Button type="button" size="sm" onClick={onAddPackaging} title={t('add')}>+</Button>
                  </div>
                </td>
                <td className="px-2 py-1.5">
                  <Input
                    type="select"
                    value={variant.unit}
                    onChange={(event: ChangeEvent<HTMLSelectElement>) => updateVariant(index, 'unit', event.target.value)}
                  >
                    <option value="piece">{t('ordersUnitPiece')}</option>
                    <option value="kg">{t('ordersUnitKg')}</option>
                    <option value="box">{t('ordersUnitBox')}</option>
                    <option value="dozen">{t('ordersUnitDozen')}</option>
                  </Input>
                </td>
                <td className="px-2 py-1.5">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={variant.lastPrice}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => updateVariant(index, 'lastPrice', event.target.value)}
                    className="w-20"
                  />
                </td>
                <td className="px-1 py-1.5">
                  <Button type="button" size="sm" variant="danger" onClick={() => removeVariant(index)}>x</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function CatalogProductFormSheet({
  open,
  mode,
  form,
  setForm,
  categories,
  sections,
  sizesOptions,
  packagingOptions,
  saving,
  onClose,
  onSave,
  onDelete,
  onAddSize,
  onAddPackaging,
  addVariant,
  updateVariant,
  removeVariant,
}: CatalogProductFormSheetProps) {
  const { t } = useTranslation();
  const [advanced, setAdvanced] = useState(false);

  useEffect(() => {
    if (!open || !form) return;
    setAdvanced(Boolean(form._advanced) || productHasAdvancedVariants(form));
  }, [open, form]);

  if (!form) return null;

  const title = mode === 'edit' ? t('ordersEditProduct') : t('ordersAddProduct');

  function updateForm(patch: Partial<CatalogProductFormState>) {
    setForm((current) => (current ? { ...current, ...patch } : current));
  }

  function toggleSection(sectionId: string, checked: boolean) {
    setForm((current) => {
      if (!current) return current;
      const currentIds = Array.isArray(current.sectionIds) ? current.sectionIds : [];
      const sectionIds = checked
        ? [...new Set([...currentIds, sectionId])]
        : currentIds.filter((id) => id !== sectionId);
      return { ...current, sectionIds };
    });
  }

  return (
    <AdaptiveSheet
      open={open}
      onClose={onClose}
      title={title}
      size="lg"
      side="start"
      footer={(
        <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3">
          <Button type="button" variant="ghost" size="md" onClick={onClose} disabled={saving}>{t('cancel')}</Button>
          {mode === 'edit' && onDelete ? (
            <Button type="button" variant="danger" size="md" onClick={onDelete} disabled={saving}>{t('delete')}</Button>
          ) : null}
          <Button type="button" variant="primary" size="md" onClick={onSave} loading={saving} disabled={saving}>{t('save')}</Button>
        </div>
      )}
    >
      <div className="flex flex-col gap-4">
        <Input
          label={`${t('productNameAr')} *`}
          value={form.nameAr}
          onChange={(event: ChangeEvent<HTMLInputElement>) => updateForm({ nameAr: event.target.value })}
        />
        <Input
          label={t('productNameEn')}
          value={form.nameEn}
          onChange={(event: ChangeEvent<HTMLInputElement>) => updateForm({ nameEn: event.target.value })}
        />
        <Input
          type="select"
          label={t('category')}
          value={form.categoryId}
          onChange={(event: ChangeEvent<HTMLSelectElement>) => updateForm({ categoryId: event.target.value })}
        >
          <option value="">-</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>{category.nameAr || category.nameEn}</option>
          ))}
        </Input>

        {sections.length > 0 && (
          <div>
            <div className="mb-2 text-[12px] text-noorix-muted">{t('productSections')}</div>
            <div className="flex flex-wrap gap-x-3 gap-y-2">
              {sections.map((section) => (
                <Checkbox
                  key={section.id}
                  checked={(form.sectionIds || []).includes(section.id)}
                  onChange={(event) => toggleSection(section.id, event.target.checked)}
                  label={section.nameAr}
                  className="cursor-pointer"
                  containerClassName="cursor-pointer text-[13px]"
                />
              ))}
            </div>
          </div>
        )}

        {!advanced ? (
          <>
            <Input
              type="number"
              min="0"
              step="0.01"
              label={t('ordersProductSimplePrice')}
              value={form.simpleLastPrice}
              onChange={(event: ChangeEvent<HTMLInputElement>) => updateForm({ simpleLastPrice: event.target.value })}
            />
            <Button type="button" size="sm" variant="ghost" onClick={() => setAdvanced(true)}>
              {t('ordersProductAdvanced')}
            </Button>
          </>
        ) : (
          <>
            <VariantsTable
              t={t}
              variants={form.variants}
              sizesOptions={sizesOptions}
              packagingOptions={packagingOptions}
              updateVariant={updateVariant}
              removeVariant={removeVariant}
              onAddSize={onAddSize}
              onAddPackaging={onAddPackaging}
              addVariant={addVariant}
            />
            <Button type="button" size="sm" variant="ghost" onClick={() => setAdvanced(false)}>
              {t('ordersProductSimplePrice')}
            </Button>
          </>
        )}
      </div>
    </AdaptiveSheet>
  );
}
