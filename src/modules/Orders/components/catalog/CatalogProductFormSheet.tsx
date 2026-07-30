import React, { type ChangeEvent, useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../../../../i18n/useTranslation';
import { AdaptiveSheet, Button, Checkbox, DialogActions, Input } from '../../../../ui';
import type {
  OrderCategory,
  OrderProduct,
  OrderProductRecipeItem,
  OrderProductRecipeMaterialType,
  OrderProductType,
  OrderProductVariant,
  OrderSection,
} from '../../../../types/api';
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
  recipe: OrderProductRecipeItem[];
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
  materialProducts: OrderProduct[];
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

type CatalogFormTab = 'details' | 'variants' | 'recipe';

const recipeMaterialLabels: Record<OrderProductRecipeMaterialType, string> = {
  material: 'مادة عامة',
  tobacco: 'معسل',
  hose: 'لي',
  charcoal: 'فحم',
};

const allRecipeUnitOptions = [
  { value: 'piece', label: 'حبة' },
  { value: 'g', label: 'جرام' },
  { value: 'kg', label: 'كيلو' },
  { value: 'ml', label: 'مل' },
  { value: 'l', label: 'لتر' },
  { value: 'pack', label: 'علبة' },
  { value: 'box', label: 'صندوق' },
  { value: 'carton', label: 'كرتون' },
];

function recipeUnits(materialType: OrderProductRecipeMaterialType) {
  if (materialType === 'tobacco') return [
    { value: 'g', label: 'جرام' },
    { value: 'kg', label: 'كيلو' },
  ];
  if (materialType === 'charcoal') return [
    { value: 'piece', label: 'حبة' },
    { value: 'pack', label: 'علبة' },
    { value: 'carton', label: 'كرتون' },
  ];
  if (materialType === 'hose') return [{ value: 'piece', label: 'حبة' }];
  return allRecipeUnitOptions;
}

function searchableText(...values: unknown[]) {
  return values.map((value) => String(value ?? '')).join(' ').trim().toLowerCase();
}

function productLabel(product: OrderProduct) {
  return product.nameAr || product.nameEn || product.id;
}

function filterWithSelected<T extends { id: string }>(
  rows: T[],
  selectedId: string | null | undefined,
  matches: (row: T) => boolean,
) {
  const filtered = rows.filter(matches);
  const selected = rows.find((row) => row.id === selectedId);
  if (selected && !filtered.some((row) => row.id === selected.id)) return [selected, ...filtered];
  return filtered;
}

function createRecipeRow(materialProducts: OrderProduct[]): OrderProductRecipeItem {
  return {
    materialType: 'material',
    materialProductId: materialProducts[0]?.id ?? '',
    quantity: '',
    unit: 'piece',
  };
}

function RecipeEditor({
  recipe,
  materialProducts,
  onChange,
}: {
  recipe: OrderProductRecipeItem[];
  materialProducts: OrderProduct[];
  onChange: (recipe: OrderProductRecipeItem[]) => void;
}) {
  const [materialSearchByRow, setMaterialSearchByRow] = useState<Record<number, string>>({});

  function updateRow(index: number, patch: Partial<OrderProductRecipeItem>) {
    onChange(recipe.map((row, rowIndex) => {
      if (rowIndex !== index) return row;
      const materialType = patch.materialType ?? row.materialType;
      const nextUnit = patch.materialType && patch.materialType !== row.materialType
        ? recipeUnits(materialType)[0]?.value ?? 'piece'
        : row.unit;
      return { ...row, ...patch, unit: patch.unit ?? nextUnit };
    }));
  }

  function materialOptionsForRow(row: OrderProductRecipeItem, index: number) {
    const query = searchableText(materialSearchByRow[index]);
    return filterWithSelected(materialProducts, row.materialProductId, (product) => {
      if (!query) return true;
      const categoryName = product.category?.nameAr || product.category?.nameEn || '';
      return searchableText(product.nameAr, product.nameEn, categoryName, product.id).includes(query);
    });
  }

  return (
    <div className="rounded-xl border border-noorix-border bg-noorix-bg-muted/40 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-[13px] font-bold text-noorix-text">الرسبي</div>
          <div className="text-[12px] text-noorix-muted">استهلاك كل وحدة مباعة من مواد المخزون.</div>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => onChange([...recipe, createRecipeRow(materialProducts)])}
          disabled={materialProducts.length === 0}
        >
          + مادة
        </Button>
      </div>
      {materialProducts.length === 0 ? (
        <div className="rounded-lg border border-noorix-border bg-white p-3 text-center text-[13px] text-noorix-muted">
          أضف أصناف مواد أولاً حتى يمكن ربطها بالرسبي.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {recipe.length === 0 && (
            <div className="rounded-lg border border-dashed border-noorix-border bg-white p-3 text-center text-[13px] text-noorix-muted">
              لا توجد مواد مرتبطة بهذا الصنف.
            </div>
          )}
          {recipe.map((row, index) => (
            <div key={`${row.materialProductId}-${index}`} className="grid grid-cols-1 gap-2 rounded-lg border border-noorix-border bg-white p-2 sm:grid-cols-[112px_135px_1fr_88px_90px_44px]">
              <Input
                type="select"
                value={row.materialType}
                onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                  updateRow(index, { materialType: event.target.value as OrderProductRecipeMaterialType })
                }
              >
                {Object.entries(recipeMaterialLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Input>
              <Input
                value={materialSearchByRow[index] ?? ''}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setMaterialSearchByRow((current) => ({ ...current, [index]: event.target.value }))
                }
                placeholder="بحث المادة"
              />
              <Input
                type="select"
                value={row.materialProductId}
                onChange={(event: ChangeEvent<HTMLSelectElement>) => updateRow(index, { materialProductId: event.target.value })}
              >
                <option value="">اختر الصنف</option>
                {materialOptionsForRow(row, index).map((product) => (
                  <option key={product.id} value={product.id}>{productLabel(product)}</option>
                ))}
              </Input>
              <Input
                type="number"
                min="0"
                step="0.001"
                value={String(row.quantity ?? '')}
                onChange={(event: ChangeEvent<HTMLInputElement>) => updateRow(index, { quantity: event.target.value })}
                placeholder="الكمية"
              />
              <Input
                type="select"
                value={String(row.unit || recipeUnits(row.materialType)[0]?.value || 'piece')}
                onChange={(event: ChangeEvent<HTMLSelectElement>) => updateRow(index, { unit: event.target.value })}
              >
                {recipeUnits(row.materialType).map((unit) => (
                  <option key={unit.value} value={unit.value}>{unit.label}</option>
                ))}
              </Input>
              <Button type="button" size="sm" variant="danger" onClick={() => onChange(recipe.filter((_, rowIndex) => rowIndex !== index))}>
                x
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
  materialProducts,
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
  const [activeTab, setActiveTab] = useState<CatalogFormTab>('details');
  const [categorySearch, setCategorySearch] = useState('');
  const charcoalMode = Boolean(form && isCharcoalCatalogProduct(form));
  const charcoalPurchaseMode = charcoalMode && form?.productType === 'order';
  const visibleCategories = useMemo(() => {
    const query = searchableText(categorySearch);
    return filterWithSelected(categories, form?.categoryId, (category) => {
      if (!query) return true;
      return searchableText(category.nameAr, category.nameEn, category.id).includes(query);
    });
  }, [categories, categorySearch, form?.categoryId]);

  useEffect(() => {
    if (!open || !form) return;
    setAdvanced(Boolean(form._advanced) || productHasAdvancedVariants(form));
    setActiveTab('details');
    setCategorySearch('');
  }, [open, form?.id]);

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
        <div className="flex flex-wrap gap-2 rounded-xl border border-noorix-border bg-noorix-bg-muted p-1">
          {[
            { key: 'details' as const, label: 'البيانات' },
            { key: 'variants' as const, label: 'الأحجام والأسعار' },
            ...(form.productType === 'sale' ? [{ key: 'recipe' as const, label: 'الرسبي' }] : []),
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`rounded-lg px-3 py-2 text-[13px] font-bold transition ${
                activeTab === tab.key
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'bg-white text-noorix-text hover:bg-emerald-50'
              }`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'details' && (
          <>
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
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1.25fr]">
              <Input
                label="بحث الفئة"
                value={categorySearch}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setCategorySearch(event.target.value)}
                placeholder="ابحث باسم الفئة..."
              />
              <Input
                type="select"
                label={t('category')}
                value={form.categoryId}
                onChange={(event: ChangeEvent<HTMLSelectElement>) => updateForm({ categoryId: event.target.value })}
              >
                <option value="">-</option>
                {visibleCategories.map((category) => (
                  <option key={category.id} value={category.id}>{category.nameAr || category.nameEn}</option>
                ))}
              </Input>
            </div>

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
          </>
        )}

        {activeTab === 'variants' && (!advanced ? (
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
        ))}

        {activeTab === 'recipe' && form.productType === 'sale' && (
          <RecipeEditor
            recipe={form.recipe || []}
            materialProducts={materialProducts}
            onChange={(recipe) => updateForm({ recipe })}
          />
        )}
      </div>
    </AdaptiveSheet>
  );
}
