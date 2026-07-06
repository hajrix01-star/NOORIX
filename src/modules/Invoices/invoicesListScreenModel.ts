import type { CompanyListItem } from '../../context/appTypes';
import type { InvoiceExecutiveVaultFlowRow } from './invoiceExecutiveCardsModel';
import type { InvoiceViewSource } from './invoiceViewModel';
import {
  pickInvoiceTableName,
  type InvoiceTableLang,
  type InvoiceTableNamedEntity,
  type InvoiceTableRow,
} from './invoiceTableRowModel';

export type InvoiceListCreatorUser = {
  id?: string | null;
  name?: string | null;
  nameAr?: string | null;
  nameEn?: string | null;
  email?: string | null;
};

export type InvoiceListCreatorFilterOptions = {
  users: InvoiceListCreatorUser[];
};

export type InvoiceListCreatorFilterOptionsResponse = {
  users: unknown[];
};

export type InvoiceListCategorySource = {
  type?: string | null;
  [key: string]: unknown;
};

export type InvoiceListRawInvoice = InvoiceTableRow & {
  id?: string | null;
  supplier?: InvoiceTableNamedEntity | null;
  createdByUser?: InvoiceListCreatorUser | null;
  notesOrEmployee?: string | null;
  [key: string]: unknown;
};

export type InvoiceListTableRow = InvoiceListRawInvoice & {
  supplierName: string;
  createdByDisplayName: string;
  notesOrEmployee: string;
};

export type InvoiceListCompanyDisplay = {
  companyName: string;
  logoUrl: string;
};

export type InvoiceListVaultFlowLabelRow = InvoiceExecutiveVaultFlowRow & {
  unassigned?: boolean | null;
  name?: string | null;
  nameAr?: string | null;
  nameEn?: string | null;
};

type Translate = (key: string, ...args: unknown[]) => string;

export function resolveInvoiceListCompanyDisplay(input: {
  companies?: CompanyListItem[] | null;
  activeCompanyId?: string | null;
  lang: InvoiceTableLang;
}): InvoiceListCompanyDisplay {
  const activeCompany = input.companies?.find((company) => company.id === input.activeCompanyId);
  return {
    companyName: pickInvoiceTableName(input.lang, activeCompany, ''),
    logoUrl: activeCompany?.logoUrl || '',
  };
}

export function filterInvoiceSupplierCategories<TCategory extends InvoiceListCategorySource>(
  categories?: TCategory[] | null,
) {
  return (categories ?? []).filter((category) => {
    const type = String(category.type || '').toLowerCase();
    return type === 'purchase' || type === 'expense';
  });
}

export function normalizeInvoiceCreatorFilterOptions(
  input?: InvoiceListCreatorFilterOptionsResponse | null,
): InvoiceListCreatorFilterOptions {
  return {
    users: (input?.users ?? []).filter(isInvoiceListCreatorUser),
  };
}

function isInvoiceListCreatorUser(value: unknown): value is InvoiceListCreatorUser {
  return Boolean(value && typeof value === 'object');
}

export function getInvoiceListCreatedByDisplayName(
  user: InvoiceListCreatorUser | null | undefined,
  lang: InvoiceTableLang,
) {
  if (!user) return '';
  const ar = user.nameAr || user.name || '';
  const en = user.nameEn || user.name || '';
  const selected = lang === 'en' ? en || ar : ar || en;
  return selected || user.email || '';
}

export function getInvoiceListSupplierName(input: {
  invoice: InvoiceListRawInvoice;
  lang: InvoiceTableLang;
  t: Translate;
}) {
  if (input.invoice.kind === 'sale') return input.t('categoryTypeSale') || 'Sales';
  return pickInvoiceTableName(input.lang, input.invoice.supplier, '');
}

export function mapInvoiceToListTableRow(input: {
  invoice: InvoiceListRawInvoice;
  lang: InvoiceTableLang;
  t: Translate;
}): InvoiceListTableRow {
  const { invoice, lang, t } = input;
  return {
    ...invoice,
    supplierName: getInvoiceListSupplierName({ invoice, lang, t }),
    createdByDisplayName: getInvoiceListCreatedByDisplayName(invoice.createdByUser, lang),
    notesOrEmployee: invoice.notes || '',
  };
}

export function mapInvoicesToListTableRows(input: {
  invoices?: InvoiceListRawInvoice[] | null;
  lang: InvoiceTableLang;
  t: Translate;
}) {
  return (input.invoices ?? []).map((invoice) =>
    mapInvoiceToListTableRow({ invoice, lang: input.lang, t: input.t }),
  );
}

export function toInvoiceListViewSource(row: InvoiceTableRow | null): InvoiceViewSource | null {
  if (!row?.id) return null;
  return row as InvoiceViewSource;
}

export function resolveInvoiceListVaultRowLabel(input: {
  row: InvoiceListVaultFlowLabelRow;
  lang: InvoiceTableLang;
  unassignedLabel: string;
}) {
  if (input.row.unassigned) return input.unassignedLabel;
  return pickInvoiceTableName(input.lang, input.row, '');
}

export function buildInvoiceImportSuccessMessage(count: number) {
  return `تم استيراد ${count} فاتورة بنجاح`;
}

export function getInvoiceListErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
