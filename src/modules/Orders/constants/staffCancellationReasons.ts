import type { StaffCancellationReason } from '../../../types/api';

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

export const STAFF_CANCELLATION_REASON_LABEL_KEYS: Record<StaffCancellationReason, string> = {
  customer_disliked: 'staffCancellationReasonCustomerDisliked',
  replaced_item: 'staffCancellationReasonReplacedItem',
  order_error: 'staffCancellationReasonOrderError',
  registration_error: 'staffCancellationReasonRegistrationError',
  delayed_order: 'staffCancellationReasonDelayedOrder',
  duplicate_order: 'staffCancellationReasonDuplicateOrder',
  customer_changed_mind: 'staffCancellationReasonCustomerChangedMind',
  item_unavailable: 'staffCancellationReasonItemUnavailable',
  other: 'staffCancellationReasonOther',
};
