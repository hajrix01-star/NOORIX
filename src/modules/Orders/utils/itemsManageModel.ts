import type { OrderCategory, OrderProduct, OrderProductPayload, OrderProductVariant, OrderProductType } from '../../../types/api';

export type OrderProductForm = {
  nameAr?: string;
  nameEn?: string | null;
  categoryId?: string | null;
  sectionIds?: string[];
  productType?: OrderProductType;
  simpleLastPrice?: string;
  variants?: OrderProductVariant[];
};

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
        .map((v) => `${v.size || ''} ${v.packaging || ''} ${v.unit || ''} ${v.lastPrice ?? ''}`)
        .join(' ')
        .toLowerCase();
      return na.includes(q) || ne.includes(q) || cat.includes(q) || vtxt.includes(q);
    });
  }

  if (categoryFilter) {
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

export function buildOrderProductPayload(form: OrderProductForm, productType: OrderProductType): OrderProductPayload {
  const validVariants = (form.variants || []).filter(
    (v) => v.size || v.packaging || (v.unit && v.unit !== 'piece') || Number.parseFloat(String(v.lastPrice ?? '')) > 0,
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
      })),
    };
  }
  const price = String(form.simpleLastPrice ?? form.variants?.[0]?.lastPrice ?? '0').trim() || '0';
  return { ...base, lastPrice: price };
}
