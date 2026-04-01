import { Prisma } from '@prisma/client';

/**
 * تحويل قيمة واردة (رقم/نص من JSON) إلى Decimal بدقة هللتين — يتجنب ضوضاء float.
 */
export function toMoneyDecimal2(value: unknown): Prisma.Decimal {
  if (value === null || value === undefined || value === '') {
    return new Prisma.Decimal(0);
  }
  const raw = typeof value === 'string' ? value.replace(/,/g, '').trim() : String(value);
  const n = parseFloat(raw);
  if (!Number.isFinite(n) || n < 0) {
    return new Prisma.Decimal(0);
  }
  return new Prisma.Decimal(Number(n.toFixed(2)).toString());
}
