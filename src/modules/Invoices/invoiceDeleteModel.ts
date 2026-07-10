type Translate = (key: string, ...args: unknown[]) => string;

type InvoiceDeleteSource = {
  id?: string | null;
  invoiceNumber?: string | number | null;
};

export function buildInvoiceDeleteConfirmationMessage(t: Translate, invoice: InvoiceDeleteSource) {
  return t('deleteInvoiceConfirm', invoice.invoiceNumber || '');
}

export function canDeleteInvoiceRow<TInvoice extends InvoiceDeleteSource>(invoice: TInvoice): invoice is TInvoice & { id: string } {
  return Boolean(invoice.id);
}
