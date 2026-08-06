import { BadRequestException } from '@nestjs/common';
import { isPurchaseBatchLineValid } from '@noorix/finance-core';
import type { CreateInvoiceBatchDto } from './dto/create-invoice-batch.dto';

export function filterValidInvoiceBatchLineItems(
  items: CreateInvoiceBatchDto['items'],
  batchNotesPart: string,
): CreateInvoiceBatchDto['items'] {
  return items.filter((item) => isPurchaseBatchLineValid(item, batchNotesPart));
}

export function requireAllInvoiceBatchLineItemsValid(
  items: CreateInvoiceBatchDto['items'],
  batchNotesPart: string,
): CreateInvoiceBatchDto['items'] {
  const validItems = filterValidInvoiceBatchLineItems(items, batchNotesPart);
  if (validItems.length === 0) {
    throw new BadRequestException('لا توجد فواتير صالحة للحفظ.');
  }
  if (validItems.length !== items.length) {
    throw new BadRequestException(
      'تحتوي الدفعة على صفوف غير مكتملة. لم يتم حفظ أي صف؛ أكمل البيانات المطلوبة ثم أعد المحاولة.',
    );
  }
  return validItems;
}
