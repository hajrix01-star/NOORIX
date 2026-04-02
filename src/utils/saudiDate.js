/**
 * saudiDate — تواريخ بتوقيت السعودية (Asia/Riyadh)
 * جميع التواريخ تُعرض بصيغة إنجليزية فقط (en-GB).
 */

const RIYADH_TZ = 'Asia/Riyadh';

/**
 * تاريخ اليوم بتوقيت الرياض بصيغة YYYY-MM-DD.
 * ملاحظة: لا نستخدم toLocaleString() + toISOString() لأن الأخيرة
 * تُعيد UTC دائماً وتتجاهل التحويل، مما يُعطي يوماً خاطئاً عند منتصف الليل.
 */
export function getSaudiToday() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: RIYADH_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

/**
 * كائن Date يُمثّل "الآن" بتوقيت الرياض.
 * مفيد للمقارنات الزمنية داخل التطبيق.
 */
export function nowSaudi() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: RIYADH_TZ }));
}

export function formatSaudiDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Riyadh',
  });
}

export function formatSaudiDateISO(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  if (!year || !month || !day) return '—';
  return `${year}-${month}-${day}`;
}
