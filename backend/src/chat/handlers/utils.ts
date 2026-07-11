/**
 * أدوات مشتركة للمعالجات
 */
export function normalizeQuery(q: string): string {
  return (q || '')
    .replace(/[\u064B-\u0652\u0670]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** مطابقة مرنة — تعمل مع العربية والإنجليزية */
export function matches(q: string, patterns: string[]): boolean {
  const lower = q.toLowerCase();
  return patterns.some((p) => lower.includes(p.toLowerCase()));
}

const MONTH_LABELS_AR = [
  '\u064a\u0646\u0627\u064a\u0631',
  '\u0641\u0628\u0631\u0627\u064a\u0631',
  '\u0645\u0627\u0631\u0633',
  '\u0623\u0628\u0631\u064a\u0644',
  '\u0645\u0627\u064a\u0648',
  '\u064a\u0648\u0646\u064a\u0648',
  '\u064a\u0648\u0644\u064a\u0648',
  '\u0623\u063a\u0633\u0637\u0633',
  '\u0633\u0628\u062a\u0645\u0628\u0631',
  '\u0623\u0643\u062a\u0648\u0628\u0631',
  '\u0646\u0648\u0641\u0645\u0628\u0631',
  '\u062f\u064a\u0633\u0645\u0628\u0631',
] as const;

const MONTH_TERMS = [
  ['\u064a\u0646\u0627\u064a\u0631', 'jan', 'january'],
  ['\u0641\u0628\u0631\u0627\u064a\u0631', 'feb', 'february'],
  ['\u0645\u0627\u0631\u0633', 'mar', 'march'],
  ['\u0627\u0628\u0631\u064a\u0644', '\u0623\u0628\u0631\u064a\u0644', 'apr', 'april'],
  ['\u0645\u0627\u064a\u0648', 'may'],
  ['\u064a\u0648\u0646\u064a\u0648', 'jun', 'june'],
  ['\u064a\u0648\u0644\u064a\u0648', 'jul', 'july'],
  ['\u0627\u063a\u0633\u0637\u0633', '\u0623\u063a\u0633\u0637\u0633', 'aug', 'august'],
  ['\u0633\u0628\u062a\u0645\u0628\u0631', 'sep', 'september'],
  ['\u0627\u0643\u062a\u0648\u0628\u0631', '\u0623\u0643\u062a\u0648\u0628\u0631', 'oct', 'october'],
  ['\u0646\u0648\u0641\u0645\u0628\u0631', 'nov', 'november'],
  ['\u062f\u064a\u0633\u0645\u0628\u0631', 'dec', 'december'],
] as const;

function buildFullMonthRange(monthOneBased: number, year: number) {
  const monthIndex = monthOneBased - 1;
  const start = new Date(year, monthIndex, 1, 0, 0, 0, 0);
  const end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
  return {
    start,
    end,
    labelAr: `${MONTH_LABELS_AR[monthIndex]} ${year}`,
    labelEn: `${start.toLocaleString('en', { month: 'long' })} ${year}`,
  };
}

function parseExplicitMonthRange(
  q: string,
  now: Date,
): { start: Date; end: Date; labelAr: string; labelEn: string } | null {
  const yearMatch = q.match(/\b(20\d{2})\b/);
  const selectedYear = yearMatch ? Number(yearMatch[1]) : now.getFullYear();
  const numericMonth =
    q.match(/(?:\u0634\u0647\u0631|\u0627\u0644\u0634\u0647\u0631|month)\s*(\d{1,2})(?:\s*(?:\u0639\u0627\u0645|\u0633\u0646\u0629|year)?\s*(20\d{2}))?/i) ??
    q.match(/\b(\d{1,2})[/-](20\d{2})\b/);

  if (numericMonth) {
    const month = Number(numericMonth[1]);
    const year = numericMonth[2] ? Number(numericMonth[2]) : selectedYear;
    if (month >= 1 && month <= 12) return buildFullMonthRange(month, year);
  }

  for (let index = 0; index < MONTH_TERMS.length; index += 1) {
    if (MONTH_TERMS[index].some((term) => q.includes(term))) {
      return buildFullMonthRange(index + 1, selectedYear);
    }
  }

  return null;
}

/**
 * من أول الشهر الحالي حتى نهاية أمس (أيام مكتملة فقط — لا يُحسب اليوم الجاري قبل اكتماله).
 * إن كان أمس في الشهر السابق (مثلاً يوم 1) يُرجع نطاقاً فارغاً عملياً (end قبل start) لعدم وجود يوم مكتمل في الشهر الحالي.
 */
export function monthToDateThroughYesterday(now: Date): { start: Date; end: Date; labelAr: string; labelEn: string } {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const start = new Date(y, m, 1, 0, 0, 0, 0);
  const yesterdayEnd = new Date(y, m, d - 1, 23, 59, 59, 999);
  if (yesterdayEnd < start) {
    return {
      start,
      end: new Date(start.getTime() - 1),
      labelAr: `هذا الشهر — لم يكتمل بعد أي يوم حتى أمس (${m + 1}/${y})`,
      labelEn: `This month — no completed day through yesterday yet (${m + 1}/${y})`,
    };
  }
  const de = yesterdayEnd.getDate();
  return {
    start,
    end: yesterdayEnd,
    labelAr: `هذا الشهر (من 1 إلى ${de}/${m + 1}/${y}، حتى أمس)`,
    labelEn: `This month (1–${de}/${m + 1}/${y}, through yesterday)`,
  };
}

/** مطابق لـ monthToDateThroughYesterday — للمعالجات التي تفترض «هذا الشهر» دون ذكر صريح (النسب، إلخ) */
export function thisMonthToDateRange(now: Date): { start: Date; end: Date; labelAr: string; labelEn: string } {
  return monthToDateThroughYesterday(now);
}

/** الشهر الحالي من اليوم 1 حتى نهاية اليوم — لمقارنة المبيعات مع الشهر الماضي لنفس رقم اليوم */
export function thisMonthThroughTodayRange(now: Date): { start: Date; end: Date; labelAr: string; labelEn: string } {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const start = new Date(y, m, 1, 0, 0, 0, 0);
  const end = new Date(y, m, d, 23, 59, 59, 999);
  return {
    start,
    end,
    labelAr: `الشهر الحالي (1–${d}/${m + 1}/${y}، حتى اليوم)`,
    labelEn: `This month (1–${d}/${m + 1}/${y}, through today)`,
  };
}

/** استخراج الفترة من السؤال — موسّع ليشمل أول أمس، الشهر الماضي، إلخ */
export function parsePeriod(
  q: string,
  now: Date,
): { start: Date; end: Date; labelAr: string; labelEn: string } | null {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  const explicitMonth = parseExplicitMonthRange(q, now);
  if (explicitMonth) return explicitMonth;

  /* «حتى أمس» ضمن سياق الشهر — لا يُفسَّر كيوم «أمس» كامل (يُطابق نص الأسئلة الجاهزة) */
  if (matches(q, ['حتى أمس', 'حتى امس', 'through yesterday'])) {
    return monthToDateThroughYesterday(now);
  }

  // أمس (يوم كامل)
  if (matches(q, ['أمس', 'امس', 'yesterday'])) {
    const start = new Date(y, m, d - 1, 0, 0, 0, 0);
    const end = new Date(y, m, d - 1, 23, 59, 59, 999);
    return { start, end, labelAr: 'أمس', labelEn: 'Yesterday' };
  }

  // أول أمس / قبل يومين
  if (matches(q, ['أول أمس', 'اول امس', 'قبل يومين', 'day before yesterday'])) {
    const start = new Date(y, m, d - 2, 0, 0, 0, 0);
    const end = new Date(y, m, d - 2, 23, 59, 59, 999);
    return { start, end, labelAr: 'أول أمس', labelEn: 'Day before yesterday' };
  }

  // هذا الأسبوع
  if (matches(q, ['هذا الأسبوع', 'هذا الاسبوع', 'الأسبوع', 'هذا الاسبوع', 'this week', 'week', 'اخر اسبوع', 'آخر أسبوع'])) {
    const day = now.getDay();
    const sun = d - (day === 0 ? 6 : day - 1);
    const start = new Date(y, m, sun, 0, 0, 0, 0);
    const end = new Date(y, m, d, 23, 59, 59, 999);
    return { start, end, labelAr: 'هذا الأسبوع', labelEn: 'This week' };
  }

  // الأسبوع الماضي
  if (matches(q, ['الأسبوع الماضي', 'الاسبوع الماضي', 'last week', 'قبل أسبوع', 'قبل اسبوع'])) {
    const day = now.getDay();
    const sun = d - (day === 0 ? 6 : day - 1);
    const start = new Date(y, m, sun - 7, 0, 0, 0, 0);
    const end = new Date(y, m, sun - 1, 23, 59, 59, 999);
    return { start, end, labelAr: 'الأسبوع الماضي', labelEn: 'Last week' };
  }

  // الشهر الماضي — قبل «هذا الشهر» حتى لا تُطابق كلمة «الشهر» داخل «الشهر الماضي»
  if (matches(q, ['الشهر الماضي', 'الشهر السابق', 'last month', 'قبل شهر'])) {
    const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
    const end = new Date(y, m, 0, 23, 59, 59, 999);
    return { start, end, labelAr: `الشهر الماضي (${m}/${y})`, labelEn: `Last month (${m}/${y})` };
  }

  // هذا الشهر — قبل «اليوم» حتى لا يُطابق «اليوم» داخل «حتى اليوم» قبل اعتبار الشهر
  if (
    matches(q, [
      'هذا الشهر',
      'هذا الشهر الحالي',
      'الشهر الحالي',
      'this month',
      'month',
      'اخر شهر',
      'آخر شهر',
      'الشهر',
    ])
  ) {
    return monthToDateThroughYesterday(now);
  }

  // اليوم
  if (matches(q, ['اليوم', 'today'])) {
    const start = new Date(y, m, d, 0, 0, 0, 0);
    const end = new Date(y, m, d, 23, 59, 59, 999);
    return { start, end, labelAr: 'اليوم', labelEn: 'Today' };
  }

  return null;
}

/**
 * الشهر الماضي من اليوم 1 حتى نفس رقم يوم الشهر الحالي (مقصور على طول الشهر السابق)
 * لمقارنة عادلة مع «هذا الشهر حتى اليوم».
 */
export function lastMonthPartialMatchingMtd(now: Date): { start: Date; end: Date; labelAr: string; labelEn: string } {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const daysInPrevMonth = new Date(y, m, 0).getDate();
  const cappedDay = Math.min(d, daysInPrevMonth);
  const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
  const end = new Date(y, m - 1, cappedDay, 23, 59, 59, 999);
  const pm = end.getMonth() + 1;
  const py = end.getFullYear();
  return {
    start,
    end,
    labelAr: `الشهر الماضي (1–${cappedDay}/${pm}/${py}، حتى نفس تاريخ اليوم في الشهر الحالي)`,
    labelEn: `Last month (1–${cappedDay}/${pm}/${py}, same calendar day as today)`,
  };
}
