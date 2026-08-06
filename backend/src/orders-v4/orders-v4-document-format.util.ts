import type { OrdersV4DocumentInput, OrdersV4DocumentType } from './orders-v4.contracts';
import type { OrdersV4ResolvedConversion } from './orders-v4-kernel.types';
import { randomUUID } from 'node:crypto';
import { ordersV4RequestHash } from './orders-v4-operation-idempotency.util';

export function ordersV4ConversionSnapshot(resolved: OrdersV4ResolvedConversion) {
  return {
    fromUnitId: resolved.fromUnitId,
    toUnitId: resolved.toUnitId,
    factor: resolved.factor.toString(),
    source: resolved.source,
    path: resolved.path,
  };
}

export function ordersV4DocumentNumber(
  documentType: OrdersV4DocumentType,
  date: Date,
  registrationEntryType?: 'issue' | 'cancellation' | null,
): string {
  const datePart = date.toISOString().slice(0, 10).replaceAll('-', '');
  const prefix = documentType === 'purchase' ? 'REQ4' : registrationEntryType === 'cancellation' ? 'CAN4' : 'REG4';
  return `${prefix}-${datePart}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

export function ordersV4DocumentRequestHash(input: OrdersV4DocumentInput): string {
  const payload = {
    documentType: input.documentType,
    registrationEntryType: input.registrationEntryType ?? (input.documentType === 'registration' ? 'issue' : null),
    documentDate: input.documentDate,
    paymentMethod: input.paymentMethod ?? null,
    sectionId: input.sectionId ?? null,
    locationId: input.locationId,
    pettyCashAmount: input.pettyCashAmount ?? null,
    notes: input.notes?.trim() || null,
    lines: input.lines.map((line) => ({
      itemId: line.itemId,
      quantity: String(line.quantity),
      unitId: line.unitId,
      unitPrice: String(line.unitPrice ?? 0),
      priceUnitId: line.priceUnitId || line.unitId,
      cancellationReasons: line.cancellationReasons ?? null,
      cancellationNote: line.cancellationNote?.trim() || null,
    })),
  };
  return ordersV4RequestHash(payload);
}
