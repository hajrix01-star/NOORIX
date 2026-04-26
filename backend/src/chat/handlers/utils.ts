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
