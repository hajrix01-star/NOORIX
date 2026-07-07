import type {
  SupplierCategoryRecord,
  SupplierLang,
  SupplierRecord,
  SupplierType,
} from './supplierTypes';

export function normalizeSupplierType(value: SupplierRecord['supplierType']): SupplierType {
  return value === 'expenses' || value === 'expense' ? 'expenses' : 'purchases';
}

export function getSupplierName(supplier: SupplierRecord | null | undefined, lang: SupplierLang) {
  if (!supplier) return '-';
  return (lang === 'en' ? supplier.nameEn || supplier.nameAr : supplier.nameAr || supplier.nameEn) || '-';
}

export function getSupplierSecondaryName(supplier: SupplierRecord, lang: SupplierLang) {
  return lang === 'en' ? supplier.nameAr || '-' : supplier.nameEn || '-';
}

export function getSupplierCategoryName(category: SupplierCategoryRecord | null | undefined, lang: SupplierLang) {
  if (!category) return '-';
  return (lang === 'en' ? category.nameEn || category.nameAr : category.nameAr || category.nameEn) || '-';
}

export function findSupplierCategory(
  categories: SupplierCategoryRecord[],
  supplier: SupplierRecord | null | undefined,
) {
  if (!supplier?.supplierCategoryId) return undefined;
  return categories.find((category) => category.id === supplier.supplierCategoryId);
}

export function getSupplierTypeBadgeMeta(type: SupplierRecord['supplierType']) {
  const normalizedType = normalizeSupplierType(type);
  return normalizedType === 'expenses'
    ? { color: 'amber' as const, labelKey: 'supplierTypeExpenses' }
    : { color: 'blue' as const, labelKey: 'supplierTypePurchases' };
}

export function getSupplierCategoryPickerLabel(category: SupplierCategoryRecord, lang: SupplierLang) {
  const icon = category.icon || category.account?.icon || '';
  const displayCode = category.code || category.account?.code || '';
  const code = displayCode ? ` [${displayCode}]` : '';
  const name = getSupplierCategoryName(category, lang);
  return `${icon} ${category.parentId ? `↳ ${name}` : name}${code}`.trim();
}

export function filterSupplierCategoriesForType(
  categories: SupplierCategoryRecord[],
  supplierType: SupplierType,
) {
  return categories.filter((category) => {
    if (supplierType === 'purchases') return category.type === 'purchase';
    if (supplierType === 'expenses') return category.type === 'expense';
    return true;
  });
}
