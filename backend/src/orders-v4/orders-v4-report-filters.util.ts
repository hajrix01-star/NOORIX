import type {
  OrdersV4CancellationReason,
  OrdersV4PaymentMethod,
  OrdersV4RegistrationEntryType,
  OrdersV4ReportFilters,
} from './orders-v4.contracts';
import type { OrdersV4ActivityReportQueryDto } from './orders-v4.dto';

const PAYMENT_METHODS = new Set<OrdersV4PaymentMethod>(['custody', 'cash', 'transfer']);
const STATUSES = new Set<NonNullable<OrdersV4ReportFilters['statuses']>[number]>(['prepared', 'received', 'cancelled', 'reversed']);
const ENTRY_TYPES = new Set<OrdersV4RegistrationEntryType>(['issue', 'cancellation']);
const CANCELLATION_REASONS = new Set<OrdersV4CancellationReason>([
  'customer_disliked', 'replaced_item', 'order_error', 'registration_error', 'delayed_order',
  'duplicate_order', 'customer_changed_mind', 'item_unavailable', 'other',
]);

export function ordersV4CsvValues(value?: string): string[] {
  return [...new Set(String(value ?? '').split(',').map((entry) => entry.trim()).filter(Boolean))];
}

function allowed<T extends string>(value: string | undefined, accepted: Set<T>): T[] {
  return ordersV4CsvValues(value).filter((entry): entry is T => accepted.has(entry as T));
}

export function ordersV4ReportFiltersFromQuery(query?: OrdersV4ActivityReportQueryDto): OrdersV4ReportFilters {
  return {
    sectionIds: ordersV4CsvValues(query?.sectionIds),
    categoryIds: ordersV4CsvValues(query?.categoryIds),
    itemIds: ordersV4CsvValues(query?.itemIds),
    baseUnitIds: ordersV4CsvValues(query?.baseUnitIds),
    inputUnitIds: ordersV4CsvValues(query?.inputUnitIds),
    paymentMethods: allowed(query?.paymentMethods, PAYMENT_METHODS),
    statuses: allowed(query?.statuses, STATUSES),
    registrationEntryTypes: allowed(query?.registrationEntryTypes, ENTRY_TYPES),
    cancellationReasons: allowed(query?.cancellationReasons, CANCELLATION_REASONS),
    createdByUserIds: ordersV4CsvValues(query?.createdByUserIds),
    search: query?.search?.trim() || undefined,
  };
}

export function ordersV4NormalizedSearch(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim()
    .toLocaleLowerCase('ar');
}
