import Decimal from 'decimal.js';
import {
  type StaffBasketLine,
  staffBasketLineKey,
  staffOrdersQty,
  staffOrdersTotal,
} from './staffOrderBasketUtils';
import { resolveItemSection } from '../StaffOrdersViewParts';
import type {
  DisplayLanguage,
  OrderProduct,
  StaffOrder,
  StaffOrderEntryType,
  StaffOrderPayload,
} from '../../../types/api';

export const NEGATIVE_INVENTORY_CONFIRMATION_REQUIRED = 'NEGATIVE_INVENTORY_CONFIRMATION_REQUIRED';

export type StaffNegativeInventoryShortage = {
  productId: string;
  productNameAr: string;
  productNameEn: string | null;
  unit: string;
  availableQuantity: string;
  requestedQuantity: string;
  projectedQuantity: string;
};

export function staffNegativeInventoryConfirmation(error: unknown): {
  canOverride: true;
  shortages: StaffNegativeInventoryShortage[];
} | null {
  if (!error || typeof error !== 'object') return null;
  const apiError = error as { errorCode?: unknown; details?: unknown };
  if (apiError.errorCode !== NEGATIVE_INVENTORY_CONFIRMATION_REQUIRED) return null;
  if (!apiError.details || typeof apiError.details !== 'object') return null;
  const details = apiError.details as { canOverride?: unknown; shortages?: unknown };
  if (details.canOverride !== true || !Array.isArray(details.shortages)) return null;
  return {
    canOverride: true,
    shortages: details.shortages.filter(
      (row): row is StaffNegativeInventoryShortage => Boolean(row)
        && typeof row === 'object'
        && typeof (row as StaffNegativeInventoryShortage).productId === 'string'
        && typeof (row as StaffNegativeInventoryShortage).projectedQuantity === 'string',
    ),
  };
}

export function createDraftLineId(productId: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${productId}-${crypto.randomUUID()}`;
  }
  return `${productId}-${performance.now().toString(36)}`;
}

export function buildStaffOrderFrequencyMap(myOrders: StaffOrder[], productType: 'order' | 'sale'): Map<string, number> {
  const map = new Map<string, number>();
  for (const order of (myOrders ?? []).filter((o) => (o.orderType || 'order') === productType)) {
    for (const item of order.items || []) {
      if (item.productId) map.set(item.productId, (map.get(item.productId) ?? 0) + 1);
    }
  }
  return map;
}

export function buildProductsById(products: OrderProduct[]): Map<string, OrderProduct> {
  const map = new Map<string, OrderProduct>();
  (products ?? []).forEach((product) => map.set(product.id, product));
  return map;
}

export function filterStaffOrderProducts({
  allProducts,
  sectionFilter,
  search,
  freqMap,
  lang,
}: {
  allProducts: OrderProduct[];
  sectionFilter: string;
  search: string;
  freqMap: Map<string, number>;
  lang: string;
}): OrderProduct[] {
  let list = sectionFilter
    ? (allProducts ?? []).filter((product) => {
        const sections = product.sections;
        return Array.isArray(sections) && sections.length > 0 && sections.includes(sectionFilter);
      })
    : (allProducts ?? []);

  const q = search.trim().toLowerCase();
  if (q) {
    list = list.filter((product) =>
      (product.nameAr || '').toLowerCase().includes(q) || (product.nameEn || '').toLowerCase().includes(q),
    );
  }

  return [...list].sort((a, b) => {
    const fa = freqMap.get(a.id) ?? 0;
    const fb = freqMap.get(b.id) ?? 0;
    if (fb !== fa) return fb - fa;
    const na = (lang === 'en' ? (a.nameEn || a.nameAr) : (a.nameAr || a.nameEn)) || '';
    const nb = (lang === 'en' ? (b.nameEn || b.nameAr) : (b.nameAr || b.nameEn)) || '';
    return na.localeCompare(nb);
  });
}

export function buildStaffQtyMap(basketLines: StaffBasketLine[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const line of basketLines ?? []) {
    map.set(line.productId, (map.get(line.productId) ?? 0) + line.quantity);
  }
  return map;
}

export function filterStaffOrdersByType(myOrders: StaffOrder[], productType: 'order' | 'sale'): StaffOrder[] {
  return (myOrders ?? []).filter((order) => (order.orderType || 'order') === productType);
}

export function groupSentSaleOrders(sentOrders: StaffOrder[], isSale: boolean): StaffOrder[][] {
  if (!isSale) return [];
  const map = new Map<string, StaffOrder[]>();
  for (const order of sentOrders ?? []) {
    const key = order.logRef || order.id;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(order);
  }
  return [...map.values()].sort(
    (a, b) => new Date(b[0]?.createdAt || '').getTime() - new Date(a[0]?.createdAt || '').getTime(),
  );
}

function staffOrderDateValue(order: Pick<StaffOrder, 'createdAt' | 'saleDate'>): number {
  return new Date(order.createdAt || order.saleDate || '').getTime() || 0;
}

export function filterStaffSaleOrdersToRecentWeek(
  orders: StaffOrder[],
  today = new Date(),
): StaffOrder[] {
  const end = new Date(today);
  end.setHours(23, 59, 59, 999);

  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  start.setHours(0, 0, 0, 0);

  const startMs = start.getTime();
  const endMs = end.getTime();

  return (orders ?? []).filter((order) => {
    const value = new Date(order.saleDate || order.createdAt || '').getTime() || 0;
    return value >= startMs && value <= endMs;
  });
}

export function staffSaleOrderEditScopeKey(order: Pick<StaffOrder, 'id' | 'logRef'>): string {
  return order.logRef?.trim() || order.id;
}

export function latestEditableStaffSaleScope(sentOrders: StaffOrder[]): string | null {
  const latest = [...(sentOrders ?? [])]
    .filter((order) => (order.orderType || 'order') === 'sale')
    .sort((a, b) => staffOrderDateValue(b) - staffOrderDateValue(a))[0];
  return latest ? staffSaleOrderEditScopeKey(latest) : null;
}

export function canMutateStaffSaleOrder({
  order,
  latestScope,
  isPrivileged,
}: {
  order: StaffOrder;
  latestScope: string | null;
  isPrivileged: boolean;
}): boolean {
  if ((order.orderType || 'order') !== 'sale') return false;
  if (order.entryType === 'cancellation') return false;
  if (isPrivileged) return true;
  if (!latestScope) return true;
  return staffSaleOrderEditScopeKey(order) === latestScope;
}

export function summarizeSentSales({
  isSale,
  sentSaleGroups,
  sentOrders,
}: {
  isSale: boolean;
  sentSaleGroups: StaffOrder[][];
  sentOrders: StaffOrder[];
}): { totalQty: number; totalAmount: Decimal; avgPerOrder: Decimal; operationCount: number } {
  if (!isSale || sentSaleGroups.length === 0) {
    return { totalQty: 0, totalAmount: new Decimal(0), avgPerOrder: new Decimal(0), operationCount: 0 };
  }
  const totalAmount = staffOrdersTotal(sentOrders);
  const totalQty = staffOrdersQty(sentOrders);
  const operationCount = sentSaleGroups.length;
  return {
    totalQty,
    totalAmount,
    avgPerOrder: operationCount > 0 ? totalAmount.div(operationCount) : new Decimal(0),
    operationCount,
  };
}

export function mapStaffOrderToBasketLines(order: StaffOrder): StaffBasketLine[] {
  return (order.items || []).map((item, index) => ({
    lineId: `${item.productId}-${index}`,
    productId: item.productId,
    quantity: Number(item.quantity) || 1,
    unit: item.unit || 'piece',
    size: item.size || '',
    packaging: item.packaging || '',
    unitPrice: item.unitPrice != null ? String(item.unitPrice) : '0',
    sectionName: order.sectionName || undefined,
    cancellationReasons: item.cancellationReasons || undefined,
    cancellationNote: item.notes || undefined,
  }));
}

export function upsertPlainStaffBasketLine({
  currentLines,
  product,
  qty,
  unit,
  sectionFilter,
  lineId,
}: {
  currentLines: StaffBasketLine[];
  product: OrderProduct;
  qty: number;
  unit: string;
  sectionFilter: string;
  lineId: string;
}): StaffBasketLine[] {
  const sectionName = resolveItemSection(product, sectionFilter);
  const key = staffBasketLineKey({ productId: product.id, size: '', packaging: '', unit });
  const existingIndex = currentLines.findIndex((line) => staffBasketLineKey(line) === key);
  if (existingIndex >= 0) {
    const next = [...currentLines];
    next[existingIndex] = { ...next[existingIndex], quantity: qty, unit, sectionName };
    return next;
  }
  return [
    ...currentLines,
    {
      lineId,
      productId: product.id,
      quantity: qty,
      unit,
      size: '',
      packaging: '',
      unitPrice: product.lastPrice ? String(product.lastPrice) : '0',
      sectionName,
    },
  ];
}

export function buildStaffOrderPayload({
  companyId,
  productType,
  isSale,
  saleDate,
  lang,
  notes,
  basketLines,
  productsById,
  sectionFilter,
  editingId,
  entryType = 'issue',
}: {
  companyId: string;
  productType: 'order' | 'sale';
  isSale: boolean;
  saleDate: string;
  lang: DisplayLanguage;
  notes: string;
  basketLines: StaffBasketLine[];
  productsById: Map<string, OrderProduct>;
  sectionFilter: string;
  editingId: string | null;
  entryType?: StaffOrderEntryType;
}): StaffOrderPayload {
  const payload: StaffOrderPayload = {
    companyId,
    orderType: productType,
    entryType: isSale ? entryType : 'issue',
    saleDate: isSale ? saleDate : undefined,
    lang,
    notes: notes.trim() || undefined,
    items: basketLines.map((item) => {
      const product = productsById.get(item.productId);
      const sectionName = item.sectionName || (product ? resolveItemSection(product, sectionFilter) : undefined);
      return {
        productId: item.productId,
        quantity: String(item.quantity),
        unit: item.unit || undefined,
        size: item.size || undefined,
        packaging: item.packaging || undefined,
        unitPrice: item.unitPrice || undefined,
        notes: item.cancellationNote?.trim() || undefined,
        cancellationReasons: item.cancellationReasons,
        sectionName: sectionName || undefined,
      };
    }),
  };
  if (editingId) {
    payload.sectionName = sectionFilter || basketLines[0]?.sectionName || 'عام';
  }
  return payload;
}
