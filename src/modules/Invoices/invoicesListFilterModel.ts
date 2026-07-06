import type { SearchableOption } from '../../ui';
import { localizedDisplayName, vaultDisplayName } from '../../utils/vaultDisplay';

export type InvoiceFilterLang = 'ar' | 'en' | string;
export type InvoiceFilterTranslate = (key: string, ...args: unknown[]) => string;

export type InvoiceNamedEntity = {
  id?: string | null;
  name?: string | null;
  nameAr?: string | null;
  nameEn?: string | null;
  email?: string | null;
  [key: string]: unknown;
};

export type InvoiceVaultFilterEntity = InvoiceNamedEntity & {
  type?: string | null;
};

function localizedName(entity: InvoiceNamedEntity | null | undefined, lang: InvoiceFilterLang, fallback = '') {
  if (!entity) return fallback;
  return localizedDisplayName(entity, lang, '') || entity.email || entity.id || fallback;
}

function optionFromEntity(entity: InvoiceNamedEntity, lang: InvoiceFilterLang): SearchableOption | null {
  const value = entity.id ? String(entity.id) : '';
  if (!value) return null;
  return {
    value,
    label: localizedName(entity, lang, value),
  };
}

export function buildInvoiceKindFilterOptions(
  t: InvoiceFilterTranslate,
  showSaleKindFilter: boolean,
): SearchableOption[] {
  const options: SearchableOption[] = [
    { value: 'purchase', label: t('categoryTypes') },
    { value: 'expense', label: t('categoryTypeExpense') },
    { value: 'fixed_expense', label: t('fixedExpenseType') },
    { value: 'hr_expense', label: t('invoiceKindHrExpense') },
    { value: 'salary', label: t('totalSalary') },
    { value: 'advance', label: t('quickAdvance') },
  ];

  if (showSaleKindFilter) {
    options.push({ value: 'sale', label: t('categoryTypeSale') });
  }

  return options;
}

export function buildInvoiceSupplierFilterOptions(
  suppliers: InvoiceNamedEntity[] | null | undefined,
  lang: InvoiceFilterLang,
): SearchableOption[] {
  return (suppliers || [])
    .map((supplier) => optionFromEntity(supplier, lang))
    .filter(isSearchableOption);
}

export function buildInvoiceSupplierCategoryFilterOptions(
  supplierCategories: InvoiceNamedEntity[] | null | undefined,
  lang: InvoiceFilterLang,
): SearchableOption[] {
  return (supplierCategories || [])
    .map((category) => optionFromEntity(category, lang))
    .filter(isSearchableOption);
}

export function buildInvoiceCreatorFilterOptions(
  creatorUsers: InvoiceNamedEntity[] | null | undefined,
  lang: InvoiceFilterLang,
  t: InvoiceFilterTranslate,
): SearchableOption[] {
  const users = (creatorUsers || [])
    .map((user) => optionFromEntity(user, lang))
    .filter(isSearchableOption);

  return [{ value: '__none__', label: t('invoicesFilterCreatorUnrecorded') }, ...users];
}

export function buildInvoiceVaultFilterOptions(
  vaults: InvoiceVaultFilterEntity[] | null | undefined,
  lang: InvoiceFilterLang,
): SearchableOption[] {
  return (vaults || [])
    .map((vault) => {
      const value = vault.id ? String(vault.id) : '';
      if (!value) return null;
      return {
        value,
        label: vaultDisplayName(vault, lang) || value,
      };
    })
    .filter(isSearchableOption);
}

function isSearchableOption(value: SearchableOption | null): value is SearchableOption {
  return Boolean(value);
}
