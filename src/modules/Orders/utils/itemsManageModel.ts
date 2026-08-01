import type {
  OrderCategory,
  OrderProduct,
  OrderProductPayload,
  OrderProductRecipeItem,
  OrderProductRecipeMaterialType,
  OrderProductUnitConversion,
  OrderProductVariant,
  OrderProductType,
  OrderConversionTemplate,
} from '../../../types/api';

export type OrderProductForm = {
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
};

export type EditableOrderProduct = OrderProductForm & {
  id?: string;
  _advanced?: boolean;
};

export type OrderProductUpdateBody = {
  nameAr: string;
  nameEn: string | null;
  categoryId: string | null;
  sectionIds: string[];
  productType: OrderProductType;
  unit?: string;
  variants?: OrderProductVariant[];
  inventoryConversions?: OrderProductUnitConversion[];
  conversionTemplateId?: string | null;
  recipe?: OrderProductRecipeItem[];
  lastPrice?: string;
};

export function normalizeOrderProductType(value: unknown, fallback: OrderProductType): OrderProductType {
  return value === 'sale' || value === 'order' ? value : fallback;
}

export function createEmptyOrderProductForm(productType: OrderProductType): OrderProductForm {
  return {
    nameAr: '',
    nameEn: '',
    categoryId: '',
    sectionIds: [],
    productType,
    unit: 'piece',
    simpleLastPrice: '',
    variants: [{ size: '', packaging: '', unit: 'piece', lastPrice: '', quantityMultiplier: '1' }],
    inventoryConversions: [],
    conversionTemplateId: '',
    recipe: [],
  };
}

function isRecipeMaterialType(value: unknown): value is OrderProductRecipeMaterialType {
  return value === 'material' || value === 'tobacco' || value === 'hose' || value === 'charcoal';
}

function normalizeRecipeMaterialType(value: unknown): OrderProductRecipeMaterialType {
  return isRecipeMaterialType(value) ? value : 'material';
}

function defaultRecipeUnit(materialType: OrderProductRecipeMaterialType): string {
  if (materialType === 'tobacco') return 'g';
  return 'piece';
}

function sanitizeRecipe(recipe: unknown): OrderProductRecipeItem[] {
  if (!Array.isArray(recipe)) return [];
  return recipe.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Partial<OrderProductRecipeItem>;
    const materialType = normalizeRecipeMaterialType(row.materialType);
    const materialProductId = String(row.materialProductId ?? '').trim();
    const quantity = String(row.quantity ?? '').trim();
    const parsedQuantity = Number.parseFloat(quantity);
    if (!materialProductId || !Number.isFinite(parsedQuantity) || parsedQuantity <= 0) return [];
    return [{
      materialType,
      materialProductId,
      quantity,
      unit: String(row.unit ?? '').trim() || defaultRecipeUnit(materialType),
    }];
  });
}

function sanitizeInventoryConversions(value: unknown): OrderProductUnitConversion[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Partial<OrderProductUnitConversion>;
    const fromUnit = String(row.fromUnit ?? '').trim();
    const toUnit = String(row.toUnit ?? '').trim();
    const multiplier = String(row.multiplier ?? '').trim();
    const parsedMultiplier = Number.parseFloat(multiplier);
    if (!fromUnit || !toUnit || !Number.isFinite(parsedMultiplier) || parsedMultiplier <= 0) return [];
    return [{
      fromUnit,
      toUnit,
      multiplier,
      label: String(row.label ?? '').trim() || undefined,
    }];
  });
}

function hasOrderProductVariants(variants: OrderProductVariant[]): boolean {
  return variants.some(
    (variant) =>
      variant.size ||
      variant.packaging ||
      Number.parseFloat(String(variant.quantityMultiplier ?? '1')) !== 1 ||
      Number.parseFloat(String(variant.lastPrice ?? '')) > 0,
  );
}

export function buildEditableOrderProduct(
  product: OrderProduct,
  fallbackProductType: OrderProductType,
): EditableOrderProduct {
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const hasVariants = hasOrderProductVariants(variants);
  return {
    id: product.id,
    nameAr: product.nameAr,
    nameEn: product.nameEn || '',
    categoryId: product.categoryId || '',
    sectionIds: Array.isArray(product.sectionIds) ? [...product.sectionIds] : [],
    productType: normalizeOrderProductType(product.productType, fallbackProductType),
    unit: String(product.unit || 'piece').trim() || 'piece',
    simpleLastPrice: hasVariants ? '' : String(product.lastPrice ?? ''),
    inventoryConversions: sanitizeInventoryConversions(product.inventoryConversions),
    conversionTemplateId: product.conversionTemplateId || '',
    recipe: normalizeOrderProductType(product.productType, fallbackProductType) === 'sale'
      ? sanitizeRecipe(product.recipe)
      : [],
    variants: hasVariants
      ? variants.map((variant) => ({
          size: variant.size || '',
          packaging: variant.packaging || '',
          unit: variant.unit || 'piece',
          lastPrice: variant.lastPrice ? String(variant.lastPrice) : '',
          quantityMultiplier: String(variant.quantityMultiplier ?? '1'),
        }))
      : [{ size: '', packaging: '', unit: 'piece', lastPrice: '', quantityMultiplier: '1' }],
    _advanced: hasVariants,
  };
}

export function buildOrderProductUpdateBody(
  form: EditableOrderProduct,
  fallbackProductType: OrderProductType,
): OrderProductUpdateBody {
  const built = buildOrderProductPayload(form, form.productType || fallbackProductType);
  const validVariants = (form.variants || []).filter(
    (variant) =>
      variant.size ||
      variant.packaging ||
      (variant.unit && variant.unit !== 'piece') ||
      Number.parseFloat(String(variant.quantityMultiplier ?? '1')) !== 1 ||
      Number.parseFloat(String(variant.lastPrice ?? '')) > 0,
  );
  return {
    nameAr: built.nameAr,
    nameEn: built.nameEn ?? null,
    categoryId: built.categoryId || null,
    sectionIds: built.sectionIds ?? [],
    productType: built.productType ?? fallbackProductType,
    unit: built.unit,
    inventoryConversions: built.inventoryConversions ?? [],
    conversionTemplateId: built.conversionTemplateId ?? null,
    recipe: built.recipe ?? [],
    ...(validVariants.length > 0
      ? { variants: built.variants ?? [] }
      : { variants: [], lastPrice: built.lastPrice || '0' }),
  };
}

export function filterOrderProductsForManageTab(
  products: OrderProduct[],
  searchQuery: string,
  sectionFilter: string,
  categoryFilter: string,
) {
  let result = products;
  const q = searchQuery.trim().toLowerCase();
  if (q) {
    result = result.filter((p) => {
      const cat = `${p.category?.nameAr || ''} ${p.category?.nameEn || ''}`.toLowerCase();
      const na = String(p.nameAr || '').toLowerCase();
      const ne = String(p.nameEn || '').toLowerCase();
      const variants = Array.isArray(p.variants) ? p.variants : [];
      const vtxt = variants
        .map((v) => `${v.size || ''} ${v.packaging || ''} ${v.unit || ''} ${v.lastPrice ?? ''} ${v.quantityMultiplier ?? ''}`)
        .join(' ')
        .toLowerCase();
      return na.includes(q) || ne.includes(q) || cat.includes(q) || vtxt.includes(q);
    });
  }

  if (categoryFilter === '__none__') {
    result = result.filter((p) => !p.categoryId);
  } else if (categoryFilter) {
    result = result.filter((p) => p.categoryId === categoryFilter);
  }

  if (sectionFilter === '__none__') {
    result = result.filter((p) => !p.sections || p.sections.length === 0);
  } else if (sectionFilter) {
    result = result.filter((p) => {
      const secs = p.sections;
      return secs && secs.includes(sectionFilter);
    });
  }

  return result;
}

export function filterOrderCategoriesForManageTab(categories: OrderCategory[], searchQuery: string) {
  const q = searchQuery.trim().toLowerCase();
  if (!q) return categories;
  return categories.filter((c) => {
    const na = String(c.nameAr || '').toLowerCase();
    const ne = String(c.nameEn || '').toLowerCase();
    return na.includes(q) || ne.includes(q);
  });
}

export function filterRecipeMaterialProducts(products: OrderProduct[], currentProductId?: string) {
  return products.filter((product) =>
    product.id !== currentProductId
    && product.isActive !== false
    && normalizeOrderProductType(product.productType, 'order') === 'order',
  );
}

export function activeConversionTemplates(templates: OrderConversionTemplate[]) {
  return templates.filter((template) => template.isActive !== false);
}

export function buildOrderProductPayload(
  form: Partial<OrderProductForm>,
  productType: OrderProductType,
): OrderProductPayload {
  const validVariants = (form.variants || []).filter(
    (v) => v.size || v.packaging || (v.unit && v.unit !== 'piece')
      || Number.parseFloat(String(v.quantityMultiplier ?? '1')) !== 1
      || Number.parseFloat(String(v.lastPrice ?? '')) > 0,
  );
  const sectionIds = Array.isArray(form.sectionIds) ? form.sectionIds.filter(Boolean) : [];
  const recipe = productType === 'sale' ? sanitizeRecipe(form.recipe) : [];
  const inventoryConversions = productType === 'order'
    ? sanitizeInventoryConversions(form.inventoryConversions)
    : [];
  const conversionTemplateId = productType === 'order'
    ? String(form.conversionTemplateId ?? '').trim()
    : '';
  const base = {
    nameAr: String(form.nameAr ?? '').trim(),
    nameEn: form.nameEn?.trim() || undefined,
    unit: String(form.unit ?? 'piece').trim() || 'piece',
    categoryId: form.categoryId || undefined,
    sectionIds: sectionIds.length > 0 ? sectionIds : undefined,
    productType,
    ...(inventoryConversions.length > 0 ? { inventoryConversions } : {}),
    ...(conversionTemplateId ? { conversionTemplateId } : {}),
    ...(recipe.length > 0 ? { recipe } : {}),
  };
  if (validVariants.length > 0) {
    return {
      ...base,
      variants: validVariants.map((v) => ({
        size: v.size || '',
        packaging: v.packaging || '',
        unit: v.unit || 'piece',
        lastPrice: v.lastPrice || '0',
        quantityMultiplier: String(v.quantityMultiplier ?? '1'),
      })),
    };
  }
  const price = String(form.simpleLastPrice ?? form.variants?.[0]?.lastPrice ?? '0').trim() || '0';
  return { ...base, lastPrice: price };
}
