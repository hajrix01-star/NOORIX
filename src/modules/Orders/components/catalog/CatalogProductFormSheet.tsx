import React, { type ChangeEvent, useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../../../../i18n/useTranslation';
import { AdaptiveSheet, Button, Checkbox, DialogActions, Input, SearchableOptionsPicker } from '../../../../ui';
import type {
  OrderCategory,
  OrderCatalogUnit,
  OrderConversionTemplate,
  OrderProduct,
  OrderProductRecipeItem,
  OrderProductUnitConversion,
  OrderProductType,
  OrderProductVariant,
  OrderSection,
} from '../../../../types/api';
import { productHasAdvancedVariants } from './catalogProductUtils';

export type CatalogProductFormState = {
  id?: string;
  nameAr: string;
  nameEn: string;
  categoryId: string;
  sectionIds: string[];
  productType: OrderProductType;
  unit: string;
  simpleLastPrice: string;
  variants: OrderProductVariant[];
  inventoryConversions: OrderProductUnitConversion[];
  conversionTemplateId: string;
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
  catalogUnits: OrderCatalogUnit[];
  conversionTemplates: OrderConversionTemplate[];
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

type CatalogFormTab = 'details' | 'variants' | 'conversions' | 'recipe';

type UnitOption = {
  value: string;
  label: string;
};

const fallbackUnitOptions: UnitOption[] = [
  { value: 'piece', label: 'حبة' },
  { value: 'g', label: 'جرام' },
  { value: 'kg', label: 'كيلو' },
  { value: 'ml', label: 'مل' },
  { value: 'l', label: 'لتر' },
  { value: 'pack', label: 'علبة' },
  { value: 'box', label: 'صندوق' },
  { value: 'carton', label: 'كرتون' },
];

function toUnitOptions(units: OrderCatalogUnit[]): UnitOption[] {
  const byValue = new Map<string, UnitOption>();
  for (const option of fallbackUnitOptions) byValue.set(option.value, option);
  for (const unit of units) {
    if (unit.isActive === false) continue;
    const value = String(unit.code || unit.nameAr || '').trim();
    if (!value) continue;
    byValue.set(value, { value, label: unit.nameAr || unit.nameEn || value });
  }
  return [...byValue.values()];
}

function searchableText(...values: unknown[]) {
  return values.map((value) => String(value ?? '')).join(' ').trim().toLowerCase();
}

function productLabel(product: OrderProduct) {
  return product.nameAr || product.nameEn || product.id;
}
function productSearchableLabel(product: OrderProduct) {
  const categoryName = product.category?.nameAr || product.category?.nameEn || '';
  const label = productLabel(product);
  return categoryName ? `${label} - ${categoryName}` : label;
}

function unitLabel(value: string, unitOptions: UnitOption[]) {
  return unitOptions.find((unit) => unit.value === value)?.label || value;
}

function parsePositiveNumber(value: unknown): number | null {
  const parsed = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function standardConversionMultiplier(fromUnit: string, toUnit: string): string {
  const pair = `${String(fromUnit || '').trim()}:${String(toUnit || '').trim()}`;
  const standards = new Map<string, string>([
    ['kg:g', '1000'],
    ['g:kg', '0.001'],
    ['l:ml', '1000'],
    ['ml:l', '0.001'],
  ]);
  return standards.get(pair) || '';
}

function productUnitConversions(product?: OrderProduct | null): OrderProductUnitConversion[] {
  return Array.isArray(product?.inventoryConversions)
    ? product.inventoryConversions.filter((row): row is OrderProductUnitConversion =>
        Boolean(row) && typeof row === 'object',
      )
    : [];
}

function unitOptionsForProduct(product: OrderProduct | null | undefined, fallbackOptions: UnitOption[]): UnitOption[] {
  const byValue = new Map<string, UnitOption>();
  const baseUnit = String(product?.unit || 'piece').trim() || 'piece';
  byValue.set(baseUnit, { value: baseUnit, label: unitLabel(baseUnit, fallbackOptions) });
  for (const conversion of productUnitConversions(product)) {
    const fromUnit = String(conversion.fromUnit || '').trim();
    const toUnit = String(conversion.toUnit || '').trim();
    if (fromUnit) byValue.set(fromUnit, { value: fromUnit, label: unitLabel(fromUnit, fallbackOptions) });
    if (toUnit) byValue.set(toUnit, { value: toUnit, label: unitLabel(toUnit, fallbackOptions) });
  }
  for (const option of fallbackOptions) {
    if (['piece', 'g', 'kg', 'ml', 'l'].includes(option.value)) byValue.set(option.value, option);
  }
  return [...byValue.values()];
}

function conversionPathToBase(
  unit: string,
  baseUnit: string,
  conversions: OrderProductUnitConversion[],
  unitOptions: UnitOption[],
) {
  const parts: Array<{ unit: string; quantity: number }> = [{ unit, quantity: 1 }];
  const visited = new Set<string>([unit]);
  let currentUnit = unit;
  let currentQuantity = 1;

  while (currentUnit !== baseUnit) {
    const edge = conversions.find((conversion) => String(conversion.fromUnit || '').trim() === currentUnit);
    const multiplier = parsePositiveNumber(edge?.multiplier);
    const toUnit = String(edge?.toUnit || '').trim();
    if (!edge || !multiplier || !toUnit || visited.has(toUnit)) return null;
    currentQuantity *= multiplier;
    currentUnit = toUnit;
    visited.add(currentUnit);
    parts.push({ unit: currentUnit, quantity: currentQuantity });
  }

  return parts
    .map((part, index) => `${index === 0 ? '1' : part.quantity.toLocaleString('en-US')} ${unitLabel(part.unit, unitOptions)}`)
    .join(' = ');
}

function conversionFormulaLines(
  baseUnit: string,
  conversions: OrderProductUnitConversion[],
  unitOptions: UnitOption[],
) {
  const normalizedBaseUnit = String(baseUnit || 'piece').trim() || 'piece';
  const fromUnits = [...new Set(conversions.map((conversion) => String(conversion.fromUnit || '').trim()).filter(Boolean))];
  const nestedToUnits = new Set(conversions.map((conversion) => String(conversion.toUnit || '').trim()).filter(Boolean));
  const chainRootUnits = fromUnits.filter((fromUnit) => !nestedToUnits.has(fromUnit));
  const displayUnits = chainRootUnits.length > 0 ? chainRootUnits : fromUnits;
  return displayUnits.flatMap((fromUnit) => {
    const path = conversionPathToBase(fromUnit, normalizedBaseUnit, conversions, unitOptions);
    return path ? [path] : [];
  });
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
  const firstProduct = materialProducts[0];
  return {
    materialType: 'material',
    materialProductId: firstProduct?.id ?? '',
    quantity: '',
    unit: firstProduct?.unit || 'piece',
  };
}

function RecipeEditor({
  recipe,
  materialProducts,
  unitOptions,
  onChange,
}: {
  recipe: OrderProductRecipeItem[];
  materialProducts: OrderProduct[];
  unitOptions: UnitOption[];
  onChange: (recipe: OrderProductRecipeItem[]) => void;
}) {
  const [draft, setDraft] = useState<OrderProductRecipeItem>(() => createRecipeRow(materialProducts));
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const materialById = useMemo(
    () => new Map(materialProducts.map((product) => [product.id, product])),
    [materialProducts],
  );
  const materialOptions = useMemo(
    () => materialProducts.map((product) => ({
      value: product.id,
      label: productSearchableLabel(product),
    })),
    [materialProducts],
  );

  useEffect(() => {
    setDraft((currentDraft) => {
      if (currentDraft.materialProductId && materialById.has(currentDraft.materialProductId)) return currentDraft;
      return createRecipeRow(materialProducts);
    });
  }, [materialById, materialProducts]);

  function normalizeRecipeRow(row: OrderProductRecipeItem, patch: Partial<OrderProductRecipeItem> = {}) {
    const nextMaterialId = patch.materialProductId ?? row.materialProductId;
      const nextMaterial = materialById.get(nextMaterialId);
    const nextUnit = patch.materialProductId && patch.materialProductId !== row.materialProductId
      ? nextMaterial?.unit || 'piece'
      : patch.unit ?? row.unit ?? nextMaterial?.unit ?? 'piece';
    return { ...row, ...patch, materialType: 'material' as const, unit: nextUnit };
  }

  function updateDraft(patch: Partial<OrderProductRecipeItem>) {
    setDraft((currentDraft) => normalizeRecipeRow(currentDraft, patch));
  }

  function resetDraft() {
    setDraft(createRecipeRow(materialProducts));
    setEditingIndex(null);
  }

  function saveDraft() {
    if (materialProducts.length === 0) return;
    const normalizedDraft = normalizeRecipeRow(draft);
    const quantity = String(normalizedDraft.quantity ?? '').trim();
    if (!normalizedDraft.materialProductId || !quantity) return;
    if (editingIndex === null) {
      onChange([...recipe, normalizedDraft]);
    } else {
      onChange(recipe.map((row, rowIndex) => (rowIndex === editingIndex ? normalizedDraft : row)));
    }
    resetDraft();
  }

  function editRow(index: number) {
    const row = recipe[index];
    if (!row) return;
    setDraft(normalizeRecipeRow(row));
    setEditingIndex(index);
  }

  function removeRow(index: number) {
    onChange(recipe.filter((_, rowIndex) => rowIndex !== index));
    if (editingIndex === index) resetDraft();
    if (editingIndex !== null && editingIndex > index) setEditingIndex(editingIndex - 1);
  }

  return (
    <div className="rounded-xl border border-noorix-border bg-noorix-bg-muted/40 p-3">
      <div className="mb-3">
        <div>
          <div className="text-[13px] font-bold text-noorix-text">الرسبي</div>
          <div className="text-[12px] text-noorix-muted">استهلاك كل وحدة مباعة من مواد المخزون.</div>
        </div>
      </div>
      {materialProducts.length === 0 ? (
        <div className="rounded-lg border border-noorix-border bg-white p-3 text-center text-[13px] text-noorix-muted">
          أضف أصناف مواد أولاً حتى يمكن ربطها بالرسبي.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="rounded-lg border border-noorix-border bg-white p-2">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_96px_110px_auto]">
              <SearchableOptionsPicker
                value={draft.materialProductId}
                onChange={(materialProductId) => updateDraft({ materialProductId })}
                options={materialOptions}
                allowEmpty
                emptyValue=""
                emptyLabel="اختر المادة"
                aria-label="اختيار مادة الرسبي"
              />
              <Input
                type="number"
                min="0"
                step="0.001"
                value={String(draft.quantity ?? '')}
                onChange={(event: ChangeEvent<HTMLInputElement>) => updateDraft({ quantity: event.target.value })}
                placeholder="الكمية"
              />
              <Input
                type="select"
                value={String(draft.unit || 'piece')}
                onChange={(event: ChangeEvent<HTMLSelectElement>) => updateDraft({ unit: event.target.value })}
              >
                {unitOptionsForProduct(materialById.get(draft.materialProductId), unitOptions).map((unit) => (
                  <option key={unit.value} value={unit.value}>{unit.label}</option>
                ))}
              </Input>
              <Button
                type="button"
                size="sm"
                onClick={saveDraft}
                disabled={!draft.materialProductId || !String(draft.quantity ?? '').trim()}
              >
                {editingIndex === null ? 'حفظ المكون' : 'حفظ التعديل'}
              </Button>
            </div>
            {editingIndex !== null && (
              <div className="mt-2 flex justify-end">
                <Button type="button" size="sm" variant="ghost" onClick={resetDraft}>
                  إلغاء التعديل
                </Button>
              </div>
            )}
          </div>
          {recipe.length === 0 && (
            <div className="rounded-lg border border-dashed border-noorix-border bg-white p-3 text-center text-[13px] text-noorix-muted">
              لا توجد مواد مرتبطة بهذا الصنف.
            </div>
          )}
          {recipe.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-noorix-border bg-white">
              <div className="grid grid-cols-[1fr_92px_82px_96px] border-b border-noorix-border bg-noorix-bg-muted px-3 py-2 text-center text-[12px] font-bold text-noorix-text">
                <span>المادة</span>
                <span>الكمية</span>
                <span>الوحدة</span>
                <span>الإجراءات</span>
              </div>
              {recipe.map((row, index) => {
                const material = materialById.get(row.materialProductId);
                return (
                  <div
                    key={`${row.materialProductId}-${index}`}
                    className="grid grid-cols-[1fr_92px_82px_96px] items-center border-b border-noorix-border px-3 py-2 text-center text-[13px] last:border-b-0"
                  >
                    <span className="truncate font-bold text-noorix-text">{material ? productLabel(material) : 'مادة غير محددة'}</span>
                    <span className="font-bold text-noorix-text">{String(row.quantity ?? '') || '-'}</span>
                    <span className="text-noorix-muted">{unitLabel(String(row.unit || 'piece'), unitOptionsForProduct(material, unitOptions))}</span>
                    <span className="flex items-center justify-center gap-1">
                      <Button type="button" size="sm" variant="ghost" onClick={() => editRow(index)}>
                        تعديل
                      </Button>
                      <Button type="button" size="sm" variant="danger" onClick={() => removeRow(index)}>
                        حذف
                      </Button>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function createConversionRow(
  baseUnit: string,
  conversions: OrderProductUnitConversion[],
  purchaseUnit: string,
): OrderProductUnitConversion {
  const normalizedBaseUnit = String(baseUnit || 'piece').trim() || 'piece';
  const normalizedPurchaseUnit = String(purchaseUnit || '').trim();
  const previousToUnit = String(conversions.at(-1)?.toUnit || '').trim();
  const fromUnit = previousToUnit
    || (normalizedPurchaseUnit && normalizedPurchaseUnit !== normalizedBaseUnit ? normalizedPurchaseUnit : '')
    || (normalizedBaseUnit === 'g' ? 'kg' : 'carton');
  const toUnit = normalizedBaseUnit;

  return {
    fromUnit,
    toUnit,
    multiplier: standardConversionMultiplier(fromUnit, toUnit),
    label: '',
  };
}

type ConversionUnitField = 'fromUnit' | 'toUnit';

function conversionUnitOptionsForField(
  unitOptions: UnitOption[],
  conversions: OrderProductUnitConversion[],
  rowIndex: number,
  field: ConversionUnitField,
  oppositeUnit: string,
) {
  const currentUnit = String(conversions[rowIndex]?.[field] ?? '').trim();
  const selectedInOtherRows = new Set(
    conversions.flatMap((row, index) => {
      if (index === rowIndex) return [];
      const selectedUnit = String(row[field] ?? '').trim();
      return selectedUnit ? [selectedUnit] : [];
    }),
  );
  const blockedOppositeUnit = String(oppositeUnit || '').trim();

  return unitOptions.filter((unit) => (
    unit.value === currentUnit
    || (!selectedInOtherRows.has(unit.value) && unit.value !== blockedOppositeUnit)
  ));
}

function conversionStepSummary(
  row: OrderProductUnitConversion,
  unitOptions: UnitOption[],
) {
  const multiplier = String(row.multiplier || '').trim() || '؟';
  const fromUnit = unitLabel(String(row.fromUnit || ''), unitOptions);
  const toUnit = unitLabel(String(row.toUnit || ''), unitOptions);
  return `1 ${fromUnit} = ${multiplier} ${toUnit}`;
}

function ConversionEditor({
  conversions,
  conversionTemplateId,
  conversionTemplates,
  baseUnit,
  purchasePackaging,
  purchaseUnit,
  unitOptions,
  onBaseUnitChange,
  onTemplateChange,
  onChange,
}: {
  conversions: OrderProductUnitConversion[];
  conversionTemplateId: string;
  conversionTemplates: OrderConversionTemplate[];
  baseUnit: string;
  purchasePackaging: string;
  purchaseUnit: string;
  unitOptions: UnitOption[];
  onBaseUnitChange: (unit: string) => void;
  onTemplateChange: (templateId: string) => void;
  onChange: (conversions: OrderProductUnitConversion[]) => void;
}) {
  const formulaLines = conversionFormulaLines(baseUnit, conversions, unitOptions);
  const visiblePackaging = String(purchasePackaging || '').trim();

  function updateRow(index: number, patch: Partial<OrderProductUnitConversion>) {
    onChange(conversions.map((row, rowIndex) => (
      rowIndex === index
        ? (() => {
            const next = { ...row, ...patch };
            const standardMultiplier = standardConversionMultiplier(next.fromUnit, next.toUnit);
            return standardMultiplier ? { ...next, multiplier: standardMultiplier } : next;
          })()
        : row
    )));
  }

  return (
    <div className="rounded-xl border border-noorix-border bg-noorix-bg-muted/40 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-[13px] font-bold text-noorix-text">سلسلة المخزون</div>
          <div className="text-[12px] text-noorix-muted">المصدر الوحيد لحساب المخزون والرسبي. السعر والفاتورة في تبويب الشراء والسعر.</div>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => onChange([...conversions, createConversionRow(baseUnit, conversions, purchaseUnit)])}
        >
          + تحويل
        </Button>
      </div>
      <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-[12px] text-emerald-800">
        وحدة الخصم من المخزون: <b>{unitLabel(baseUnit || 'piece', unitOptions)}</b>. اكتب السلسلة مرة واحدة فقط، مثل: كرتون → علبة → حبة.
      </div>
      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_1fr]">
        <Input
          type="select"
          label="وحدة الخصم/المخزون"
          value={baseUnit || 'piece'}
          onChange={(event: ChangeEvent<HTMLSelectElement>) => onBaseUnitChange(event.target.value)}
        >
          {unitOptions.map((unit) => (
            <option key={unit.value} value={unit.value}>{unit.label}</option>
          ))}
        </Input>
        <Input
          type="select"
          label="قالب جاهز اختياري"
          value={conversionTemplateId}
          onChange={(event: ChangeEvent<HTMLSelectElement>) => onTemplateChange(event.target.value)}
        >
          <option value="">بدون قالب</option>
          {conversionTemplates.filter((template) => template.isActive !== false).map((template) => (
            <option key={template.id} value={template.id}>
              {template.nameAr || template.nameEn || template.code}
            </option>
          ))}
        </Input>
        {conversionTemplateId && (
          <div className="rounded-lg border border-noorix-border bg-white p-3 text-[12px] text-noorix-muted">
            القالب يضيف تحويلات جاهزة للحسابات. التحويلات التي تضيفها هنا تخص هذا الصنف فقط.
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2">
        {conversions.length === 0 && (
          <div className="rounded-lg border border-dashed border-noorix-border bg-white p-3 text-center text-[13px] text-noorix-muted">
            لا توجد تحويلات مخصصة لهذا الصنف.
          </div>
        )}
        {conversions.map((row, index) => (
          (() => {
            const fromUnit = String(row.fromUnit || 'kg');
            const toUnit = String(row.toUnit || baseUnit || 'piece');
            const fromUnitOptions = conversionUnitOptionsForField(unitOptions, conversions, index, 'fromUnit', toUnit);
            const toUnitOptions = conversionUnitOptionsForField(unitOptions, conversions, index, 'toUnit', fromUnit);

            return (
              <div key={`${row.fromUnit}-${row.toUnit}-${index}`} className="grid grid-cols-1 gap-2 rounded-lg border border-noorix-border bg-white p-2 sm:grid-cols-[92px_1fr_118px_1fr_44px]">
                <div className="flex min-h-10 items-center justify-center rounded-lg border border-noorix-border bg-noorix-bg-muted px-2 text-[12px] font-bold text-noorix-text">
                  مرحلة {index + 1}
                </div>
                <Input
                  type="select"
                  aria-label="من وحدة"
                  value={fromUnit}
                  onChange={(event: ChangeEvent<HTMLSelectElement>) => updateRow(index, { fromUnit: event.target.value })}
                >
                  {fromUnitOptions.map((unit) => (
                    <option key={unit.value} value={unit.value}>{unit.label}</option>
                  ))}
                </Input>
                <Input
                  type="number"
                  min="0"
                  step="0.001"
                  value={String(row.multiplier ?? '')}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => updateRow(index, { multiplier: event.target.value })}
                  placeholder="يساوي"
                  title={conversionStepSummary(row, unitOptions)}
                />
                <Input
                  type="select"
                  aria-label="إلى وحدة"
                  value={toUnit}
                  onChange={(event: ChangeEvent<HTMLSelectElement>) => updateRow(index, { toUnit: event.target.value })}
                >
                  {toUnitOptions.map((unit) => (
                    <option key={unit.value} value={unit.value}>{unit.label}</option>
                  ))}
                </Input>
                <Button type="button" size="sm" variant="danger" onClick={() => onChange(conversions.filter((_, rowIndex) => rowIndex !== index))}>
                  x
                </Button>
                <div className="text-[12px] font-semibold text-emerald-800 sm:col-span-5">
                  {conversionStepSummary(row, unitOptions)}
                </div>
              </div>
            );
          })()
        ))}
      </div>
      {conversions.length > 0 && (
        <div className="mt-3 rounded-xl border border-noorix-border bg-white p-3">
          <div className="mb-2 text-[12px] font-bold text-noorix-text">معادلة الصنف</div>
          <div className="mb-2 text-[12px] text-noorix-muted">
            التغليف: <b className="text-noorix-text">{visiblePackaging || '-'}</b>
            <span className="mx-1 text-noorix-muted">·</span>
            يأتي من المورد: <b className="text-noorix-text">{unitLabel(purchaseUnit || baseUnit || 'piece', unitOptions)}</b>
            <span className="mx-1 text-noorix-muted">·</span>
            وحدة المخزون والخصم: <b className="text-noorix-text">{unitLabel(baseUnit || 'piece', unitOptions)}</b>
          </div>
          {formulaLines.length > 0 ? (
            <div className="flex flex-col gap-1 text-[12px] font-semibold text-emerald-800">
              {formulaLines.map((line) => <div key={line}>{line}</div>)}
            </div>
          ) : (
            <div className="text-[12px] text-orange-700">
              أكمل سلسلة التحويل حتى تصل إلى وحدة المخزون الأساسية.
            </div>
          )}
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
  unitOptions,
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
  unitOptions: UnitOption[];
  updateVariant: (idx: number, field: keyof OrderProductVariant, value: string) => void;
  removeVariant: (idx: number) => void;
  onAddSize: () => void;
  onAddPackaging: () => void;
  addVariant: () => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <label className="text-[12px] font-bold text-noorix-text">خيارات الشراء والسعر</label>
          <div className="text-[11px] text-noorix-muted">للفواتير والتسعير فقط. حساب المخزون يتم من تبويب التحويلات.</div>
        </div>
        <Button type="button" size="sm" onClick={addVariant}>+ {t('ordersAddVariant')}</Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-noorix-border">
        <table className="w-full min-w-[560px] border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-noorix-border bg-noorix-bg-muted">
              <th className="px-2.5 py-2 text-right font-semibold">وصف الشراء</th>
              <th className="px-2.5 py-2 text-right font-semibold">التغليف الظاهر</th>
              <th className="px-2.5 py-2 text-right font-semibold">وحدة الفاتورة</th>
              <th className="px-2.5 py-2 text-right font-semibold">كمية الفاتورة</th>
              <th className="px-2.5 py-2 text-right font-semibold">السعر</th>
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
                    {unitOptions.map((unit) => (
                      <option key={unit.value} value={unit.value}>{unit.label}</option>
                    ))}
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
                    title="كمية هذه التركيبة في الفاتورة فقط، وليست معادلة المخزون."
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
  catalogUnits,
  conversionTemplates,
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
  const unitOptions = useMemo(() => toUnitOptions(catalogUnits), [catalogUnits]);
  const activeConversionTemplates = useMemo(
    () => conversionTemplates.filter((template) => template.isActive !== false),
    [conversionTemplates],
  );
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
            ...(form.productType === 'order' ? [{ key: 'conversions' as const, label: 'التحويلات' }] : []),
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
              unitOptions={unitOptions}
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
        ))}

        {activeTab === 'conversions' && form.productType === 'order' && (
          <ConversionEditor
            conversions={form.inventoryConversions || []}
            conversionTemplateId={form.conversionTemplateId || ''}
            conversionTemplates={activeConversionTemplates}
            baseUnit={form.unit || 'piece'}
            purchasePackaging={form.variants?.[0]?.packaging || ''}
            purchaseUnit={form.variants?.[0]?.unit || 'piece'}
            unitOptions={unitOptions}
            onBaseUnitChange={(unit) => updateForm({ unit })}
            onTemplateChange={(conversionTemplateId) => updateForm({ conversionTemplateId })}
            onChange={(inventoryConversions) => updateForm({ inventoryConversions })}
          />
        )}

        {activeTab === 'recipe' && form.productType === 'sale' && (
          <RecipeEditor
            recipe={form.recipe || []}
            materialProducts={materialProducts}
            unitOptions={unitOptions}
            onChange={(recipe) => updateForm({ recipe })}
          />
        )}
      </div>
    </AdaptiveSheet>
  );
}
