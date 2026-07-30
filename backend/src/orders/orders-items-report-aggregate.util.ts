import { Prisma } from '@prisma/client';

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

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((entry) => String(entry ?? '').trim()).filter(Boolean))];
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
    const multiplier = item.quantityMultiplier == null
      ? new Prisma.Decimal(1)
      : new Prisma.Decimal(item.quantityMultiplier);
    const normalizedQuantity = quantity.times(multiplier.gt(0) ? multiplier : 1);
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
