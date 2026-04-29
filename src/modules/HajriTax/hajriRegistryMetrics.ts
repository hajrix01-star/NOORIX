/**
 * أعمدة السجل — استخراج أرقام الإفصاح وحالة «تم التقديم» من صف VatPlanningQuarter.
 */
import {
  computeInputTotal,
  computeOutputTotal,
  defaultDisclosureData,
  getRowValue,
} from '../../constants/taxDisclosure';

export function registryPayload(row: any) {
  return row.payload && typeof row.payload === 'object' ? row.payload : defaultDisclosureData();
}

export function registrySalesAmount(payload: any) {
  return getRowValue(payload, 'standard_sales', 'amount');
}

export function registryPurchasesAmount(payload: any) {
  return getRowValue(payload, 'standard_purchases', 'amount');
}

export function registryOutputVat(payload: any) {
  return computeOutputTotal(payload);
}

export function registryInputVat(payload: any) {
  return computeInputTotal(payload);
}

/** تسميات قابلة للتمييز عند تكرار اسم الشركة في القائمة (معرفان مختلفان بنفس الاسم التجاري). */
export function buildCompanyFilterSelectOptions(
  items: Array<{
    id: string;
    nameAr?: string;
    nameEn?: string | null;
    taxNumber?: string | null;
  }>,
  lang: string,
): Array<{ id: string; label: string }> {
  const baseLabel = (c: any) =>
    String(lang === 'en' ? (c.nameEn || c.nameAr || '') : (c.nameAr || c.nameEn || '')).trim();

  const counts = new Map<string, number>();
  items.forEach((c) => {
    const k = baseLabel(c);
    if (k) counts.set(k, (counts.get(k) || 0) + 1);
  });

  return items.map((c) => {
    const base = baseLabel(c);
    const dup = Boolean(base && (counts.get(base) || 0) > 1);
    let label = base || String(c.id);
    if (dup) {
      const tn = String(c.taxNumber || '').trim();
      if (tn) label = `${base} (${tn})`;
      else label = `${base} · ${String(c.id).slice(-6)}`;
    }
    return { id: c.id, label };
  });
}

/** يُعرض «تم التقديم» إذا وُجدت إشارة في الملاحظات أو لقطة المصدر أو زرع الأرشيف */
export function isHajriDeclarationSubmitted(row: any): boolean {
  const notes = row.notes || '';
  if (/مقدَّم|مقدم|تم التقديم|submitted|filed/i.test(notes)) return true;
  const ss = row.sourceSnapshot;
  if (ss && typeof ss === 'object') {
    if (ss.submitted === true) return true;
    if (ss.source === 'seed-vat-planning-history') return true;
  }
  return false;
}
