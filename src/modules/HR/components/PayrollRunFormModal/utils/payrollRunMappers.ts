export function parseDeferredMonth(notes: unknown) {
  const m = String(notes || '').match(/\[ADV_DEFER\]\s*(\d{4}-\d{2})/);
  return m ? m[1] : '';
}

export function extractAdvanceDates(notes: unknown) {
  return String(notes || '').replace('تواريخ السلف:', '').trim();
}

/** إزالة وسم تأجيل خصم السلف من ملاحظات سطر المسيرة (للعرض/الحفظ) */
export function stripPayrollAdvDeferSegment(notes: unknown) {
  return String(notes || '')
    .replace(/\s*\[ADV_DEFER\]\s*\d{4}-\d{2}\s*/g, '')
    .replace(/^\s*\|\s*/g, '')
    .replace(/\s*\|\s*$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function withPayrollAdvDeferSegment(notes: unknown, monthYm: string) {
  const base = stripPayrollAdvDeferSegment(notes);
  const tag = `[ADV_DEFER] ${monthYm}`;
  if (!base) return tag;
  return `${base} | ${tag}`;
}

export function getDefaultPayrollMonth() {
  const base = new Date();
  base.setDate(1);
  base.setMonth(base.getMonth() - 1);
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-01`;
}

export function monthRange(dateStr: string) {
  const start = new Date(dateStr);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  end.setDate(0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function ceilAmount(value: unknown) {
  return Math.max(0, Math.ceil(Number(value) || 0));
}
