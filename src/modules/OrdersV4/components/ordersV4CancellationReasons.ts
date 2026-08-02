import type { OrdersV4CancellationReason } from '../../../types/api';

export const ORDERS_V4_CANCELLATION_REASON_OPTIONS: Array<{
  value: OrdersV4CancellationReason;
  label: string;
}> = [
  { value: 'customer_disliked', label: 'لم يعجب العميل' },
  { value: 'replaced_item', label: 'استُبدل بصنف آخر' },
  { value: 'order_error', label: 'خطأ في الطلب' },
  { value: 'registration_error', label: 'خطأ في التسجيل' },
  { value: 'delayed_order', label: 'تأخر الطلب' },
  { value: 'duplicate_order', label: 'طلب مكرر' },
  { value: 'customer_changed_mind', label: 'العميل غيّر رأيه' },
  { value: 'item_unavailable', label: 'الصنف غير متوفر' },
  { value: 'other', label: 'أخرى' },
];

export function ordersV4CancellationReasonLabel(reason: OrdersV4CancellationReason): string {
  return ORDERS_V4_CANCELLATION_REASON_OPTIONS.find((option) => option.value === reason)?.label ?? reason;
}
