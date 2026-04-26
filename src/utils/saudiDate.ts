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
/**
 * أجزاء سنة/شهر/يوم اليوم في توقيت الرياض — للواجهات (فلاتر، داشبورد).
 * يستعمل en-CA + formatToParts (آمن مثل getSaudiToday).
 */
export function getSaudiDateParts() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: RIYADH_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const m = parts.reduce<Record<string, string>>(
    (a, p) => (p.type !== 'literal' ? { ...a, [p.type]: p.value } : a),
    {},
  );
  return {
    year: parseInt(m.year, 10),
    month: parseInt(m.month, 10),
    day: parseInt(m.day, 10),
  };
}

/** @returns {{ year: number, month: number, day: number }} — مثل getSaudiDateParts */
export function getSaudiNow() {
  return getSaudiDateParts();
}

/** السنة والشهر الحاليان (تقريباً) بتوقيت الرياض */
export function getSaudiYearMonth() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: RIYADH_TZ,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());
  const o: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== 'literal') o[p.type] = p.value;
  }
  return { year: parseInt(o.year, 10), month: parseInt(o.month, 10) };
}

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

export function formatSaudiDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: RIYADH_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const year  = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day   = parts.find((p) => p.type === 'day')?.value;
  if (!year || !month || !day) return '—';
  return `${day}-${month}-${year}`;
}

/**
 * اسم يوم الأسبوع (طويل) بتوقيت الرياض — للعربية أو الإنجليزية.
 */
export function formatSaudiWeekdayName(value, lang = 'ar') {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  const locale = lang === 'en' ? 'en-US' : 'ar-SA';
  return new Intl.DateTimeFormat(locale, {
    timeZone: RIYADH_TZ,
    weekday: 'long',
  }).format(d);
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

/**
 * لـ `input type="date"`: YYYY-MM-DD بتوقيت الرياض، أو '' عند عدم التوفر/الصحة.
 */
export function toDateInputYmd(value) {
  if (value == null || value === '') return '';
  const s = formatSaudiDateISO(value);
  return s === '—' ? '' : s;
}

/** تاريخ + وقت بتوقيت الرياض — عرض موحّد (يتفادى اختلاف Samsung/default locale) */
export function formatSaudiDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: RIYADH_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const year   = parts.find((p) => p.type === 'year')?.value;
  const month  = parts.find((p) => p.type === 'month')?.value;
  const day    = parts.find((p) => p.type === 'day')?.value;
  const hour   = parts.find((p) => p.type === 'hour')?.value;
  const minute = parts.find((p) => p.type === 'minute')?.value;
  if (!year || !month || !day) return '—';
  return `${day}-${month}-${year} ${hour}:${minute}`;
}
