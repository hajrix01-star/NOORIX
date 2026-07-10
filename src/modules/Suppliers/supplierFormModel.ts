import type {
  SupplierCategoryRecord,
  SupplierCreatePayload,
  SupplierFormState,
  SupplierLang,
  SupplierRecord,
  SupplierType,
  SupplierUpdatePayload,
  TranslationFn,
} from './supplierTypes';
import {
  filterSupplierCategoriesForType,
  getSupplierCategoryPickerLabel,
  normalizeSupplierType,
} from './supplierDisplayModel';

export const EMPTY_SUPPLIER_FORM: SupplierFormState = {
  nameAr: '',
  nameEn: '',
  taxNumber: '',
  phone: '',
  supplierCategoryId: '',
  supplierType: 'purchases',
  isTaxRegistered: true,
};

export type SupplierFormField = keyof SupplierFormState;
export type SupplierFormValue<TField extends SupplierFormField> = SupplierFormState[TField];

export function supplierFormFromRecord(supplier: SupplierRecord | null | undefined): SupplierFormState {
  if (!supplier) return EMPTY_SUPPLIER_FORM;
  return {
    nameAr: supplier.nameAr || '',
    nameEn: supplier.nameEn || '',
    taxNumber: supplier.taxNumber || '',
    phone: supplier.phone || '',
    supplierCategoryId: supplier.supplierCategoryId || '',
    supplierType: normalizeSupplierType(supplier.supplierType),
    isTaxRegistered: supplier.isTaxRegistered ?? true,
  };
}

function trimOptional(value: string) {
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function buildSupplierCreatePayload(companyId: string, form: SupplierFormState): SupplierCreatePayload {
  return {
    companyId,
    nameAr: form.nameAr.trim(),
    nameEn: trimOptional(form.nameEn),
    taxNumber: trimOptional(form.taxNumber),
    phone: trimOptional(form.phone),
    supplierType: form.supplierType,
    supplierCategoryId: form.supplierCategoryId || undefined,
    isTaxRegistered: form.isTaxRegistered,
  };
}

export function buildSupplierUpdatePayload(form: SupplierFormState): SupplierUpdatePayload {
  const { companyId: _companyId, ...payload } = buildSupplierCreatePayload('unused-company', form);
  return payload;
}

export function isSupplierFormSubmittable(form: SupplierFormState) {
  return Boolean(form.nameAr.trim());
}

export function buildSupplierTypeOptions(t: TranslationFn) {
  return [
    { value: 'purchases' as SupplierType, label: t('supplierTypePurchases') },
    { value: 'expenses' as SupplierType, label: t('supplierTypeExpenses') },
  ];
}

export function buildSupplierCategoryOptions(
  categories: SupplierCategoryRecord[],
  supplierType: SupplierType,
  lang: SupplierLang,
) {
  return filterSupplierCategoriesForType(categories, supplierType).map((category) => ({
    value: category.id,
    label: getSupplierCategoryPickerLabel(category, lang),
  }));
}
