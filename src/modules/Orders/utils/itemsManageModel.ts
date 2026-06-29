export type OrderProductType = 'order' | 'sale';

export function filterOrderProductsForManageTab(
  products: any[],
  searchQuery: string,
  sectionFilter: string,
  categoryFilter: string,
) {
  let result = products;
  const q = searchQuery.trim().toLowerCase();
  if (q) {
    result = result.filter((p: any) => {
      const cat = `${p.category?.nameAr || ''} ${p.category?.nameEn || ''}`.toLowerCase();
      const na = String(p.nameAr || '').toLowerCase();
      const ne = String(p.nameEn || '').toLowerCase();
      const variants = Array.isArray(p.variants) ? p.variants : [];
      const vtxt = variants
        .map((v: any) => `${v.size || ''} ${v.packaging || ''} ${v.unit || ''} ${v.lastPrice ?? ''}`)
        .join(' ')
        .toLowerCase();
      return na.includes(q) || ne.includes(q) || cat.includes(q) || vtxt.includes(q);
    });
  }

  if (categoryFilter) {
    result = result.filter((p: any) => p.categoryId === categoryFilter);
  }

  if (sectionFilter === '__none__') {
    result = result.filter((p: any) => !p.sections || (p.sections as string[]).length === 0);
  } else if (sectionFilter) {
    result = result.filter((p: any) => {
      const secs = p.sections as string[] | null;
      return secs && secs.includes(sectionFilter);
    });
  }

  return result;
}

export function filterOrderCategoriesForManageTab(categories: any[], searchQuery: string) {
  const q = searchQuery.trim().toLowerCase();
  if (!q) return categories;
  return categories.filter((c: any) => {
    const na = String(c.nameAr || '').toLowerCase();
    const ne = String(c.nameEn || '').toLowerCase();
    return na.includes(q) || ne.includes(q);
  });
}

export function buildOrderProductPayload(form: any, productType: OrderProductType) {
  const validVariants = (form.variants || []).filter(
    (v: any) => v.size || v.packaging || (v.unit && v.unit !== 'piece') || parseFloat(v.lastPrice) > 0,
  );
  const sectionIds = Array.isArray(form.sectionIds) ? form.sectionIds.filter(Boolean) : [];
  const base = {
    nameAr: form.nameAr?.trim(),
    nameEn: form.nameEn?.trim() || undefined,
    categoryId: form.categoryId || undefined,
    sectionIds: sectionIds.length > 0 ? sectionIds : undefined,
    productType,
  };
  if (validVariants.length > 0) {
    return {
      ...base,
      variants: validVariants.map((v: any) => ({
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
