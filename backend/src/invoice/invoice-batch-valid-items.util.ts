import { isPurchaseBatchLineValid } from '@noorix/finance-core';
import type { CreateInvoiceBatchDto } from './dto/create-invoice-batch.dto';

/** صفوف الدفعة الصالحة للحفظ — نفس شروط `createBatchWithLedger`. */
export function filterValidInvoiceBatchLineItems(
  items: CreateInvoiceBatchDto['items'],
  batchNotesPart: string,
): CreateInvoiceBatchDto['items'] {
  return items.filter((i) => isPurchaseBatchLineValid(i, batchNotesPart));
}
