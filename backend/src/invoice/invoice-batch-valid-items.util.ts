import type { CreateInvoiceBatchDto } from './dto/create-invoice-batch.dto';

/** صفوف الدفعة الصالحة للحفظ — نفس شروط `createBatchWithLedger`. */
export function filterValidInvoiceBatchLineItems(
  items: CreateInvoiceBatchDto['items'],
  batchNotesPart: string,
): CreateInvoiceBatchDto['items'] {
  return items.filter((i) => {
    if (Number(i.totalAmount) <= 0) return false;
    const hasSupplierRef = !!(i.supplierId || i.expenseLineId);
    const hasSupplierNumber = !!(i.supplierInvoiceNumber?.trim() || i.invoiceNumber?.trim());
    const isTaxable = i.isTaxable !== false;
    if (hasSupplierRef && isTaxable && !hasSupplierNumber) return false;
    if (i.supplierId) return true;
    if (i.expenseLineId) return true;
    if ((i.kind === 'fixed_expense' || i.kind === 'expense') && (i.notes?.trim() || batchNotesPart)) return true;
    return false;
  });
}
