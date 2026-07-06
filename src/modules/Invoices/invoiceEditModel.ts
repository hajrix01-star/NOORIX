import { splitTaxFromTotalAsNumbers } from '@noorix/finance-core';
import { toDateInputYmd } from '../../utils/saudiDate';

export type InvoiceEditForm = {
  supplierId: string;
  supplierInvoiceNumber: string;
  kind: string;
  totalAmount: string;
  isTaxable: boolean;
  netAmount: string;
  taxAmount: string;
  transactionDate: string;
  notes: string;
  vaultId: string;
};

export const EMPTY_INVOICE_EDIT_FORM: InvoiceEditForm = {
  supplierId: '',
  supplierInvoiceNumber: '',
  kind: 'purchase',
  totalAmount: '',
  isTaxable: true,
  netAmount: '',
  taxAmount: '',
  transactionDate: '',
  notes: '',
  vaultId: '',
};

const NO_SUPPLIER_KINDS = new Set(['salary', 'advance']);
const OPTIONAL_SUPPLIER_KINDS = new Set(['fixed_expense', 'hr_expense']);

export function getInvoiceEditSupplierPolicy(kind: unknown) {
  const invoiceKind = String(kind || '');
  const hasSupplier = !NO_SUPPLIER_KINDS.has(invoiceKind);
  return {
    hasSupplier,
    supplierRequired: hasSupplier && !OPTIONAL_SUPPLIER_KINDS.has(invoiceKind),
  };
}

export function resolveInvoiceEditInitialVaultId(invoice: any): string {
  if (!invoice) return '';
  const allocs = invoice.vaultAllocations;
  if (allocs?.length >= 1) return allocs[0].vaultId || '';
  return invoice.vaultId || '';
}

export function buildInvoiceEditInitialForm(invoice: any, vatRateDecimal: number): InvoiceEditForm {
  if (!invoice) return EMPTY_INVOICE_EDIT_FORM;
  const taxable =
    invoice.isTaxable !== undefined
      ? invoice.isTaxable !== false
      : Number(invoice.taxAmount || 0) > 0;
  const total = Number(invoice.totalAmount || 0);
  const { net, tax } = splitTaxFromTotalAsNumbers(total, taxable, vatRateDecimal);

  return {
    supplierId: invoice.supplierId || '',
    supplierInvoiceNumber: invoice.supplierInvoiceNumber || invoice.invoiceNumber || '',
    kind: invoice.kind || 'purchase',
    totalAmount: total > 0 ? String(total) : '',
    isTaxable: taxable,
    netAmount: net > 0 ? net.toFixed(2) : '',
    taxAmount: tax > 0 ? tax.toFixed(2) : '',
    transactionDate: toDateInputYmd(invoice.transactionDate),
    notes: invoice.notes || '',
    vaultId: resolveInvoiceEditInitialVaultId(invoice),
  };
}

export function updateInvoiceEditFormField(
  form: InvoiceEditForm,
  field: keyof InvoiceEditForm,
  value: unknown,
  vatRateDecimal: number,
): InvoiceEditForm {
  const next = { ...form, [field]: value } as InvoiceEditForm;
  if (field !== 'totalAmount' && field !== 'isTaxable') return next;

  const total = Number.parseFloat(String(next.totalAmount || ''));
  if (!Number.isNaN(total) && total > 0) {
    const { net, tax } = splitTaxFromTotalAsNumbers(total, next.isTaxable !== false, vatRateDecimal);
    return {
      ...next,
      netAmount: net.toFixed(2),
      taxAmount: tax.toFixed(2),
    };
  }

  return {
    ...next,
    netAmount: '',
    taxAmount: '',
  };
}

export function validateInvoiceEditForm(input: {
  form: InvoiceEditForm;
  supplierRequired: boolean;
  hasVaults: boolean;
  messages: {
    invoiceNumberRequired: string;
    totalMustBePositiveShort: string;
    selectVault: string;
  };
}): string {
  const total = Number.parseFloat(input.form.totalAmount);
  if (input.supplierRequired && !input.form.supplierInvoiceNumber?.trim()) {
    return input.messages.invoiceNumberRequired;
  }
  if (Number.isNaN(total) || total <= 0) {
    return input.messages.totalMustBePositiveShort;
  }
  if (input.hasVaults && !String(input.form.vaultId || '').trim()) {
    return input.messages.selectVault;
  }
  return '';
}

export function buildInvoiceEditUpdateBody(input: {
  form: InvoiceEditForm;
  hasSupplier: boolean;
  supplierRequired: boolean;
  isMultiVault: boolean;
  initialVaultKey: string;
}) {
  const total = Number.parseFloat(input.form.totalAmount);
  const body: Record<string, any> = {
    totalAmount: total,
    transactionDate: input.form.transactionDate || undefined,
    notes: input.form.notes?.trim() || undefined,
  };

  if (input.hasSupplier) {
    body.supplierId = input.form.supplierId || undefined;
    if (input.form.supplierInvoiceNumber?.trim()) {
      body.supplierInvoiceNumber = input.form.supplierInvoiceNumber.trim();
    }
    body.isTaxable = input.form.isTaxable !== false;
    if (input.supplierRequired) body.kind = input.form.kind;
  } else {
    body.isTaxable = false;
  }

  if (input.form.vaultId && (input.isMultiVault || input.form.vaultId !== input.initialVaultKey)) {
    body.vaultId = input.form.vaultId;
  }

  return body;
}

export function hasPositiveInvoiceEditTotal(totalAmount: string): boolean {
  const total = Number.parseFloat(totalAmount);
  return !Number.isNaN(total) && total > 0;
}
