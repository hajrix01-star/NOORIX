/**
 * saudiDate — تواريخ بتوقيت السعودية (Asia/Riyadh)
 *
 * - للحقول الرقمية الثابتة (DD-MM-YYYY، إلخ): دوال `formatSaudi*` على أساس en-GB/en-CA.
 * - للعرض حسب لغة الواجهة (عربي/إنجليزي) مع **أرقام لاتينية 0–9** دائماً: {@link formatUiDateTime}.
 */

const RIYADH_TZ = 'Asia/Riyadh';

/** خيارات `Intl` المشتركة: تقويم الرياض + أرقام لاتينية (لا أرقام عربية شرقية). */
const uiRiyadhLatin: Pick<Intl.DateTimeFormatOptions, 'timeZone' | 'numberingSystem'> = {
  timeZone: RIYADH_TZ,
  numberingSystem: 'latn',
};

type DateInputValue = unknown;
type DatePartType = Intl.DateTimeFormatPart['type'];

function partMap(parts: Intl.DateTimeFormatPart[]): Partial<Record<DatePartType, string>> {
  return parts.reduce<Partial<Record<DatePartType, string>>>((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});
}

function getPart(parts: Intl.DateTimeFormatPart[], type: DatePartType): string | undefined {
  return parts.find((part) => part.type === type)?.value;
}

function toValidDate(value: DateInputValue): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const d = new Date(value as string | number);
  return Number.isNaN(d.getTime()) ? null : d;
}

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
  const m = partMap(parts);
  return {
    year: parseInt(m.year ?? '', 10),
    month: parseInt(m.month ?? '', 10),
    day: parseInt(m.day ?? '', 10),
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
  const year = getPart(parts, 'year');
  const month = getPart(parts, 'month');
  const day = getPart(parts, 'day');
  return `${year}-${month}-${day}`;
}

export function formatSaudiDate(value: DateInputValue) {
  const d = toValidDate(value);
  if (!d) return '—';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: RIYADH_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const year = getPart(parts, 'year');
  const month = getPart(parts, 'month');
  const day = getPart(parts, 'day');
  if (!year || !month || !day) return '—';
  return `${day}-${month}-${year}`;
}

/**
 * اسم يوم الأسبوع (طويل) بتوقيت الرياض — للعربية أو الإنجليزية.
 */
export function formatSaudiWeekdayName(value: DateInputValue, lang: string = 'ar') {
  const d = toValidDate(value);
  if (!d) return '';
  const locale = lang === 'en' ? 'en-US' : 'ar-SA';
  return new Intl.DateTimeFormat(locale, {
    timeZone: RIYADH_TZ,
    weekday: 'long',
  }).format(d);
}

export function formatSaudiDateISO(value: DateInputValue) {
  const d = toValidDate(value);
  if (!d) return '—';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const year = getPart(parts, 'year');
  const month = getPart(parts, 'month');
  const day = getPart(parts, 'day');
  if (!year || !month || !day) return '—';
  return `${year}-${month}-${day}`;
}

/**
 * لـ `input type="date"`: YYYY-MM-DD بتوقيت الرياض، أو '' عند عدم التوفر/الصحة.
 */
export function toDateInputYmd(value: DateInputValue) {
  if (value == null || value === '') return '';
  const s = formatSaudiDateISO(value);
  return s === '—' ? '' : s;
}

/**
 * تقصير قيمة تاريخ/ISO إلى YYYY-MM-DD لمعاملات الـ API ومفاتيح التجميع.
 * للنصوص: أول 10 أحرف بعد trim (يفترض بادئة YMD أو ISO).
 * لـ `Date`: جزء التاريخ UTC — مطابق لسلوك `toYmd` في الخادم (`to-ymd.util.ts`).
 *
 * عندما يكون اليوم التقويمي المطلوب **بتوقيت الرياض** (مثل `input type="date"`): استخدم {@link toDateInputYmd} بدلاً من تمرير `Date` إلى هذه الدالة.
 */
export function toYmd(value: unknown): string {
  if (value == null || value === '') return '';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    return value.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  return s ? s.slice(0, 10) : '';
}

/** تاريخ + وقت بتوقيت الرياض — عرض موحّد (يتفادى اختلاف Samsung/default locale) */
export function formatSaudiDateTime(value: DateInputValue) {
  const d = toValidDate(value);
  if (!d) return '—';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: RIYADH_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const year = getPart(parts, 'year');
  const month = getPart(parts, 'month');
  const day = getPart(parts, 'day');
  const hour = getPart(parts, 'hour');
  const minute = getPart(parts, 'minute');
  if (!year || !month || !day) return '—';
  return `${day}-${month}-${year} ${hour}:${minute}`;
}

/** أسلوب عرض للواجهة: صف جدول / تفصيلي، أو مدمج (مثل اقتراح prompt الحفظ). */
export type UiDateTimeVariant = 'detailed' | 'compact';

/**
 * تاريخ ووقت للعرض حسب لغة الواجهة (`ar` → نص عربي بتقويم المستخدم، `en` → en-GB)،
 * دائماً بتوقيت الرياض وبأرقام لاتينية — مطابق لسياسة `money.ts` (لا أرقام هندية شرقية في الواجهة).
 *
 * @param value `Date` أو ISO؛ إذا غير صالح يُعاد النص الأصلي إن كان `string` وإلا `—`.
 */
export function formatUiDateTime(value: unknown, lang: string, variant: UiDateTimeVariant = 'detailed'): string {
  const d = value instanceof Date ? value : new Date(value as string | number);
  if (Number.isNaN(d.getTime())) {
    return typeof value === 'string' ? value : '—';
  }
  const isAr = lang === 'ar';
  const locale = isAr ? 'ar-SA' : 'en-GB';
  const dateStyle: Intl.DateTimeFormatOptions['dateStyle'] = variant === 'compact' ? 'short' : 'medium';
  const timeStyle: Intl.DateTimeFormatOptions['timeStyle'] = 'short';
  return new Intl.DateTimeFormat(locale, {
    ...uiRiyadhLatin,
    dateStyle,
    timeStyle,
  }).format(d);
}
