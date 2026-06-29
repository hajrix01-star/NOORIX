import Decimal from 'decimal.js';
import {
  type StaffBasketLine,
  staffBasketLineKey,
  staffOrdersQty,
  staffOrdersTotal,
} from './staffOrderBasketUtils';
import { resolveItemSection } from '../StaffOrdersViewParts';

export function buildStaffOrderFrequencyMap(myOrders: any[], productType: 'order' | 'sale'): Map<string, number> {
  const map = new Map<string, number>();
  for (const order of (myOrders ?? []).filter((o: any) => (o.orderType || 'order') === productType)) {
    for (const item of order.items || []) {
      if (item.productId) map.set(item.productId, (map.get(item.productId) ?? 0) + 1);
    }
  }
  return map;
}

export function buildProductsById(products: any[]): Map<string, any> {
  const map = new Map<string, any>();
  (products ?? []).forEach((product: any) => map.set(product.id, product));
  return map;
}

export function filterStaffOrderProducts({
  allProducts,
  sectionFilter,
  search,
  freqMap,
  lang,
}: {
  allProducts: any[];
  sectionFilter: string;
  search: string;
  freqMap: Map<string, number>;
  lang: string;
}): any[] {
  let list = sectionFilter
    ? (allProducts ?? []).filter((product: any) => {
        const sections = product.sections as string[] | null;
        return Array.isArray(sections) && sections.length > 0 && sections.includes(sectionFilter);
      })
    : (allProducts ?? []);

  const q = search.trim().toLowerCase();
  if (q) {
    list = list.filter((product: any) =>
      (product.nameAr || '').toLowerCase().includes(q) || (product.nameEn || '').toLowerCase().includes(q),
    );
  }

  return [...list].sort((a: any, b: any) => {
    const fa = freqMap.get(a.id) ?? 0;
    const fb = freqMap.get(b.id) ?? 0;
    if (fb !== fa) return fb - fa;
    const na = lang === 'en' ? (a.nameEn || a.nameAr) : (a.nameAr || a.nameEn);
    const nb = lang === 'en' ? (b.nameEn || b.nameAr) : (b.nameAr || b.nameEn);
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

export function filterStaffOrdersByType(myOrders: any[], productType: 'order' | 'sale'): any[] {
  return (myOrders ?? []).filter((order: any) => (order.orderType || 'order') === productType);
}

export function groupSentSaleOrders(sentOrders: any[], isSale: boolean): any[][] {
  if (!isSale) return [];
  const map = new Map<string, any[]>();
  for (const order of sentOrders ?? []) {
    const key = order.logRef || order.id;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(order);
  }
  return [...map.values()].sort(
    (a, b) => new Date(b[0].createdAt).getTime() - new Date(a[0].createdAt).getTime(),
  );
}

export function summarizeSentSales({
  isSale,
  sentSaleGroups,
  sentOrders,
}: {
  isSale: boolean;
  sentSaleGroups: any[][];
  sentOrders: any[];
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

export function mapStaffOrderToBasketLines(order: any): StaffBasketLine[] {
  return (order.items || []).map((item: any, index: number) => ({
    lineId: `${item.productId}-${index}`,
    productId: item.productId,
    quantity: Number(item.quantity) || 1,
    unit: item.unit || 'piece',
    size: item.size || '',
    packaging: item.packaging || '',
    unitPrice: item.unitPrice != null ? String(item.unitPrice) : '0',
    sectionName: order.sectionName || undefined,
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
  product: any;
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
}: {
  companyId: string;
  productType: 'order' | 'sale';
  isSale: boolean;
  saleDate: string;
  lang: string;
  notes: string;
  basketLines: StaffBasketLine[];
  productsById: Map<string, any>;
  sectionFilter: string;
  editingId: string | null;
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    companyId,
    orderType: productType,
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
        sectionName: sectionName || undefined,
      };
    }),
  };
  if (editingId) {
    payload.sectionName = sectionFilter || basketLines[0]?.sectionName || 'عام';
  }
  return payload;
}
