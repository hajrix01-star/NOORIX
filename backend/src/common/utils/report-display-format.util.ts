import Decimal from 'decimal.js';

/**
 * عرض مبالغ التقارير والبطاقات: بدون كسور عشرية (تقريب إلى أقرب ريال).
 */
export function formatReportMoneyInteger(value: Decimal | number | string | null | undefined): string {
  const normalized =
    typeof value === 'string' ? value.replace(/,/g, '').trim() : value === null || value === undefined ? 0 : value;
  const d = normalized instanceof Decimal ? normalized : new Decimal(normalized === '' ? 0 : String(normalized));
  if (!d.isFinite()) return '0';
  /** بدون فواصل آلاف — القيم تُعرَّف في الواجهة عبر `fmt` لتجنّب parseFloat("10,000") === 10 */
  return Math.round(d.toNumber()).toLocaleString('en', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    useGrouping: false,
  });
}

/** مبالغ ضريبية للعرض في التقارير/API: خانة عشرية كحد أقصى مع فواصل آلاف. */
export function formatReportTaxAmount(value: Decimal | number | string | null | undefined): string {
  const normalized =
    typeof value === 'string' ? value.replace(/,/g, '').trim() : value === null || value === undefined ? 0 : value;
  const d = normalized instanceof Decimal ? normalized : new Decimal(normalized === '' ? 0 : String(normalized));
  if (!d.isFinite()) return '0';
  const n = d.toNumber();
  const rounded = Math.round(n * 10) / 10;
  if (Object.is(rounded, -0)) return '0';
  return rounded.toLocaleString('en', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
}

/**
 * عرض نسب مئوية (0–100): خانة عشرية كحد أقصى، بدون .0 للأعداد الصحيحة.
 */
export function formatReportPercentNumber(value: Decimal | number | string | null | undefined): string {
  const n = value instanceof Decimal ? value.toNumber() : Number(value);
  if (!Number.isFinite(n)) return '0';
  const rounded = Math.round(n * 10) / 10;
  if (Object.is(rounded, -0)) return '0';
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(1);
}
