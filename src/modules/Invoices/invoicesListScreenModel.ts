import type { CompanyListItem } from '../../context/appTypes';
import type { InvoiceListItem } from '../../services/domains/apiEndpoints/invoice-list-response';
import type { InvoiceExecutiveVaultFlowRow } from './invoiceExecutiveCardsModel';
import type { InvoiceViewSource } from './invoiceViewModel';
import {
  pickInvoiceTableName,
  type InvoiceTableLang,
  type InvoiceTableNamedEntity,
  type InvoiceTableRow,
} from './invoiceTableRowModel';
import { displayNameFromEmail } from '../../utils/compactDisplay';

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
  id?: string | null;
  name?: string | null;
  nameAr?: string | null;
  nameEn?: string | null;
  type?: string | null;
  [key: string]: unknown;
};

export type InvoiceListRawInvoice = InvoiceListItem & InvoiceTableRow & {
  notesOrEmployee?: string | null;
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

export function filterInvoiceSupplierCategories(categories?: unknown[] | null): InvoiceListCategorySource[] {
  return (categories ?? []).filter((category) => {
    const type = String(readRecordField(category, 'type') || '').toLowerCase();
    return type === 'purchase' || type === 'expense';
  }).filter(isInvoiceListCategorySource);
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

function isInvoiceListCategorySource(value: unknown): value is InvoiceListCategorySource {
  return Boolean(value && typeof value === 'object');
}

export function isInvoiceListRawInvoice(value: unknown): value is InvoiceListRawInvoice {
  return Boolean(value && typeof value === 'object');
}

export function getInvoiceListCreatedByDisplayName(
  user: InvoiceListCreatorUser | null | undefined,
  lang: InvoiceTableLang,
) {
  if (!user) return '';
  return pickInvoiceTableName(lang, user, '') || displayNameFromEmail(user.email);
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

export function filterVisibleInvoiceListItems(input: {
  invoices?: InvoiceListRawInvoice[] | null;
  showCancelled: boolean;
}) {
  return (input.invoices ?? []).filter((invoice) => input.showCancelled || invoice.status !== 'cancelled');
}

export function toInvoiceListViewSource(row: InvoiceListRawInvoice | InvoiceTableRow | null): InvoiceViewSource | null {
  if (!row?.id) return null;
  return {
    id: row.id,
    categoryId: readStringField(row, 'categoryId') ?? null,
    invoiceNumber: row.invoiceNumber,
    supplierInvoiceNumber: row.supplierInvoiceNumber,
    transactionDate: row.transactionDate,
    kind: row.kind,
    status: row.status,
    supplier: readNamedEntity(row, 'supplier'),
    vault: row.vault,
    vaultAllocations: row.vaultAllocations,
    netAmount: row.netAmount,
    taxAmount: row.taxAmount,
    totalAmount: row.totalAmount,
    notes: row.notes,
    hasInvoiceAttachment: readBooleanField(row, 'hasInvoiceAttachment'),
    attachmentOriginalName: readStringField(row, 'attachmentOriginalName'),
  };
}

export function resolveInvoiceListVaultRowLabel(input: {
  row: InvoiceExecutiveVaultFlowRow | InvoiceListVaultFlowLabelRow;
  lang: InvoiceTableLang;
  unassignedLabel: string;
}) {
  if (readBooleanField(input.row, 'unassigned')) return input.unassignedLabel;
  return pickInvoiceTableName(input.lang, readNamedEntity(input.row), '');
}

export function buildInvoiceImportSuccessMessage(count: number) {
  return `تم استيراد ${count} فاتورة بنجاح`;
}

export function getInvoiceListErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function readRecordField(value: unknown, key: string) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined;
}

function readNamedEntity(value: unknown, key?: string): InvoiceTableNamedEntity | null {
  const source = key ? readRecordField(value, key) : value;
  if (!source || typeof source !== 'object') return null;
  return {
    name: readStringField(source, 'name'),
    nameAr: readStringField(source, 'nameAr'),
    nameEn: readStringField(source, 'nameEn'),
    type: readStringField(source, 'type'),
  };
}

function readStringField(value: unknown, key: string): string | undefined {
  const field = readRecordField(value, key);
  return field == null || field === '' ? undefined : String(field);
}

function readBooleanField(value: unknown, key: string): boolean | undefined {
  const field = readRecordField(value, key);
  return typeof field === 'boolean' ? field : undefined;
}
