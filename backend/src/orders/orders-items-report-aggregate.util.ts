import { Prisma } from '@prisma/client';

type ItemRow = {
  productId: string;
  quantity: Prisma.Decimal;
  amount: Prisma.Decimal;
  product: {
    id: string;
    nameAr: string;
    nameEn: string | null;
    categoryId: string | null;
    unit: string | null;
    category?: { nameAr: string | null; nameEn: string | null } | null;
  };
};

/** تجميع بنود الطلبات حسب المنتج — لـ `getItemsReport`. */
export function aggregateOrderItemsByProductForReport(items: ItemRow[]) {
  const byProduct = new Map<
    string,
    { product: ItemRow['product']; quantity: Prisma.Decimal; amount: Prisma.Decimal; orderCount: number }
  >();
  for (const it of items) {
    const key = it.productId;
    const existing = byProduct.get(key);
    const qty = new Prisma.Decimal(it.quantity);
    const amt = new Prisma.Decimal(it.amount);
    if (existing) {
      existing.quantity = existing.quantity.plus(qty);
      existing.amount = existing.amount.plus(amt);
      existing.orderCount += 1;
    } else {
      byProduct.set(key, {
        product: it.product,
        quantity: qty,
        amount: amt,
        orderCount: 1,
      });
    }
  }
  return Array.from(byProduct.values()).map((v) => ({
    productId: v.product.id,
    productNameAr: v.product.nameAr,
    productNameEn: v.product.nameEn,
    categoryId: v.product.categoryId,
    categoryNameAr: v.product.category?.nameAr,
    categoryNameEn: v.product.category?.nameEn,
    unit: v.product.unit,
    quantity: v.quantity.toString(),
    amount: v.amount.toString(),
    orderCount: v.orderCount,
  }));
}
