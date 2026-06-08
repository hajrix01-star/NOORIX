import { Prisma } from '@prisma/client';
import { formatVariantLabel, resolveStaffItemVariant, staffLineAggregateKey } from './orders-staff-pricing.util';
import {
  resolveStaffItemUnitPrice,
  staffItemLineAmount,
  staffOrdersQty,
  staffOrdersTotal,
  staffSaleAvgPerOrder,
} from './orders-staff-amount.util';

export function fmtStaffWaMoney(d: Prisma.Decimal | number): string {
  const n = Number(d);
  if (!Number.isFinite(n)) return '0';
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** نص واتساب للتسجيل الداخلي — قسم واحد أو عدة أقسام في رسالة واحدة */
export function buildSalesWhatsAppTextCombined(
  orders: any[],
  saleDate: Date,
  lang: 'ar' | 'en' = 'ar',
  logRef?: string | null,
): string {
  const d = saleDate.toISOString().slice(0, 10).replace(/-/g, '/');
  const multi = orders.length > 1;
  const header = lang === 'en'
    ? (multi ? 'Internal log' : `Internal log — ${orders[0]?.sectionName || '—'}`)
    : (multi ? 'تسجيل داخلي' : `تسجيل داخلي — ${orders[0]?.sectionName || '—'}`);
  const dateLine = lang === 'en' ? `Date: ${d}` : `يوم التسجيل: ${d}`;
  const refLine = logRef
    ? (lang === 'en' ? `Ref: ${logRef}` : `رقم العملية: ${logRef}`)
    : null;
  const lines: string[] = [header, dateLine, ...(refLine ? [refLine] : []), '──────────────'];
  const totalQty = staffOrdersQty(orders);
  const totalAmount = staffOrdersTotal(orders);
  const avgPerOrder = staffSaleAvgPerOrder(totalAmount, totalQty);

  for (const order of orders) {
    if (multi) lines.push(`▪ ${order.sectionName || '—'}`);
    for (const it of order.items || []) {
      const name = lang === 'en'
        ? (it.product?.nameEn || it.product?.nameAr || '—')
        : (it.product?.nameAr || it.product?.nameEn || '—');
      const q = Number(it.quantity);
      const prefix = multi ? '  ' : '';
      const unitPrice = resolveStaffItemUnitPrice(it);
      if (unitPrice.gt(0)) {
        const amount = staffItemLineAmount(it);
        const variant = formatVariantLabel(it.size, it.packaging, it.unit);
        const variantPart = variant ? ` (${variant})` : '';
        lines.push(
          `${prefix}• ${name}${variantPart}: ${fmtStaffWaMoney(q)} × ${fmtStaffWaMoney(unitPrice.toNumber())} = ${fmtStaffWaMoney(amount)} SR`,
        );
      } else {
        lines.push(`${prefix}• ${name}: ${q}`);
      }
    }
    if (multi) lines.push('');
  }

  lines.push('──────────────');
  lines.push(lang === 'en' ? `Total qty: ${totalQty}` : `إجمالي الكمية: ${totalQty}`);
  if (totalAmount.gt(0)) {
    lines.push(lang === 'en' ? `Grand total: ${fmtStaffWaMoney(totalAmount)} SR` : `المجموع: ${fmtStaffWaMoney(totalAmount)} SR`);
    if (totalQty > 0) {
      lines.push(
        lang === 'en'
          ? `Avg per order: ${fmtStaffWaMoney(avgPerOrder)} SR`
          : `معدل الطلب: ${fmtStaffWaMoney(avgPerOrder)} SR`,
      );
    }
  }
  const notes = orders[0]?.notes?.trim();
  if (notes) {
    lines.push(lang === 'en' ? `Notes: ${notes}` : `ملاحظات: ${notes}`);
  }
  const by = orders[0]?.user?.nameAr || orders[0]?.user?.nameEn;
  if (by) lines.push(lang === 'en' ? `By: ${by}` : `بواسطة: ${by}`);
  return lines.join('\n').trim();
}

/** بناء نص واتساب من الطلبات المعلّقة (للمندوب — مع أسعار ومجموع) */
export function buildStaffPurchaseWhatsAppText(
  sections: { sectionName: string; orders: any[] }[],
  date: string,
  lang: 'ar' | 'en' = 'ar',
  grandTotal?: Prisma.Decimal,
): string {
  const header = lang === 'en' ? `Purchase list — ${date}` : `قائمة مشتريات — ${date}`;
  const lines: string[] = [header, ''];
  let running = new Prisma.Decimal(0);

  for (const sec of sections) {
    lines.push(`▪ ${sec.sectionName}`);
    const itemMap = new Map<string, {
      name: string;
      qty: Prisma.Decimal;
      unit: string | null;
      size: string | null;
      packaging: string | null;
      unitPrice: Prisma.Decimal;
    }>();

    for (const order of sec.orders) {
      for (const it of order.items || []) {
        const v = resolveStaffItemVariant(it.product, {
          size: it.size,
          packaging: it.packaging,
          unit: it.unit,
          unitPrice: it.unitPrice != null ? String(it.unitPrice) : undefined,
        });
        const key = staffLineAggregateKey(it.productId, v.size, v.packaging, v.unit, v.unitPrice);
        const name = lang === 'en'
          ? (it.product?.nameEn || it.product?.nameAr || '—')
          : (it.product?.nameAr || it.product?.nameEn || '—');
        const q = new Prisma.Decimal(it.quantity || 0);
        const cur = itemMap.get(key);
        if (cur) {
          cur.qty = cur.qty.plus(q);
        } else {
          itemMap.set(key, {
            name,
            qty: q,
            unit: v.unit,
            size: v.size,
            packaging: v.packaging,
            unitPrice: v.unitPrice,
          });
        }
      }
    }

    for (const row of itemMap.values()) {
      const amount = row.qty.times(row.unitPrice);
      running = running.plus(amount);
      const variant = formatVariantLabel(row.size, row.packaging, row.unit);
      const variantPart = variant ? ` (${variant})` : '';
      const price = fmtStaffWaMoney(row.unitPrice);
      const amt = fmtStaffWaMoney(amount);
      lines.push(`  - ${row.name}${variantPart}: ${fmtStaffWaMoney(row.qty)} × ${price} = ${amt} SR`);
    }
    lines.push('');
  }

  const total = grandTotal ?? running;
  lines.push('──────────────');
  lines.push(
    lang === 'en'
      ? `Total: ${fmtStaffWaMoney(total)} SR`
      : `الإجمالي: ${fmtStaffWaMoney(total)} SR`,
  );
  return lines.join('\n').trim();
}
