import type { OrdersV4CancellationReason } from '../../../types/api';
import type { TranslationKey } from '../../../i18n/translations';

export const ORDERS_V4_CANCELLATION_REASON_OPTIONS: Array<{
  value: OrdersV4CancellationReason;
  translationKey: TranslationKey;
}> = [
  { value: 'customer_disliked', translationKey: 'staffCancellationReasonCustomerDisliked' },
  { value: 'replaced_item', translationKey: 'staffCancellationReasonReplacedItem' },
  { value: 'order_error', translationKey: 'staffCancellationReasonOrderError' },
  { value: 'registration_error', translationKey: 'staffCancellationReasonRegistrationError' },
  { value: 'delayed_order', translationKey: 'staffCancellationReasonDelayedOrder' },
  { value: 'duplicate_order', translationKey: 'staffCancellationReasonDuplicateOrder' },
  { value: 'customer_changed_mind', translationKey: 'staffCancellationReasonCustomerChangedMind' },
  { value: 'item_unavailable', translationKey: 'staffCancellationReasonItemUnavailable' },
  { value: 'employee_meal', translationKey: 'staffCancellationReasonEmployeeMeal' },
  { value: 'hospitality', translationKey: 'staffCancellationReasonHospitality' },
  { value: 'other', translationKey: 'staffCancellationReasonOther' },
];

export function ordersV4CancellationReasonLabel(
  reason: OrdersV4CancellationReason,
  translate: (key: TranslationKey | string) => string,
): string {
  const option = ORDERS_V4_CANCELLATION_REASON_OPTIONS.find((candidate) => candidate.value === reason);
  return option ? translate(option.translationKey) : reason;
}
