import { BadRequestException } from '@nestjs/common';
import type {
  OrdersV4CancellationReason,
  OrdersV4DocumentInput,
  OrdersV4RegistrationEntryType,
} from './orders-v4.contracts';

export const ORDERS_V4_CANCELLATION_REASONS = [
  'customer_disliked',
  'replaced_item',
  'order_error',
  'registration_error',
  'delayed_order',
  'duplicate_order',
  'customer_changed_mind',
  'item_unavailable',
  'employee_meal',
  'hospitality',
  'other',
] as const satisfies readonly OrdersV4CancellationReason[];

export function resolveOrdersV4RegistrationEntry(input: OrdersV4DocumentInput): {
  entryType: OrdersV4RegistrationEntryType | null;
} {
  if (input.documentType !== 'registration') {
    if (input.registrationEntryType || input.lines.some((line) => line.cancellationReasons?.length || line.cancellationNote?.trim())) {
      throw new BadRequestException('بيانات الإلغاء متاحة للتسجيل الداخلي فقط');
    }
    return { entryType: null };
  }

  const entryType = input.registrationEntryType ?? 'issue';
  if (!['issue', 'cancellation'].includes(entryType)) {
    throw new BadRequestException('نوع التسجيل الداخلي غير صالح');
  }
  if (entryType === 'issue') {
    if (input.lines.some((line) => line.cancellationReasons?.length || line.cancellationNote?.trim())) {
      throw new BadRequestException('سبب الإلغاء لا يقبل مع التسجيل الداخلي العادي');
    }
    return { entryType };
  }

  for (const [index, line] of input.lines.entries()) {
    const cancellationReasons = [...new Set(line.cancellationReasons ?? [])];
    if (!cancellationReasons.length || cancellationReasons.some((reason) => !ORDERS_V4_CANCELLATION_REASONS.includes(reason))) {
      throw new BadRequestException(`يجب اختيار سبب إلغاء معتمد للصنف رقم ${index + 1}`);
    }
    if (cancellationReasons.includes('other') && !line.cancellationNote?.trim()) {
      throw new BadRequestException(`اكتب توضيح سبب الإلغاء للصنف رقم ${index + 1}`);
    }
  }
  return { entryType };
}
