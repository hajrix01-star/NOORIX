import { formatSaudiDate } from '../../utils/saudiDate';
import { localizedDisplayName } from '../../utils/vaultDisplay';
import { hasInvoiceNumericValue, toInvoiceFiniteNumber } from './invoiceNumberModel';

const EMPTY_INVOICE_VIEW_VALUE = '\u2014';

export type InvoiceViewLang = 'ar' | 'en' | string;
export type InvoiceViewTone = 'green' | 'amber' | 'blue' | 'neutral';

export type InvoiceViewNamedEntity = {
  name?: string | null;
  nameAr?: string | null;
  nameEn?: string | null;
};

export type InvoiceViewVaultAllocation = {
  id?: string | null;
  amount?: number | string | null;
  vault?: InvoiceViewNamedEntity | null;
};

export type InvoiceViewSource = {
  id: string;
  invoiceNumber?: string | number | null;
  supplierInvoiceNumber?: string | number | null;
  transactionDate?: string | Date | null;
  kind?: string | null;
  status?: string | null;
  supplier?: InvoiceViewNamedEntity | null;
  vault?: InvoiceViewNamedEntity | null;
  vaultAllocations?: InvoiceViewVaultAllocation[] | null;
  netAmount?: number | string | null;
  taxAmount?: number | string | null;
  totalAmount?: number | string | null;
  notes?: string | null;
  hasInvoiceAttachment?: boolean | null;
  attachmentOriginalName?: string | null;
};

export type InvoiceViewField = {
  label: string;
  value: string;
  tone: InvoiceViewTone;
  bold: boolean;
};

export type InvoiceViewVaultSplit = {
  key: string;
  vaultName: string;
  amount: number;
};

export type InvoiceViewLabels = {
  invoiceNumber: string;
  date: string;
  type: string;
  status: string;
  supplier: string;
  invoiceVaultColumn: string;
  net: string;
  tax: string;
  total: string;
  invoiceVaultMultiple: string;
  invoiceKindHrExpense: string;
  invoiceKindUnknown: string;
  kindExpense: string;
  kindPurchase: string;
  kindSale: string;
  statusActive: string;
  statusCancelled: string;
};

export function getInvoiceViewEmptyValue() {
  return EMPTY_INVOICE_VIEW_VALUE;
}

export function pickInvoiceViewName(
  lang: InvoiceViewLang,
  entity?: InvoiceViewNamedEntity | null,
  fallback = EMPTY_INVOICE_VIEW_VALUE,
) {
  return localizedDisplayName(entity, lang, fallback);
}

export function formatInvoiceViewDate(value?: string | Date | null) {
  return value ? formatSaudiDate(value) : EMPTY_INVOICE_VIEW_VALUE;
}

export function formatInvoiceViewMoney(value: unknown, fmt: (value: number) => string) {
  return hasInvoiceNumericValue(value) ? `${fmt(toInvoiceFiniteNumber(value))} SR` : EMPTY_INVOICE_VIEW_VALUE;
}

export function formatInvoiceViewKind(kind: string | null | undefined, labels: InvoiceViewLabels) {
  const normalizedKind = String(kind || '').trim().toLowerCase();
  if (normalizedKind === 'sale') return labels.kindSale;
  if (normalizedKind === 'purchase') return labels.kindPurchase;
  if (normalizedKind === 'expense' || normalizedKind === 'fixed_expense') return labels.kindExpense;
  if (normalizedKind === 'hr_expense' || normalizedKind === 'residency') return labels.invoiceKindHrExpense;
  return String(kind || '').trim() || labels.invoiceKindUnknown || EMPTY_INVOICE_VIEW_VALUE;
}

export function formatInvoiceViewStatus(status: string | null | undefined, labels: InvoiceViewLabels) {
  const normalizedStatus = String(status || '').trim().toLowerCase();
  if (normalizedStatus === 'active') return labels.statusActive;
  if (normalizedStatus === 'cancelled' || normalizedStatus === 'canceled') return labels.statusCancelled;
  return String(status || '').trim() || EMPTY_INVOICE_VIEW_VALUE;
}

export function getInvoiceViewDocumentNumber(invoice: InvoiceViewSource) {
  return String(invoice.supplierInvoiceNumber || invoice.invoiceNumber || EMPTY_INVOICE_VIEW_VALUE);
}

export function getInvoiceViewVaultSummary(input: {
  invoice: InvoiceViewSource;
  lang: InvoiceViewLang;
  multipleLabel: string;
}) {
  const allocations = input.invoice.vaultAllocations ?? [];
  if (allocations.length > 1) return input.multipleLabel;
  if (allocations.length === 1) return pickInvoiceViewName(input.lang, allocations[0]?.vault);
  return pickInvoiceViewName(input.lang, input.invoice.vault);
}

export function buildInvoiceViewFields(input: {
  invoice: InvoiceViewSource;
  labels: InvoiceViewLabels;
  lang: InvoiceViewLang;
  fmt: (value: number) => string;
}) {
  const { invoice, labels, lang, fmt } = input;
  return [
    {
      label: labels.invoiceNumber,
      value: getInvoiceViewDocumentNumber(invoice),
      tone: 'neutral',
      bold: false,
    },
    {
      label: labels.date,
      value: formatInvoiceViewDate(invoice.transactionDate),
      tone: 'neutral',
      bold: false,
    },
    {
      label: labels.type,
      value: formatInvoiceViewKind(invoice.kind, labels),
      tone: 'neutral',
      bold: false,
    },
    {
      label: labels.status,
      value: formatInvoiceViewStatus(invoice.status, labels),
      tone: 'neutral',
      bold: false,
    },
    {
      label: labels.supplier,
      value: pickInvoiceViewName(lang, invoice.supplier),
      tone: 'neutral',
      bold: false,
    },
    {
      label: labels.invoiceVaultColumn,
      value: getInvoiceViewVaultSummary({ invoice, lang, multipleLabel: labels.invoiceVaultMultiple }),
      tone: 'neutral',
      bold: false,
    },
    {
      label: labels.net,
      value: formatInvoiceViewMoney(invoice.netAmount, fmt),
      tone: 'green',
      bold: false,
    },
    {
      label: labels.tax,
      value: formatInvoiceViewMoney(invoice.taxAmount, fmt),
      tone: 'amber',
      bold: false,
    },
    {
      label: labels.total,
      value: formatInvoiceViewMoney(invoice.totalAmount, fmt),
      tone: 'blue',
      bold: true,
    },
  ] satisfies InvoiceViewField[];
}

export function getInvoiceViewVaultSplits(
  invoice: Pick<InvoiceViewSource, 'vaultAllocations'>,
  lang: InvoiceViewLang,
) {
  return (invoice.vaultAllocations ?? []).map<InvoiceViewVaultSplit>((allocation, index) => ({
    key: allocation.id || `vault-allocation-${index}`,
    vaultName: pickInvoiceViewName(lang, allocation.vault),
    amount: toInvoiceFiniteNumber(allocation.amount),
  }));
}

export function hasInvoiceViewMultipleVaultSplits(invoice: InvoiceViewSource) {
  return (invoice.vaultAllocations?.length ?? 0) > 1;
}

export function getInvoiceViewAttachmentName(invoice: InvoiceViewSource) {
  return invoice.attachmentOriginalName || EMPTY_INVOICE_VIEW_VALUE;
}

export function shouldShowInvoiceViewAttachment(invoice: InvoiceViewSource, companyId?: string) {
  return Boolean(invoice.hasInvoiceAttachment && companyId);
}
