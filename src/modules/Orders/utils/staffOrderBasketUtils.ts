import Decimal from 'decimal.js';

export type StaffBasketLine = {
  lineId: string;
  productId: string;
  quantity: number;
  unit: string;
  size: string;
  packaging: string;
  unitPrice: string;
  sectionName?: string;
};

export function staffBasketLineKey(line: Pick<StaffBasketLine, 'productId' | 'size' | 'packaging' | 'unit'>) {
  return `${line.productId}|${line.size}|${line.packaging}|${line.unit}`;
}

export function productHasVariants(product: any): boolean {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const sizes = product?.sizes ? String(product.sizes).split(/[,،]/).map((x: string) => x.trim()).filter(Boolean) : [];
  return variants.length > 0 || sizes.length > 0;
}

export function defaultVariantModalState(product: any) {
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
  };
}

export function resolveVariantFromModal(
  product: any,
  modal: { variantKey: string; size: string; packaging: string; unit: string; unitPrice: string },
) {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  let size = modal.size;
  let packaging = modal.packaging;
  let unit = modal.unit || 'piece';
  let unitPrice = modal.unitPrice;
  if (modal.variantKey && variants.length > 0) {
    const v = variants.find((x: any, i: number) =>
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

export function displayProductPrice(product: any): string | null {
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
  let total = new Decimal(0);
  for (const sec of sections) {
    for (const order of sec.orders || []) {
      for (const it of order.items || []) {
        const q = new Decimal(it.quantity || 0);
        const p = new Decimal(it.unitPrice ?? 0);
        total = total.plus(q.times(p));
      }
    }
  }
  return total.toNumber();
}
