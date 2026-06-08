import { Prisma } from '@prisma/client';
import { resolveStaffItemVariant } from './orders-staff-pricing.util';

type StaffAmountItem = {
  quantity?: Prisma.Decimal | number | string | null;
  unitPrice?: Prisma.Decimal | number | string | null;
  size?: string | null;
  packaging?: string | null;
  unit?: string | null;
  product?: Parameters<typeof resolveStaffItemVariant>[0];
};

/** سعر السطر — يُستخدم المحفوظ، وإن كان 0 يُستنتج من كتالوج المنتج (للسجلات القديمة) */
export function resolveStaffItemUnitPrice(item: StaffAmountItem): Prisma.Decimal {
  const stored = item.unitPrice != null ? new Prisma.Decimal(item.unitPrice) : new Prisma.Decimal(0);
  if (stored.gt(0)) return stored;
  if (!item.product) return stored;
  return resolveStaffItemVariant(item.product, {
    size: item.size,
    packaging: item.packaging,
    unit: item.unit,
  }).unitPrice;
}

export function staffItemLineAmount(item: StaffAmountItem): Prisma.Decimal {
  const q = new Prisma.Decimal(item.quantity || 0);
  return q.times(resolveStaffItemUnitPrice(item));
}

export function staffOrdersQty(orders: { items?: { quantity?: Prisma.Decimal | number | string | null }[] }[]): number {
  let qty = new Prisma.Decimal(0);
  for (const order of orders) {
    for (const it of order.items || []) {
      qty = qty.plus(new Prisma.Decimal(it.quantity || 0));
    }
  }
  return Number(qty);
}

export function staffOrdersTotal(orders: { items?: StaffAmountItem[] }[]): Prisma.Decimal {
  let total = new Prisma.Decimal(0);
  for (const order of orders) {
    for (const it of order.items || []) {
      total = total.plus(staffItemLineAmount(it));
    }
  }
  return total;
}

/** إجمالي المبالغ ÷ عدد العمليات */
export function staffSaleAvgPerOperation(totalAmount: Prisma.Decimal, operationCount: number): Prisma.Decimal {
  const count = Number(operationCount) || 0;
  return count > 0 ? totalAmount.div(count) : new Prisma.Decimal(0);
}

/** عملية واحدة: إجمالي المبلغ ÷ إجمالي الكميات */
export function staffSaleAvgPerOrder(totalAmount: Prisma.Decimal, totalQty: number): Prisma.Decimal {
  const qty = Number(totalQty) || 0;
  return qty > 0 ? totalAmount.div(qty) : new Prisma.Decimal(0);
}
