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
import { normalizeOrderProductType } from '../../utils/itemsManageModel';
import {
  conversionRowsFromUnknown,
  findCatalogConversionSequenceIssue,
  normalizeCatalogUnit,
  productConvertibleUnitValues,
  productInventoryConversions,
  resolveCatalogUnitMultiplier,
} from '../../utils/productUnitConversionModel';

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

function unitOptionsForProduct(product: OrderProduct | null | undefined, fallbackOptions: UnitOption[]): UnitOption[] {
  return productConvertibleUnitValues(product).map((value) => ({
    value,
    label: unitLabel(value, fallbackOptions),
  }));
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
  const [recipeError, setRecipeError] = useState('');
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
    setRecipeError('');
    setDraft((currentDraft) => normalizeRecipeRow(currentDraft, patch));
  }

  function resetDraft() {
    setDraft(createRecipeRow(materialProducts));
    setEditingIndex(null);
    setRecipeError('');
  }

  function saveDraft() {
    if (materialProducts.length === 0) {
      setRecipeError('لا توجد مواد مخزون صالحة للربط.');
      return;
    }
    const normalizedDraft = normalizeRecipeRow(draft);
    const material = materialById.get(normalizedDraft.materialProductId);
    const quantity = parsePositiveNumber(normalizedDraft.quantity);
    if (
      !material
      || material.isActive === false
      || normalizeOrderProductType(material.productType, 'order') !== 'order'
    ) {
      setRecipeError('اختر مادة مشتراة وفعالة من مخزون الطلبات.');
      return;
    }
    if (!quantity) {
      setRecipeError('أدخل كمية استهلاك أكبر من صفر.');
      return;
    }
    const baseUnit = material.unit || 'piece';
    const recipeUnit = normalizedDraft.unit || baseUnit;
    const multiplier = resolveCatalogUnitMultiplier(
      productInventoryConversions(material),
      recipeUnit,
      baseUnit,
    );
    if (multiplier === null) {
      setRecipeError(`الوحدة المختارة غير مرتبطة بوحدة مخزون ${productLabel(material)}.`);
      return;
    }
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
    setRecipeError('');
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
                min="0.001"
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
            {recipeError && (
              <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-700">
                {recipeError}
              </div>
            )}
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
  const [draft, setDraft] = useState<OrderProductUnitConversion | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editorError, setEditorError] = useState('');
  const selectedTemplate = useMemo(
    () => conversionTemplates.find((template) => template.id === conversionTemplateId),
    [conversionTemplateId, conversionTemplates],
  );
  const templateConversions = useMemo(
    () => conversionRowsFromUnknown(selectedTemplate?.conversions),
    [selectedTemplate],
  );
  const effectiveConversions = useMemo(
    () => [...templateConversions, ...conversions],
    [conversions, templateConversions],
  );
  const formulaLines = conversionFormulaLines(baseUnit, effectiveConversions, unitOptions);
  const visiblePackaging = String(purchasePackaging || '').trim();
  const sequenceIssue = findCatalogConversionSequenceIssue({
    conversions: effectiveConversions,
    purchaseUnit,
    baseUnit,
  });

  function closeEditor() {
    setDraft(null);
    setEditingIndex(null);
    setEditorError('');
  }

  function startAdd() {
    setDraft(createConversionRow(baseUnit, effectiveConversions, purchaseUnit));
    setEditingIndex(null);
    setEditorError('');
  }

  function startEdit(index: number) {
    const row = conversions[index];
    if (!row) return;
    setDraft({ ...row });
    setEditingIndex(index);
    setEditorError('');
  }

  function updateDraft(patch: Partial<OrderProductUnitConversion>) {
    setEditorError('');
    setDraft((current) => {
      if (!current) return current;
      const next = { ...current, ...patch };
      const standardMultiplier = standardConversionMultiplier(next.fromUnit, next.toUnit);
      return standardMultiplier ? { ...next, multiplier: standardMultiplier } : next;
    });
  }

  function saveDraft() {
    if (!draft) return;
    const fromUnit = normalizeCatalogUnit(draft.fromUnit);
    const toUnit = normalizeCatalogUnit(draft.toUnit);
    const multiplier = parsePositiveNumber(draft.multiplier);
    if (!fromUnit || !toUnit) {
      setEditorError('حدد وحدتي التحويل.');
      return;
    }
    if (fromUnit === toUnit) {
      setEditorError('يجب أن تكون وحدة البداية مختلفة عن وحدة الناتج.');
      return;
    }
    if (!multiplier) {
      setEditorError('أدخل معامل تحويل أكبر من صفر.');
      return;
    }

    const otherRows = [
      ...templateConversions,
      ...conversions.filter((_, index) => index !== editingIndex),
    ];
    const hasDuplicatePair = otherRows.some((row) => {
      const rowFrom = normalizeCatalogUnit(row.fromUnit);
      const rowTo = normalizeCatalogUnit(row.toUnit);
      return (rowFrom === fromUnit && rowTo === toUnit)
        || (rowFrom === toUnit && rowTo === fromUnit);
    });
    if (hasDuplicatePair) {
      setEditorError('هذا التحويل موجود مسبقاً أو مكرر بالاتجاه العكسي.');
      return;
    }
    const hasAmbiguousSource = otherRows.some((row) => (
      normalizeCatalogUnit(row.fromUnit) === fromUnit
      && normalizeCatalogUnit(row.toUnit) !== toUnit
    ));
    if (hasAmbiguousSource) {
      setEditorError('وحدة البداية مرتبطة بمسار آخر. استخدم المرحلة التالية من السلسلة.');
      return;
    }

    const normalizedDraft: OrderProductUnitConversion = {
      ...draft,
      fromUnit,
      toUnit,
      multiplier: String(multiplier),
    };
    const nextConversions = editingIndex === null
      ? [...conversions, normalizedDraft]
      : conversions.map((row, index) => (index === editingIndex ? normalizedDraft : row));
    const nextIssue = findCatalogConversionSequenceIssue({
      conversions: [...templateConversions, ...nextConversions],
      purchaseUnit,
      baseUnit,
    });
    if (nextIssue?.kind === 'disconnected') {
      setEditorError(
        `المرحلة ${nextIssue.index + 1} يجب أن تبدأ من ${unitLabel(nextIssue.expectedFromUnit, unitOptions)} لأنها ناتج المرحلة السابقة.`,
      );
      return;
    }
    onChange(nextConversions);
    closeEditor();
  }

  function removeRow(index: number) {
    onChange(conversions.filter((_, rowIndex) => rowIndex !== index));
    if (editingIndex === index) closeEditor();
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
          onClick={startAdd}
          disabled={draft !== null}
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
      <div className="flex flex-col gap-3">
        {effectiveConversions.length === 0 && !draft && (
          <div className="rounded-lg border border-dashed border-noorix-border bg-white p-3 text-center text-[13px] text-noorix-muted">
            لا توجد مراحل تحويل. أضف أول مرحلة من وحدة الشراء حتى تصل إلى وحدة المخزون.
          </div>
        )}
        {effectiveConversions.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-noorix-border bg-white">
            <div className="grid grid-cols-[70px_minmax(0,1fr)_116px] border-b border-noorix-border bg-noorix-bg-muted px-3 py-2 text-center text-[12px] font-bold text-noorix-text">
              <span>المرحلة</span>
              <span>المعادلة</span>
              <span>الإجراءات</span>
            </div>
            {templateConversions.map((row, index) => (
              <div
                key={`template-${row.fromUnit}-${row.toUnit}-${index}`}
                className="grid grid-cols-[70px_minmax(0,1fr)_116px] items-center border-b border-noorix-border px-3 py-2 text-center text-[13px]"
              >
                <span className="font-bold text-noorix-muted">{index + 1}</span>
                <span className="font-semibold text-noorix-text">{conversionStepSummary(row, unitOptions)}</span>
                <span className="text-[11px] text-noorix-muted">من القالب</span>
              </div>
            ))}
            {conversions.map((row, index) => (
              <div
                key={`custom-${row.fromUnit}-${row.toUnit}-${index}`}
                className="grid grid-cols-[70px_minmax(0,1fr)_116px] items-center border-b border-noorix-border px-3 py-2 text-center text-[13px] last:border-b-0"
              >
                <span className="font-bold text-noorix-muted">{templateConversions.length + index + 1}</span>
                <span className="font-semibold text-noorix-text">{conversionStepSummary(row, unitOptions)}</span>
                <span className="flex items-center justify-center gap-1">
                  <Button type="button" size="sm" variant="ghost" onClick={() => startEdit(index)}>تحرير</Button>
                  <Button type="button" size="sm" variant="danger" onClick={() => removeRow(index)}>حذف</Button>
                </span>
              </div>
            ))}
          </div>
        )}
        {sequenceIssue && !draft && (
          <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-[12px] font-semibold text-orange-800">
            {sequenceIssue.kind === 'disconnected'
              ? `المرحلة ${sequenceIssue.index + 1} غير متصلة بما قبلها؛ يجب أن تبدأ من ${unitLabel(sequenceIssue.expectedFromUnit, unitOptions)}.`
              : `السلسلة غير مكتملة؛ أضف المرحلة التالية حتى تصل إلى وحدة المخزون: ${unitLabel(sequenceIssue.expectedFromUnit, unitOptions)}.`}
          </div>
        )}
        {draft && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
            <div className="mb-2 text-[12px] font-bold text-noorix-text">
              {editingIndex === null ? 'إضافة مرحلة تحويل' : `تحرير المرحلة ${templateConversions.length + editingIndex + 1}`}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_120px_1fr_auto]">
              <Input
                type="select"
                aria-label="من وحدة"
                value={String(draft.fromUnit || '')}
                onChange={(event: ChangeEvent<HTMLSelectElement>) => updateDraft({ fromUnit: event.target.value })}
              >
                {unitOptions.map((unit) => <option key={unit.value} value={unit.value}>{unit.label}</option>)}
              </Input>
              <Input
                type="number"
                min="0.001"
                step="0.001"
                value={String(draft.multiplier ?? '')}
                onChange={(event: ChangeEvent<HTMLInputElement>) => updateDraft({ multiplier: event.target.value })}
                placeholder="العدد"
              />
              <Input
                type="select"
                aria-label="إلى وحدة"
                value={String(draft.toUnit || '')}
                onChange={(event: ChangeEvent<HTMLSelectElement>) => updateDraft({ toUnit: event.target.value })}
              >
                {unitOptions.map((unit) => <option key={unit.value} value={unit.value}>{unit.label}</option>)}
              </Input>
              <div className="flex items-center gap-1">
                <Button type="button" size="sm" onClick={saveDraft}>حفظ</Button>
                <Button type="button" size="sm" variant="ghost" onClick={closeEditor}>إلغاء</Button>
              </div>
            </div>
            <div className="mt-2 text-[12px] font-semibold text-emerald-800">
              {conversionStepSummary(draft, unitOptions)}
            </div>
            {editorError && (
              <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-700">
                {editorError}
              </div>
            )}
          </div>
        )}
      </div>
      {effectiveConversions.length > 0 && (
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
  const [formError, setFormError] = useState('');
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
    setFormError('');
  }, [open, form?.id]);

  if (!form) return null;

  const title = mode === 'edit' ? t('ordersEditProduct') : t('ordersAddProduct');

  function updateForm(patch: Partial<CatalogProductFormState>) {
    setFormError('');
    setForm((current) => (current ? { ...current, ...patch } : current));
  }

  function handleSave() {
    if (!form) return;
    if (form.productType === 'order') {
      const selectedTemplate = activeConversionTemplates.find(
        (template) => template.id === form.conversionTemplateId,
      );
      const issue = findCatalogConversionSequenceIssue({
        conversions: [
          ...conversionRowsFromUnknown(selectedTemplate?.conversions),
          ...conversionRowsFromUnknown(form.inventoryConversions),
        ],
        purchaseUnit: form.variants?.[0]?.unit || form.unit || 'piece',
        baseUnit: form.unit || 'piece',
      });
      if (issue) {
        setActiveTab('conversions');
        setFormError(
          issue.kind === 'disconnected'
            ? `لا يمكن الحفظ: المرحلة ${issue.index + 1} غير متصلة. يجب أن تبدأ من ${unitLabel(issue.expectedFromUnit, unitOptions)}.`
            : `لا يمكن الحفظ: أكمل سلسلة التحويل حتى تصل إلى وحدة المخزون ${unitLabel(issue.expectedFromUnit, unitOptions)}.`,
        );
        return;
      }
    }
    setFormError('');
    onSave();
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
            { key: 'save', label: t('save'), role: 'save', loading: saving, disabled: saving, onClick: handleSave },
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
            <Button
              key={tab.key}
              type="button"
              size="sm"
              variant={activeTab === tab.key ? 'success' : 'ghost'}
              className={`rounded-lg px-3 py-2 text-[13px] font-bold transition ${
                activeTab === tab.key
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'bg-white text-noorix-text hover:bg-emerald-50'
              }`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        {formError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-semibold text-red-700">
            {formError}
          </div>
        )}

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
            purchaseUnit={form.variants?.[0]?.unit || form.unit || 'piece'}
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
