/**
 * تطبيع مبالغ الرواتب/البدلات في الواجهة — يقلل ظهور كسور عشرية زائفة بعد JSON/parseFloat.
 */

/** تقريب إلى هللتين (مناسب للعملة السعودية). */
export function roundMoney2(value: unknown) {
  const n =
    typeof value === 'string' && value.trim() !== ''
      ? parseFloat(value.replace(/,/g, '').trim())
      : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Number.parseFloat(n.toFixed(2));
}

/** مقارنة مبلغين بعد التقريب (للمزامنة مع الخادم). */
export function moneyAmountsEqual(
  a: unknown,
  b: unknown,
) {
  return roundMoney2(a) === roundMoney2(b);
}

/**
 * نص مناسب لحقول المبالغ — يزيل ضوضاء مثل 500.0000000001 أو "500.0000".
 */
export function moneyFieldString(value: unknown) {
  if (value == null || value === '') return '';
  const s = String(value).trim();
  if (s === '') return '';
  const n = parseFloat(s.replace(/,/g, ''));
  if (!Number.isFinite(n)) return s;
  return String(roundMoney2(n));
}
