import { BadRequestException } from '@nestjs/common';
import type { StaffCancellationReason, StaffOrderItemInput } from './orders-staff.types';

export const STAFF_CANCELLATION_REASONS: readonly StaffCancellationReason[] = [
  'customer_disliked',
  'replaced_item',
  'order_error',
  'registration_error',
  'delayed_order',
  'duplicate_order',
  'customer_changed_mind',
  'item_unavailable',
  'other',
];

const cancellationReasonSet = new Set<string>(STAFF_CANCELLATION_REASONS);

export function normalizeCancellationReasons(
  item: StaffOrderItemInput,
  isCancellation: boolean,
): StaffCancellationReason[] | null {
  if (!isCancellation) return null;
  const reasons = [...new Set(
    (Array.isArray(item.cancellationReasons) ? item.cancellationReasons : [])
      .map((reason) => String(reason).trim())
      .filter((reason): reason is StaffCancellationReason => cancellationReasonSet.has(reason)),
  )];
  if (reasons.length === 0) {
    throw new BadRequestException('يجب اختيار سبب واحد على الأقل لكل صنف ملغى.');
  }
  if (reasons.includes('other') && !item.notes?.trim()) {
    throw new BadRequestException('اكتب ملاحظة مختصرة عند اختيار سبب «أخرى».');
  }
  return reasons;
}

export function staffCancellationVariantKey(item: {
  productId: string;
  size?: string | null;
  packaging?: string | null;
  unit?: string | null;
}): string {
  return [
    item.productId,
    String(item.size ?? '').trim(),
    String(item.packaging ?? '').trim(),
    String(item.unit ?? 'piece').trim() || 'piece',
  ].join('|');
}
