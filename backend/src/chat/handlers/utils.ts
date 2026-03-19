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

/** استخراج الفترة من السؤال — موسّع ليشمل أول أمس، الشهر الماضي، إلخ */
export function parsePeriod(
  q: string,
  now: Date,
): { start: Date; end: Date; labelAr: string; labelEn: string } | null {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  // اليوم
  if (matches(q, ['اليوم', 'today'])) {
    const start = new Date(y, m, d, 0, 0, 0, 0);
    const end = new Date(y, m, d, 23, 59, 59, 999);
    return { start, end, labelAr: 'اليوم', labelEn: 'Today' };
  }

  // أمس
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

  // هذا الشهر
  if (matches(q, ['هذا الشهر', 'الشهر', 'هذا الشهر الحالي', 'الشهر الحالي', 'this month', 'month', 'اخر شهر', 'آخر شهر'])) {
    const start = new Date(y, m, 1, 0, 0, 0, 0);
    const end = new Date(y, m, d, 23, 59, 59, 999);
    return { start, end, labelAr: `هذا الشهر (${m + 1}/${y})`, labelEn: `This month (${m + 1}/${y})` };
  }

  // الشهر الماضي
  if (matches(q, ['الشهر الماضي', 'الشهر السابق', 'last month', 'قبل شهر'])) {
    const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
    const end = new Date(y, m, 0, 23, 59, 59, 999);
    return { start, end, labelAr: `الشهر الماضي (${m}/${y})`, labelEn: `Last month (${m}/${y})` };
  }

  return null;
}
