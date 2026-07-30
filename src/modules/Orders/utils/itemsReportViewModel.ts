import type { OrderItemsReportRow } from '../../../types/api';
import { numberValue } from './ordersReportModel';

export type ItemsReportMetric = 'amount' | 'normalizedQuantity' | 'orderCount';
export type ItemsReportRanking = 'all' | 'top' | 'bottom';

export type ItemsReportFilters = {
  search: string;
  sections: string[];
  categoryIds: string[];
  units: string[];
  packagings: string[];
  orderTypes: string[];
};

export type ItemsReportProductSummary = {
  productId: string;
  productNameAr?: string | null;
  productNameEn?: string | null;
  amount: number;
  normalizedQuantity: number;
  orderCount: number;
  orderIds: string[];
};

function normalizedText(value: unknown): string {
  return String(value ?? '').trim().toLocaleLowerCase('ar');
}

function rowSections(row: OrderItemsReportRow): string[] {
  const values = Array.isArray(row.sectionNames) ? row.sectionNames.filter(Boolean) : [];
  if (values.length > 0) return values;
  return row.sectionName ? [row.sectionName] : ['غير محدد'];
}

function intersects(selected: string[], values: string[]): boolean {
  return selected.length === 0 || selected.some((value) => values.includes(value));
}

export function filterItemsReportRows(
  rows: OrderItemsReportRow[],
  filters: ItemsReportFilters,
): OrderItemsReportRow[] {
  const query = normalizedText(filters.search);
  return rows.filter((row) => {
    const searchable = [
      row.productNameAr,
      row.productNameEn,
      row.categoryNameAr,
      row.categoryNameEn,
      row.packaging,
      row.size,
    ].map(normalizedText).join(' ');
    if (query && !searchable.includes(query)) return false;
    if (!intersects(filters.sections, rowSections(row))) return false;
    if (filters.categoryIds.length > 0 && !filters.categoryIds.includes(row.categoryId || '')) return false;
    if (filters.units.length > 0 && !filters.units.includes(row.unit || '')) return false;
    if (filters.packagings.length > 0 && !filters.packagings.includes(row.packaging || '')) return false;
    if (!intersects(filters.orderTypes, row.orderTypes || [])) return false;
    return true;
  });
}

export function computeItemsReportMetrics(rows: OrderItemsReportRow[]) {
  const orderIds = new Set<string>();
  const productIds = new Set<string>();
  const sections = new Set<string>();
  const quantityByBaseUnit = new Map<string, number>();
  let amount = 0;

  for (const row of rows) {
    amount += numberValue(row.amount);
    productIds.add(row.productId);
    for (const orderId of row.orderIds || []) orderIds.add(orderId);
    for (const section of rowSections(row)) sections.add(section);
    const baseUnit = row.baseUnit || row.unit || 'piece';
    quantityByBaseUnit.set(
      baseUnit,
      (quantityByBaseUnit.get(baseUnit) || 0) + numberValue(row.normalizedQuantity ?? row.quantity),
    );
  }

  return {
    amount,
    distinctOrders: orderIds.size,
    distinctProducts: productIds.size,
    sectionsCount: sections.size,
    quantityByBaseUnit,
  };
}

export function metricValue(
  row: {
    amount?: string | number | null;
    normalizedQuantity?: string | number | null;
    quantity?: string | number | null;
    orderCount?: number | null;
  },
  metric: ItemsReportMetric,
): number {
  if (metric === 'amount') return numberValue(row.amount);
  if (metric === 'normalizedQuantity') return numberValue(row.normalizedQuantity ?? row.quantity);
  return Number(row.orderCount || 0);
}

export function rankItemsReportRows(
  rows: OrderItemsReportRow[],
  metric: ItemsReportMetric,
  mode: ItemsReportRanking,
  count: number,
): OrderItemsReportRow[] {
  if (mode === 'all') return rows;
  const sorted = [...rows].sort((a, b) => metricValue(b, metric) - metricValue(a, metric));
  if (mode === 'top') return sorted.slice(0, count);
  return sorted.slice(-count).reverse();
}

export function aggregateProducts(rows: OrderItemsReportRow[]): ItemsReportProductSummary[] {
  const grouped = new Map<string, ItemsReportProductSummary & { orderIdSet: Set<string> }>();
  for (const row of rows) {
    const existing = grouped.get(row.productId) ?? {
      productId: row.productId,
      productNameAr: row.productNameAr,
      productNameEn: row.productNameEn,
      amount: 0,
      normalizedQuantity: 0,
      orderCount: 0,
      orderIds: [],
      orderIdSet: new Set<string>(),
    };
    existing.amount += numberValue(row.amount);
    existing.normalizedQuantity += numberValue(row.normalizedQuantity ?? row.quantity);
    for (const orderId of row.orderIds || []) existing.orderIdSet.add(orderId);
    existing.orderCount = existing.orderIdSet.size;
    grouped.set(row.productId, existing);
  }
  return Array.from(grouped.values()).map(({ orderIdSet: _orderIdSet, ...value }) => ({
    ...value,
    orderIds: Array.from(_orderIdSet),
  }));
}

export function rowsForSection(rows: OrderItemsReportRow[], sectionName: string): OrderItemsReportRow[] {
  if (sectionName === 'مشترك' || sectionName === 'غير محدد') {
    return rows.filter((row) => (row.sectionName || 'غير محدد') === sectionName);
  }
  return rows.filter((row) => rowSections(row).includes(sectionName));
}

export function buildReconciledSectionSummaries(rows: OrderItemsReportRow[]) {
  const grouped = new Map<string, {
    sectionName: string;
    amount: number;
    normalizedQuantity: number;
    orderIds: Set<string>;
    productIds: Set<string>;
  }>();
  for (const row of rows) {
    const sectionName = row.sectionName || 'غير محدد';
    const current = grouped.get(sectionName) ?? {
      sectionName,
      amount: 0,
      normalizedQuantity: 0,
      orderIds: new Set<string>(),
      productIds: new Set<string>(),
    };
    current.amount += numberValue(row.amount);
    current.normalizedQuantity += numberValue(row.normalizedQuantity ?? row.quantity);
    current.productIds.add(row.productId);
    for (const orderId of row.orderIds || []) current.orderIds.add(orderId);
    grouped.set(sectionName, current);
  }
  return Array.from(grouped.values()).map((value) => ({
    sectionName: value.sectionName,
    amount: value.amount,
    normalizedQuantity: value.normalizedQuantity,
    orderCount: value.orderIds.size,
    productCount: value.productIds.size,
  }));
}

export function buildDailySectionSeries(rows: OrderItemsReportRow[], metric: ItemsReportMetric) {
  const byDate = new Map<string, Record<string, number | string>>();
  const orderSets = new Map<string, Map<string, Set<string>>>();

  for (const row of rows) {
    const sectionName = row.sectionName || 'غير محدد';
    for (const daily of row.daily || []) {
      const point = byDate.get(daily.date) ?? { date: daily.date };
      if (metric === 'orderCount') {
        const dateSets = orderSets.get(daily.date) ?? new Map<string, Set<string>>();
        const ids = dateSets.get(sectionName) ?? new Set<string>();
        for (const orderId of daily.orderIds || []) ids.add(orderId);
        dateSets.set(sectionName, ids);
        orderSets.set(daily.date, dateSets);
        point[sectionName] = ids.size;
      } else {
        const value = metric === 'amount'
          ? numberValue(daily.amount)
          : numberValue(daily.normalizedQuantity);
        point[sectionName] = Number(point[sectionName] || 0) + value;
      }
      byDate.set(daily.date, point);
    }
  }

  return Array.from(byDate.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));
}
