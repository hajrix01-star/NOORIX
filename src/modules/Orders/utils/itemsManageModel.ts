import type { OrderCategory, OrderProduct, OrderProductPayload, OrderProductVariant, OrderProductType } from '../../../types/api';

export type OrderProductForm = {
  nameAr: string;
  nameEn: string;
  categoryId: string;
  sectionIds: string[];
  productType: OrderProductType;
  simpleLastPrice: string;
  variants: OrderProductVariant[];
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
  variants?: OrderProductVariant[];
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
    simpleLastPrice: '',
    variants: [{ size: '', packaging: '', unit: 'piece', lastPrice: '', quantityMultiplier: '1' }],
  };
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
    simpleLastPrice: hasVariants ? '' : String(product.lastPrice ?? ''),
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
  const base = {
    nameAr: String(form.nameAr ?? '').trim(),
    nameEn: form.nameEn?.trim() || undefined,
    categoryId: form.categoryId || undefined,
    sectionIds: sectionIds.length > 0 ? sectionIds : undefined,
    productType,
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
