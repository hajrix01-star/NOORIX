import type { SearchableOption } from '../../ui';
import { vaultDisplayName } from '../../utils/vaultDisplay';

export type InvoiceFilterLang = 'ar' | 'en' | string;
export type InvoiceFilterTranslate = (key: string, ...args: any[]) => string;

export type InvoiceNamedEntity = {
  id?: string;
  name?: string;
  nameAr?: string;
  nameEn?: string;
  email?: string;
};

export type InvoiceVaultFilterEntity = InvoiceNamedEntity & {
  type?: string;
};

function localizedName(entity: InvoiceNamedEntity | null | undefined, lang: InvoiceFilterLang, fallback = '') {
  if (!entity) return fallback;
  const primary = lang === 'en' ? entity.nameEn || entity.nameAr : entity.nameAr || entity.nameEn;
  return primary || entity.name || entity.email || entity.id || fallback;
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
    .filter(Boolean) as SearchableOption[];
}

export function buildInvoiceSupplierCategoryFilterOptions(
  supplierCategories: InvoiceNamedEntity[] | null | undefined,
  lang: InvoiceFilterLang,
): SearchableOption[] {
  return (supplierCategories || [])
    .map((category) => optionFromEntity(category, lang))
    .filter(Boolean) as SearchableOption[];
}

export function buildInvoiceCreatorFilterOptions(
  creatorUsers: InvoiceNamedEntity[] | null | undefined,
  lang: InvoiceFilterLang,
  t: InvoiceFilterTranslate,
): SearchableOption[] {
  const users = (creatorUsers || [])
    .map((user) => optionFromEntity(user, lang))
    .filter(Boolean) as SearchableOption[];

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
    .filter(Boolean) as SearchableOption[];
}
