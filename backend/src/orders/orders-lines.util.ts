import { Prisma } from '@prisma/client';

export type OrderLineDraft = {
  productId: string;
  size: string | null;
  packaging: string | null;
  unit: string | null;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  amount: Prisma.Decimal;
};

/** تحويل بنود الطلب من DTO إلى مبالغ Decimal جاهزة للإنشاء/التحديث */
export function mapDtoItemsToOrderLines(
  items: { productId: string; size?: string; packaging?: string; unit?: string; quantity: string; unitPrice: string }[],
): OrderLineDraft[] {
  return items.map((i) => ({
    productId: i.productId,
    size: i.size?.trim() || null,
    packaging: i.packaging?.trim() || null,
    unit: i.unit?.trim() || null,
    quantity: new Prisma.Decimal(i.quantity || 0),
    unitPrice: new Prisma.Decimal(i.unitPrice || 0),
    amount: new Prisma.Decimal(i.quantity || 0).times(new Prisma.Decimal(i.unitPrice || 0)),
  }));
}

export function orderLinesToLastPriceInputs(
  items: OrderLineDraft[],
): { productId: string; size?: string | null; packaging?: string | null; unit?: string | null; unitPrice: Prisma.Decimal }[] {
  return items.map((i) => ({
    productId: i.productId,
    size: i.size,
    packaging: i.packaging,
    unit: i.unit,
    unitPrice: i.unitPrice,
  }));
}
