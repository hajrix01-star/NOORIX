/**
 * تحويل قيمة علم شركة (boolean) من API/نموذج إلى boolean صريح.
 * يمنع أخطاء مثل اعتبار النص "false" قيمة truthy عبر !!value.
 */
export function coerceCompanyBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1' || value === 'true') return true;
  if (value === 0 || value === '0' || value === 'false') return false;
  return fallback;
}
