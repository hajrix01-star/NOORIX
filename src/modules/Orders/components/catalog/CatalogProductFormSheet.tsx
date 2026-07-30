import React, { type ChangeEvent, useEffect, useState } from 'react';
import { useTranslation } from '../../../../i18n/useTranslation';
import { AdaptiveSheet, Button, Checkbox, DialogActions, Input } from '../../../../ui';
import type { OrderCategory, OrderProductType, OrderProductVariant, OrderSection } from '../../../../types/api';
import { productHasAdvancedVariants } from './catalogProductUtils';
import {
  buildStandardCharcoalVariants,
  charcoalConversionLabel,
  isCharcoalCatalogProduct,
} from '../../utils/charcoalPackaging';

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
  charcoalMode,
  charcoalPurchaseMode,
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
  charcoalMode: boolean;
  charcoalPurchaseMode: boolean;
}) {
  if (charcoalMode) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-[12px] text-emerald-800">
          أحجام الفحم مرتبطة بمعادلات ثابتة: العلبة 64 حبة، والكرتون 10 علب. الوحدة ومعامل التحويل يحددهما النظام تلقائيًا.
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {variants.map((variant, index) => (
            <div key={String(variant.packaging || index)} className="rounded-xl border border-noorix-border bg-noorix-bg-muted p-3">
              <div className="mb-1 text-[13px] font-bold text-noorix-text">{String(variant.packaging || 'فحم')}</div>
              <div className="mb-3 text-[11px] font-semibold text-emerald-700">
                {charcoalConversionLabel(variant)}
              </div>
              {charcoalPurchaseMode && (
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  label={t('ordersVariantPrice')}
                  value={variant.lastPrice}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    updateVariant(index, 'lastPrice', event.target.value)
                  }
                />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-[12px] text-noorix-muted">{t('ordersProductVariants')}</label>
        <Button type="button" size="sm" onClick={addVariant}>+ {t('ordersAddVariant')}</Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-noorix-border">
        <table className="w-full min-w-[560px] border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-noorix-border bg-noorix-bg-muted">
              <th className="px-2.5 py-2 text-right font-semibold">{t('ordersProductSize')}</th>
              <th className="px-2.5 py-2 text-right font-semibold">{t('ordersProductPackaging')}</th>
              <th className="px-2.5 py-2 text-right font-semibold">{t('unit')}</th>
              <th className="px-2.5 py-2 text-right font-semibold">{t('ordersVariantMultiplier')}</th>
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
                    onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                      const unit = event.target.value;
                      updateVariant(index, 'unit', unit);
                      if (unit === 'half_pack') {
                        updateVariant(index, 'quantityMultiplier', '0.5');
                      }
                    }}
                  >
                    <option value="piece">{t('ordersUnitPiece')}</option>
                    <option value="kg">{t('ordersUnitKg')}</option>
                    <option value="box">{t('ordersUnitBox')}</option>
                    <option value="pack">{t('ordersUnitPack')}</option>
                    <option value="half_pack">{t('ordersUnitHalfPack')}</option>
                    <option value="carton">{t('ordersUnitCarton')}</option>
                    <option value="dozen">{t('ordersUnitDozen')}</option>
                  </Input>
                </td>
                <td className="px-2 py-1.5">
                  <Input
                    type="number"
                    min="0.0001"
                    step="0.25"
                    value={variant.quantityMultiplier ?? '1'}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      updateVariant(index, 'quantityMultiplier', event.target.value)
                    }
                    className="w-20"
                    title={t('ordersVariantMultiplierHint')}
                  />
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
  const charcoalMode = Boolean(form && isCharcoalCatalogProduct(form));
  const charcoalPurchaseMode = charcoalMode && form?.productType === 'order';

  useEffect(() => {
    if (!open || !form) return;
    setAdvanced(Boolean(form._advanced) || productHasAdvancedVariants(form));
  }, [open, form]);

  useEffect(() => {
    if (!open || !charcoalMode) return;
    setAdvanced(true);
    setForm((current) => {
      if (!current || !isCharcoalCatalogProduct(current)) return current;
      const standardized = buildStandardCharcoalVariants(
        current.variants || [],
        current.productType === 'order',
      );
      const currentFingerprint = JSON.stringify((current.variants || []).map((variant) => [
        variant.packaging,
        variant.unit,
        String(variant.quantityMultiplier ?? '1'),
        String(variant.lastPrice ?? ''),
      ]));
      const nextFingerprint = JSON.stringify(standardized.map((variant) => [
        variant.packaging,
        variant.unit,
        String(variant.quantityMultiplier ?? '1'),
        String(variant.lastPrice ?? ''),
      ]));
      return currentFingerprint === nextFingerprint
        ? current
        : { ...current, variants: standardized, _advanced: true };
    });
  }, [charcoalMode, open, setForm]);

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
        <DialogActions
          actions={[
            { key: 'cancel', label: t('cancel'), role: 'cancel', disabled: saving, onClick: onClose },
            ...(mode === 'edit' && onDelete
              ? [{ key: 'delete', label: t('delete'), role: 'delete' as const, disabled: saving, onClick: onDelete }]
              : []),
            { key: 'save', label: t('save'), role: 'save', loading: saving, disabled: saving, onClick: onSave },
          ]}
        />
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
              charcoalMode={charcoalMode}
              charcoalPurchaseMode={charcoalPurchaseMode}
            />
            {!charcoalMode && (
              <Button type="button" size="sm" variant="ghost" onClick={() => setAdvanced(false)}>
                {t('ordersProductSimplePrice')}
              </Button>
            )}
          </>
        )}
      </div>
    </AdaptiveSheet>
  );
}
