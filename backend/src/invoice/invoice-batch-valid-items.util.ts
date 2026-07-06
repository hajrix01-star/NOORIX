import { isPurchaseBatchLineValid } from '@noorix/finance-core';
import type { CreateInvoiceBatchDto } from './dto/create-invoice-batch.dto';

export function filterValidInvoiceBatchLineItems(
  items: CreateInvoiceBatchDto['items'],
  batchNotesPart: string,
): CreateInvoiceBatchDto['items'] {
  return items.filter((item) => isPurchaseBatchLineValid(item, batchNotesPart));
}
