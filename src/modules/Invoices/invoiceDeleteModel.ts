import type { InvoiceTableRow } from './invoiceTableRowModel';

type Translate = (key: string, ...args: unknown[]) => string;

export function buildInvoiceDeleteConfirmationMessage(t: Translate, invoice: InvoiceTableRow) {
  return t('deleteInvoiceConfirm', invoice.invoiceNumber || '');
}

export function canDeleteInvoiceRow(invoice: InvoiceTableRow): invoice is InvoiceTableRow & { id: string } {
  return Boolean(invoice.id);
}
