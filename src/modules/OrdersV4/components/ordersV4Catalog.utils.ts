import type { OrdersV4ConversionVersion, OrdersV4Item, OrdersV4Unit } from '../../../types/api';

export type OrdersV4CatalogItemKind = 'purchased' | 'sale';

export function filterOrdersV4CatalogItems(
  items: OrdersV4Item[],
  filters: { kind: OrdersV4CatalogItemKind; search: string; categoryId: string; sectionId: string },
) {
  const query = filters.search.trim().toLocaleLowerCase('ar');
  return items.filter((item) => {
    if (!item.isActive || item.itemType !== filters.kind) return false;
    if (filters.categoryId && item.categoryId !== filters.categoryId) return false;
    if (filters.sectionId && !item.sections.some((link) => link.section.id === filters.sectionId)) return false;
    if (!query) return true;
    return [item.nameAr, item.nameEn, item.sku]
      .filter(Boolean)
      .some((value) => String(value).toLocaleLowerCase('ar').includes(query));
  });
}

export function ordersV4ItemUnitsSummary(item: OrdersV4Item) {
  return item.units
    .filter((row) => row.isActive)
    .map((row) => row.purchaseLabel?.trim() || row.unit.nameAr)
    .join(' / ') || item.inventoryUnit.nameAr;
}

export function ordersV4ItemLastPrice(item: OrdersV4Item) {
  const prices = item.units
    .map((row) => Number(row.lastPrice))
    .filter((value) => Number.isFinite(value) && value >= 0);
  return prices.length ? Math.max(...prices) : null;
}

export function ordersV4ConversionEquations(
  conversion: OrdersV4ConversionVersion | undefined,
) {
  if (!conversion?.edges.length) return [];
  return [...conversion.edges]
    .sort((left, right) => left.fromUnit.nameAr.localeCompare(right.fromUnit.nameAr, 'ar'))
    .map((edge) => `1 ${edge.fromUnit.nameAr} = ${edge.factor} ${edge.toUnit.nameAr}`);
}

export function ordersV4BuiltInTemplates(units: OrdersV4Unit[]) {
  const byCode = new Map(units.map((unit) => [unit.code, unit]));
  const template = (name: string, from: string, to: string, factor: string) => {
    const fromUnit = byCode.get(from);
    const toUnit = byCode.get(to);
    return fromUnit && toUnit ? { name, fromUnitId: fromUnit.id, toUnitId: toUnit.id, factor } : null;
  };
  return [
    template('وزن قياسي', 'kg', 'g', '1000'),
    template('سوائل قياسي', 'l', 'ml', '1000'),
    template('درزن إلى حبة', 'dozen', 'piece', '12'),
  ].filter((row): row is NonNullable<typeof row> => row !== null);
}
