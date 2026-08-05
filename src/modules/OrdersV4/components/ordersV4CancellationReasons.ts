import type { OrdersV4CancellationReason } from '../../../types/api';
import type { TranslationKey } from '../../../i18n/translations';

export const ORDERS_V4_CANCELLATION_REASON_OPTIONS: Array<{
  value: OrdersV4CancellationReason;
  translationKey: TranslationKey;
}> = [
  { value: 'customer_cancellation', translationKey: 'staffCancellationReasonCustomerCancellation' },
  { value: 'operational_reason', translationKey: 'staffCancellationReasonOperational' },
  { value: 'replaced_item', translationKey: 'staffCancellationReasonReplacedItem' },
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
