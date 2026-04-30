import Decimal from 'decimal.js';

export type TotalsByKindRow = { totalAmount?: unknown; invoiceCount?: number };

/**
 * يستخرج totalsByKind من استجابة period-analytics مع احتمال غلاف { data } إضافي
 * (parseResponse و getPeriodAnalytics قد يزيلان طبقة أو يتركان طبقة).
 */
export function unwrapTotalsByKind(raw: unknown): Record<string, TotalsByKindRow> | null {
  const tryOne = (o: unknown): Record<string, TotalsByKindRow> | null => {
    if (!o || typeof o !== 'object') return null;
    const rec = o as Record<string, unknown>;
    const tbk = rec.totalsByKind;
    if (tbk && typeof tbk === 'object' && !Array.isArray(tbk)) return tbk as Record<string, TotalsByKindRow>;
    return null;
  };

  const chain: unknown[] = [raw];
  if (raw && typeof raw === 'object') {
    const d = (raw as Record<string, unknown>).data;
    if (d != null) chain.push(d);
    if (d && typeof d === 'object') {
      const d2 = (d as Record<string, unknown>).data;
      if (d2 != null) chain.push(d2);
    }
  }

  for (const c of chain) {
    const out = tryOne(c);
    if (out) return out;
  }
  return null;
}

/** تحويل قيمة totalAmount من Prisma/JSON إلى Decimal */
export function decimalFromInvoiceTotal(v: unknown): Decimal | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) {
    try {
      const d = new Decimal(v);
      return d.isFinite() ? d : null;
    } catch {
      return null;
    }
  }
  if (typeof v === 'string') {
    const s = v.replace(/,/g, '').replace(/\s/g, '').trim();
    if (!s) return null;
    try {
      const d = new Decimal(s);
      return d.isFinite() ? d : null;
    } catch {
      return null;
    }
  }
  if (typeof v === 'object' && v !== null && 'toString' in v) {
    return decimalFromInvoiceTotal(String((v as { toString: () => string }).toString()));
  }
  return null;
}

/**
 * إجمالي رواتب الفترة فقط: مجموع totalAmount لفواتير النوع salary في totalsByKind
 * (نفس ما يعيده الخادم في groupBy — رقم واحد).
 */
export function salaryInvoiceTotalFromTotalsByKind(
  totalsByKind: Record<string, TotalsByKindRow> | null,
): Decimal | null {
  if (!totalsByKind) return null;
  const row = totalsByKind.salary;
  if (!row) return null;
  const d = decimalFromInvoiceTotal(row.totalAmount);
  if (d == null || !d.isFinite() || d.lte(0)) return null;
  return d;
}
