import { Prisma } from '@prisma/client';

export type OrderLineDraft = {
  productId: string | null;
  customLabelAr: string | null;
  customLabelEn: string | null;
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
    customLabelAr: null,
    customLabelEn: null,
    size: i.size?.trim() || null,
    packaging: i.packaging?.trim() || null,
    unit: i.unit?.trim() || null,
    quantity: new Prisma.Decimal(i.quantity || 0),
    unitPrice: new Prisma.Decimal(i.unitPrice || 0),
    amount: new Prisma.Decimal(i.quantity || 0).times(new Prisma.Decimal(i.unitPrice || 0)),
  }));
}

export type StaffOrderItemDto = {
  productId?: string;
  customLabelAr?: string;
  customLabelEn?: string;
  size?: string;
  packaging?: string;
  unit?: string;
  quantity: string;
  unitPrice: string;
};

/** بنود طلب الموظف: صنف من الكتالوج أو بند حر (اسم عربي إلزامي للبند الحر) */
export function mapStaffDtoItemsToOrderLines(items: StaffOrderItemDto[]): OrderLineDraft[] {
  const out: OrderLineDraft[] = [];
  for (const i of items) {
    const pid = i.productId?.trim() || null;
    const customAr = i.customLabelAr?.trim() || null;
    const customEn = i.customLabelEn?.trim() || null;
    if (pid) {
      out.push({
        productId: pid,
        customLabelAr: null,
        customLabelEn: null,
        size: i.size?.trim() || null,
        packaging: i.packaging?.trim() || null,
        unit: i.unit?.trim() || null,
        quantity: new Prisma.Decimal(i.quantity || 0),
        unitPrice: new Prisma.Decimal(i.unitPrice || 0),
        amount: new Prisma.Decimal(i.quantity || 0).times(new Prisma.Decimal(i.unitPrice || 0)),
      });
    } else if (customAr) {
      out.push({
        productId: null,
        customLabelAr: customAr,
        customLabelEn: customEn || null,
        size: i.size?.trim() || null,
        packaging: i.packaging?.trim() || null,
        unit: i.unit?.trim() || null,
        quantity: new Prisma.Decimal(i.quantity || 0),
        unitPrice: new Prisma.Decimal(i.unitPrice || 0),
        amount: new Prisma.Decimal(i.quantity || 0).times(new Prisma.Decimal(i.unitPrice || 0)),
      });
    }
  }
  return out;
}

export function orderLinesToLastPriceInputs(
  items: OrderLineDraft[],
): { productId: string; size?: string | null; packaging?: string | null; unit?: string | null; unitPrice: Prisma.Decimal }[] {
  return items
    .filter((i) => i.productId)
    .map((i) => ({
      productId: i.productId as string,
      size: i.size,
      packaging: i.packaging,
      unit: i.unit,
      unitPrice: i.unitPrice,
    }));
}
