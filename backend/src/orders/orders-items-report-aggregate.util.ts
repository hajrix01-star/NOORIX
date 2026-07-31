import { Prisma } from '@prisma/client';
import { normalizeUnit, resolveProductUnitMultiplierOrNull } from './orders-unit-conversions.util';

type ItemRow = {
  productId: string;
  size?: string | null;
  packaging?: string | null;
  unit?: string | null;
  quantityMultiplier?: Prisma.Decimal | null;
  quantity: Prisma.Decimal;
  unitPrice?: Prisma.Decimal;
  amount: Prisma.Decimal;
  order?: {
    id: string;
    orderDate: Date;
    orderType: string;
  };
  product: {
    id: string;
    nameAr: string;
    nameEn: string | null;
    categoryId: string | null;
    unit: string | null;
    sections?: unknown;
    sectionIds?: unknown;
    category?: { nameAr: string | null; nameEn: string | null } | null;
  };
};

type DailyAccumulator = {
  date: string;
  quantity: Prisma.Decimal;
  normalizedQuantity: Prisma.Decimal;
  amount: Prisma.Decimal;
  orderIds: Set<string>;
};

type ReportAccumulator = {
  product: ItemRow['product'];
  size: string | null;
  packaging: string | null;
  unit: string;
  baseUnit: string;
  quantity: Prisma.Decimal;
  normalizedQuantity: Prisma.Decimal;
  amount: Prisma.Decimal;
  orderIds: Set<string>;
  orderTypes: Set<string>;
  lastOrderDate: string | null;
  daily: Map<string, DailyAccumulator>;
};

type InventoryProduct = {
  id: string;
  nameAr: string;
  nameEn?: string | null;
  productType?: string | null;
  sections?: unknown;
  sectionIds?: unknown;
  unit?: string | null;
  inventoryConversions?: unknown;
  conversionTemplate?: { conversions?: unknown } | null;
  recipe?: unknown;
};

type InventoryPurchaseInput = {
  productId: string;
  quantity: Prisma.Decimal | string | number;
  unit?: string | null;
  quantityMultiplier?: Prisma.Decimal | string | number | null;
  inventoryBaseQuantitySnapshot?: Prisma.Decimal | string | number | null;
  product: InventoryProduct;
};

type InventorySaleInput = {
  productId: string;
  quantity: Prisma.Decimal | string | number;
  unit?: string | null;
  quantityMultiplier?: Prisma.Decimal | string | number | null;
  inventoryConsumptionSnapshot?: unknown;
  product: InventoryProduct;
};

type InventoryConsumptionSnapshot = {
  version: 1;
  soldBaseQuantity: string;
  components: Array<{
    materialProductId: string;
    materialBaseUnit: string;
    quantityBase: string;
  }>;
};

type InventoryAdjustmentInput = {
  productId: string;
  quantityBase: Prisma.Decimal | string | number;
};

type InventoryRecipeItem = {
  materialProductId: string;
  quantity: string;
  unit: string;
};

type InventoryAccumulator = {
  productId: string;
  productNameAr: string;
  productNameEn: string | null;
  sections: string[];
  sectionIds: string[];
  unit: string;
  purchasedBaseQuantity: Prisma.Decimal;
  consumedBaseQuantity: Prisma.Decimal;
  adjustmentBaseQuantity: Prisma.Decimal;
};

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((entry) => String(entry ?? '').trim()).filter(Boolean))];
}

function decimal(value: Prisma.Decimal | string | number | null | undefined): Prisma.Decimal {
  try {
    return new Prisma.Decimal(value ?? 0);
  } catch {
    return new Prisma.Decimal(0);
  }
}

function normalizedQuantity(
  quantity: Prisma.Decimal | string | number,
  quantityMultiplier?: Prisma.Decimal | string | number | null,
): Prisma.Decimal {
  const qty = decimal(quantity);
  const multiplier = decimal(quantityMultiplier ?? 1);
  return qty.times(multiplier.gt(0) ? multiplier : 1);
}

function storedQuantityMultiplier(
  quantityMultiplier?: Prisma.Decimal | string | number | null,
): Prisma.Decimal | null {
  if (quantityMultiplier == null || String(quantityMultiplier).trim() === '') return null;
  const multiplier = decimal(quantityMultiplier);
  return multiplier.gt(0) ? multiplier : null;
}

function inventoryBaseQuantity(item: {
  quantity: Prisma.Decimal | string | number;
  unit?: string | null;
  quantityMultiplier?: Prisma.Decimal | string | number | null;
  inventoryBaseQuantitySnapshot?: Prisma.Decimal | string | number | null;
  product: InventoryProduct;
}): Prisma.Decimal {
  if (item.inventoryBaseQuantitySnapshot != null) {
    return decimal(item.inventoryBaseQuantitySnapshot);
  }
  const qty = decimal(item.quantity);
  const unit = normalizeUnit(item.unit, '');
  const baseUnit = normalizeUnit(item.product.unit, unit || 'piece');
  const multiplierFromUnit = unit
    ? resolveProductUnitMultiplierOrNull(item.product, unit, baseUnit)
    : null;
  const storedMultiplier = storedQuantityMultiplier(item.quantityMultiplier);
  if (storedMultiplier && (!unit || unit === baseUnit || !storedMultiplier.eq(1))) {
    return qty.times(storedMultiplier);
  }
  if (multiplierFromUnit) return qty.times(multiplierFromUnit);
  if (unit && unit !== baseUnit) {
    throw new Error(
      `Missing inventory conversion for "${item.product.nameAr}" from "${unit}" to "${baseUnit}".`,
    );
  }
  if (storedMultiplier) return qty.times(storedMultiplier);
  return normalizedQuantity(item.quantity, item.quantityMultiplier);
}

function parseInventoryConsumptionSnapshot(value: unknown): InventoryConsumptionSnapshot | null {
  if (value == null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid inventory consumption snapshot.');
  }
  const snapshot = value as Record<string, unknown>;
  if (snapshot.version !== 1 || !Array.isArray(snapshot.components)) {
    throw new Error('Unsupported inventory consumption snapshot.');
  }
  const soldBaseQuantity = String(snapshot.soldBaseQuantity ?? '').trim();
  if (!soldBaseQuantity || !decimal(soldBaseQuantity).isFinite()) {
    throw new Error('Invalid sold quantity in inventory consumption snapshot.');
  }
  const components = snapshot.components.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error('Invalid component in inventory consumption snapshot.');
    }
    const component = entry as Record<string, unknown>;
    const materialProductId = String(component.materialProductId ?? '').trim();
    const materialBaseUnit = String(component.materialBaseUnit ?? '').trim();
    const quantityBase = String(component.quantityBase ?? '').trim();
    if (!materialProductId || !materialBaseUnit || !quantityBase || !decimal(quantityBase).isFinite()) {
      throw new Error('Incomplete component in inventory consumption snapshot.');
    }
    return { materialProductId, materialBaseUnit, quantityBase };
  });
  return { version: 1, soldBaseQuantity, components };
}

function parseInventoryRecipe(value: unknown): InventoryRecipeItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const row = entry as Partial<InventoryRecipeItem>;
    const materialProductId = String(row.materialProductId ?? '').trim();
    const quantity = String(row.quantity ?? '').trim();
    if (!materialProductId || !decimal(quantity).gt(0)) return [];
    return [{
      materialProductId,
      quantity,
      unit: String(row.unit ?? '').trim() || 'piece',
    }];
  });
}

function ensureInventoryRow(
  rows: Map<string, InventoryAccumulator>,
  product: InventoryProduct,
  unitFallback: string,
) {
  const existing = rows.get(product.id);
  if (existing) return existing;
  const row = {
    productId: product.id,
    productNameAr: product.nameAr,
    productNameEn: product.nameEn ?? null,
    sections: parseStringArray(product.sections),
    sectionIds: parseStringArray(product.sectionIds),
    unit: String(product.unit || unitFallback || 'piece').trim() || 'piece',
    purchasedBaseQuantity: new Prisma.Decimal(0),
    consumedBaseQuantity: new Prisma.Decimal(0),
    adjustmentBaseQuantity: new Prisma.Decimal(0),
  };
  rows.set(product.id, row);
  return row;
}

function selectedUnit(item: ItemRow): string {
  return String(item.unit || item.product.unit || 'piece').trim() || 'piece';
}

function selectedBaseUnit(item: ItemRow): string {
  return String(item.product.unit || item.unit || 'piece').trim() || 'piece';
}

function selectedVariantKey(item: ItemRow): string {
  return [
    item.productId,
    item.size || '',
    item.packaging || '',
    selectedUnit(item),
  ].join('|');
}

function reportDate(item: ItemRow): string | null {
  const value = item.order?.orderDate;
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

function classifiedSectionName(sectionNames: string[]): string {
  if (sectionNames.length === 1) return sectionNames[0];
  if (sectionNames.length > 1) return 'مشترك';
  return 'غير محدد';
}

/** تجميع شهري قديم متوافق مع المستهلكين السابقين. */
export function aggregateOrderItemsByProductForReport(items: ItemRow[]) {
  const report = aggregateOrderItemsForRangeReport(items);
  return report.rows.map((row) => ({
    productId: row.productId,
    productNameAr: row.productNameAr,
    productNameEn: row.productNameEn,
    categoryId: row.categoryId,
    categoryNameAr: row.categoryNameAr,
    categoryNameEn: row.categoryNameEn,
    unit: row.unit,
    quantity: row.quantity,
    amount: row.amount,
    orderCount: row.orderCount,
  }));
}

/**
 * تقرير الأصناف الدقيق للنطاق:
 * - يحافظ على الحجم والتغليف والوحدة المختارة.
 * - يطبق معامل التحويل إلى الوحدة الأساسية للصنف.
 * - يعد الطلبات المميزة بدل عد سطور البنود.
 * - يحفظ تفصيلًا يوميًا لإعادة بناء رسوم الأقسام بعد تطبيق فلاتر الواجهة.
 */
export function aggregateOrderItemsForRangeReport(items: ItemRow[]) {
  const grouped = new Map<string, ReportAccumulator>();

  for (const item of items) {
    const key = selectedVariantKey(item);
    const quantity = new Prisma.Decimal(item.quantity);
    const normalizedQuantity = inventoryBaseQuantity(item);
    const amount = new Prisma.Decimal(item.amount);
    const orderId = item.order?.id;
    const date = reportDate(item);
    const orderType = String(item.order?.orderType || '').trim();
    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, {
        product: item.product,
        size: item.size?.trim() || null,
        packaging: item.packaging?.trim() || null,
        unit: selectedUnit(item),
        baseUnit: selectedBaseUnit(item),
        quantity: new Prisma.Decimal(0),
        normalizedQuantity: new Prisma.Decimal(0),
        amount: new Prisma.Decimal(0),
        orderIds: new Set<string>(),
        orderTypes: new Set<string>(),
        lastOrderDate: null,
        daily: new Map<string, DailyAccumulator>(),
      });
    }

    const target = grouped.get(key)!;
    target.quantity = target.quantity.plus(quantity);
    target.normalizedQuantity = target.normalizedQuantity.plus(normalizedQuantity);
    target.amount = target.amount.plus(amount);
    if (orderId) target.orderIds.add(orderId);
    if (orderType) target.orderTypes.add(orderType);
    if (date && (!target.lastOrderDate || date > target.lastOrderDate)) target.lastOrderDate = date;

    if (date) {
      const daily = target.daily.get(date) ?? {
        date,
        quantity: new Prisma.Decimal(0),
        normalizedQuantity: new Prisma.Decimal(0),
        amount: new Prisma.Decimal(0),
        orderIds: new Set<string>(),
      };
      daily.quantity = daily.quantity.plus(quantity);
      daily.normalizedQuantity = daily.normalizedQuantity.plus(normalizedQuantity);
      daily.amount = daily.amount.plus(amount);
      if (orderId) daily.orderIds.add(orderId);
      target.daily.set(date, daily);
    }
  }

  const rows = Array.from(grouped.values()).map((value) => {
    const sectionNames = parseStringArray(value.product.sections);
    const sectionIds = parseStringArray(value.product.sectionIds);
    const normalizedQuantity = value.normalizedQuantity;
    const amount = value.amount;
    const averageUnitPrice = normalizedQuantity.gt(0)
      ? amount.div(normalizedQuantity).toDecimalPlaces(4)
      : new Prisma.Decimal(0);

    return {
      productId: value.product.id,
      productNameAr: value.product.nameAr,
      productNameEn: value.product.nameEn,
      categoryId: value.product.categoryId,
      categoryNameAr: value.product.category?.nameAr ?? null,
      categoryNameEn: value.product.category?.nameEn ?? null,
      sectionName: classifiedSectionName(sectionNames),
      sectionNames,
      sectionIds,
      size: value.size,
      packaging: value.packaging,
      unit: value.unit,
      baseUnit: value.baseUnit,
      quantity: value.quantity.toString(),
      normalizedQuantity: normalizedQuantity.toString(),
      amount: amount.toString(),
      orderCount: value.orderIds.size,
      orderIds: Array.from(value.orderIds),
      orderTypes: Array.from(value.orderTypes).sort(),
      averageUnitPrice: averageUnitPrice.toString(),
      lastOrderDate: value.lastOrderDate,
      daily: Array.from(value.daily.values())
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((daily) => ({
          date: daily.date,
          quantity: daily.quantity.toString(),
          normalizedQuantity: daily.normalizedQuantity.toString(),
          amount: daily.amount.toString(),
          orderCount: daily.orderIds.size,
          orderIds: Array.from(daily.orderIds),
        })),
    };
  });

  const orderIds = new Set(items.map((item) => item.order?.id).filter((id): id is string => Boolean(id)));
  const productIds = new Set(items.map((item) => item.productId));
  const sectionNames = new Set(rows.map((row) => row.sectionName));
  const totalAmount = items.reduce(
    (sum, item) => sum.plus(item.amount),
    new Prisma.Decimal(0),
  );

  return {
    rows,
    summary: {
      totalAmount: totalAmount.toString(),
      distinctOrders: orderIds.size,
      distinctProducts: productIds.size,
      sectionsCount: sectionNames.size,
    },
  };
}

/**
 * دفتر مخزون عام مشتق من المصدر:
 * - طلبات الشراء تضيف كمية المنتج المشترى بعد معامل التحويل.
 * - تسجيلات بيع الأصناف تسحب مواد الرسبي المرتبطة بالصنف المباع.
 * لا يكتب في قاعدة البيانات، حتى يبقى التقرير مطابقاً للحركات الفعلية.
 */
export function aggregateRecipeInventoryStock(input: {
  purchases: InventoryPurchaseInput[];
  sales: InventorySaleInput[];
  materialProducts: InventoryProduct[];
  adjustments?: InventoryAdjustmentInput[];
}) {
  const rows = new Map<string, InventoryAccumulator>();
  const materialById = new Map(input.materialProducts.map((product) => [product.id, product]));

  for (const product of input.materialProducts) {
    ensureInventoryRow(rows, product, product.unit || 'piece');
  }

  for (const purchase of input.purchases) {
    if (purchase.product.productType && purchase.product.productType !== 'order') continue;
    const row = ensureInventoryRow(rows, purchase.product, purchase.product.unit || 'piece');
    row.purchasedBaseQuantity = row.purchasedBaseQuantity.plus(inventoryBaseQuantity(purchase));
  }

  for (const sale of input.sales) {
    if (sale.product.productType && sale.product.productType !== 'sale') continue;
    const consumptionSnapshot = parseInventoryConsumptionSnapshot(
      sale.inventoryConsumptionSnapshot,
    );
    if (consumptionSnapshot) {
      for (const component of consumptionSnapshot.components) {
        const materialProduct = materialById.get(component.materialProductId);
        if (!materialProduct) {
          throw new Error(
            `Inventory snapshot material "${component.materialProductId}" is missing.`,
          );
        }
        const row = ensureInventoryRow(rows, materialProduct, component.materialBaseUnit);
        row.consumedBaseQuantity = row.consumedBaseQuantity.plus(
          decimal(component.quantityBase),
        );
      }
      continue;
    }
    const soldBaseQuantity = inventoryBaseQuantity(sale);
    for (const recipeItem of parseInventoryRecipe(sale.product.recipe)) {
      const materialProduct = materialById.get(recipeItem.materialProductId);
      if (!materialProduct) continue;
      const rowUnit = normalizeUnit(materialProduct.unit, recipeItem.unit || 'piece');
      const unitMultiplier = resolveProductUnitMultiplierOrNull(materialProduct, recipeItem.unit, rowUnit);
      if (!unitMultiplier) {
        throw new Error(
          `Missing inventory conversion for recipe material "${materialProduct.nameAr}" from "${recipeItem.unit}" to "${rowUnit}".`,
        );
      }
      const row = ensureInventoryRow(rows, materialProduct, rowUnit);
      row.consumedBaseQuantity = row.consumedBaseQuantity.plus(
        soldBaseQuantity.times(decimal(recipeItem.quantity)).times(unitMultiplier),
      );
    }
  }

  for (const adjustment of input.adjustments ?? []) {
    const materialProduct = materialById.get(adjustment.productId);
    if (!materialProduct) continue;
    const row = ensureInventoryRow(rows, materialProduct, materialProduct.unit || 'piece');
    row.adjustmentBaseQuantity = row.adjustmentBaseQuantity.plus(decimal(adjustment.quantityBase));
  }

  return Array.from(rows.values())
    .map((row) => ({
      productId: row.productId,
      productNameAr: row.productNameAr,
      productNameEn: row.productNameEn,
      sections: row.sections,
      sectionIds: row.sectionIds,
      unit: row.unit,
      purchasedBaseQuantity: row.purchasedBaseQuantity.toString(),
      consumedBaseQuantity: row.consumedBaseQuantity.toString(),
      adjustmentBaseQuantity: row.adjustmentBaseQuantity.toString(),
      balanceBaseQuantity: row.purchasedBaseQuantity
        .minus(row.consumedBaseQuantity)
        .plus(row.adjustmentBaseQuantity)
        .toString(),
    }))
    .sort((a, b) => a.productNameAr.localeCompare(b.productNameAr, 'ar'));
}
