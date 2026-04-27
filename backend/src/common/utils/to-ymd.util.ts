/**
 * تقصير قيمة تاريخ/ISO إلى YYYY-MM-DD لمعاملات الـ API والاستعلامات.
 * متوافق مع واجهة `toYmd` في `src/utils/saudiDate.ts` (نصوص + `Date`)؛
 * لـ `Date` (Prisma أو الواجهة) يُستخدم يوم UTC من `toISOString`.
 * لعرض/إدخال بتقويم **Asia/Riyadh** في الواجهة استخدم `toDateInputYmd` في `saudiDate.ts` وليس افتراض UTC على كائنات `Date` القادمة من المستخدم.
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
