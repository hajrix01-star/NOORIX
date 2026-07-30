import Decimal from 'decimal.js';
import type {
  OrderProduct,
  OrderProductVariant,
  StaffCancellationReason,
} from '../../../types/api';

export type StaffBasketLine = {
  lineId: string;
  productId: string;
  quantity: number;
  unit: string;
  size: string;
  packaging: string;
  unitPrice: string;
  sectionName?: string;
  cancellationReasons?: StaffCancellationReason[];
  cancellationNote?: string;
};

export function staffBasketLineKey(line: Pick<StaffBasketLine, 'productId' | 'size' | 'packaging' | 'unit'>) {
  return `${line.productId}|${line.size}|${line.packaging}|${line.unit}`;
}

export function productHasVariants(product: OrderProduct): boolean {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const sizes = product?.sizes ? String(product.sizes).split(/[,،]/).map((x: string) => x.trim()).filter(Boolean) : [];
  return variants.length > 0 || sizes.length > 0;
}

export function defaultVariantModalState(product: OrderProduct) {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const sizes = product?.sizes ? String(product.sizes).split(/[,،]/).map((x: string) => x.trim()).filter(Boolean) : [];
  const hasVariants = variants.length > 0;
  const hasSizes = sizes.length > 0;
  const v0 = variants[0];
  return {
    product,
    variantKey: hasVariants
      ? `${v0?.size || ''}|${v0?.packaging || ''}|${v0?.unit || 'piece'}|0`
      : '',
    size: !hasVariants && hasSizes ? sizes[0] : '',
    packaging: '',
    unit: v0?.unit || 'piece',
    quantity: '1',
    unitPrice: v0?.lastPrice ? String(v0.lastPrice) : (product?.lastPrice ? String(product.lastPrice) : ''),
    cancellationReasons: [] as StaffCancellationReason[],
    cancellationNote: '',
  };
}

export function resolveVariantFromModal(
  product: OrderProduct,
  modal: { variantKey: string; size: string; packaging: string; unit: string; unitPrice: string },
) {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  let size = modal.size;
  let packaging = modal.packaging;
  let unit = modal.unit || 'piece';
  let unitPrice = modal.unitPrice;
  if (modal.variantKey && variants.length > 0) {
    const v = (variants as OrderProductVariant[]).find((x, i) =>
      `${x.size || ''}|${x.packaging || ''}|${x.unit || ''}|${i}` === modal.variantKey
      || `${x.size || ''}|${x.packaging || ''}|${x.unit || ''}` === modal.variantKey.split('|').slice(0, 3).join('|'),
    ) || variants[0];
    if (v) {
      size = v.size || '';
      packaging = v.packaging || '';
      unit = v.unit || 'piece';
      if (!unitPrice) unitPrice = v.lastPrice ? String(v.lastPrice) : '';
    }
  }
  return {
    size: size || '',
    packaging: packaging || '',
    unit: unit || 'piece',
    unitPrice: unitPrice || (product?.lastPrice ? String(product.lastPrice) : '0'),
  };
}

export function basketLineAmount(line: StaffBasketLine): Decimal {
  const q = new Decimal(line.quantity || 0);
  const p = new Decimal(line.unitPrice || 0);
  return q.times(p);
}

export function basketTotal(lines: StaffBasketLine[]): Decimal {
  return lines.reduce((sum, line) => sum.plus(basketLineAmount(line)), new Decimal(0));
}

type StaffAmountProduct = {
  lastPrice?: number | string | null;
  variants?: unknown;
  unit?: string | null;
};

type StaffAmountItem = {
  quantity?: number | string | null;
  unitPrice?: number | string | null;
  size?: string | null;
  packaging?: string | null;
  unit?: string | null;
  product?: StaffAmountProduct | null;
};

/** سعر السطر — يُستخدم المحفوظ، وإن كان 0 يُستنتج من كتالوج المنتج (للسجلات القديمة) */
export function resolveStaffItemUnitPrice(item: StaffAmountItem): Decimal {
  const stored = new Decimal(item.unitPrice ?? 0);
  if (stored.gt(0)) return stored;
  const product = item.product;
  if (!product) return stored;

  const size = item.size?.trim() || null;
  const packaging = item.packaging?.trim() || null;
  const unit = item.unit?.trim() || 'piece';
  const variants = Array.isArray(product.variants)
    ? (product.variants as { size?: string; packaging?: string; unit?: string; lastPrice?: string | number }[])
    : [];

  const match = variants.find(
    (v) => (v.size || '') === (size || '')
      && (v.packaging || '') === (packaging || '')
      && (v.unit || 'piece') === unit,
  );
  if (match?.lastPrice != null && String(match.lastPrice).trim() !== '') {
    return new Decimal(match.lastPrice);
  }
  if (variants.length > 0 && !size && !packaging) {
    const v0 = variants[0];
    return new Decimal(v0.lastPrice ?? 0);
  }
  return new Decimal(product.lastPrice ?? 0);
}

export function staffItemLineAmount(item: StaffAmountItem): Decimal {
  const q = new Decimal(item.quantity || 0);
  return q.times(resolveStaffItemUnitPrice(item));
}

export function staffOrdersQty(orders: { items?: { quantity?: number | string | null }[] }[]): number {
  let qty = new Decimal(0);
  for (const order of orders) {
    for (const it of order.items || []) {
      qty = qty.plus(new Decimal(it.quantity || 0));
    }
  }
  return qty.toNumber();
}

export function staffOrdersTotal(orders: { items?: StaffAmountItem[] }[]): Decimal {
  let total = new Decimal(0);
  for (const order of orders) {
    for (const it of order.items || []) {
      total = total.plus(staffItemLineAmount(it));
    }
  }
  return total;
}

/** تقرير/عملية: إجمالي المبالغ ÷ عدد العمليات */
export function staffSaleAvgPerOperation(totalAmount: Decimal | number, operationCount: number): Decimal {
  const total = totalAmount instanceof Decimal ? totalAmount : new Decimal(totalAmount || 0);
  const count = Number(operationCount) || 0;
  return count > 0 ? total.div(count) : new Decimal(0);
}

/** عملية واحدة: إجمالي المبلغ ÷ إجمالي الكميات (متوسط مرجّح للوحدة) */
export function staffSaleAvgPerOrder(totalAmount: Decimal | number, totalQty: number): Decimal {
  const total = totalAmount instanceof Decimal ? totalAmount : new Decimal(totalAmount || 0);
  const qty = Number(totalQty) || 0;
  return qty > 0 ? total.div(qty) : new Decimal(0);
}

export function displayProductPrice(product: OrderProduct): string | null {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  if (variants.length > 0 && variants[0]?.lastPrice) return String(variants[0].lastPrice);
  if (product?.lastPrice != null && Number(product.lastPrice) > 0) return String(product.lastPrice);
  return null;
}

export function formatVariantLabel(
  size?: string | null,
  packaging?: string | null,
  unit?: string | null,
): string {
  const parts = [size, packaging, unit].filter(Boolean);
  return parts.length > 0 ? parts.join(' / ') : '';
}

/** تقدير إجمالي طلبات معلّقة في ملخص الكاشير */
export function digestSectionsTotal(sections: { orders?: { items?: { quantity?: number | string; unitPrice?: number | string | null }[] }[] }[]): number {
  return staffOrdersTotal(sections.flatMap((sec) => sec.orders || [])).toNumber();
}
