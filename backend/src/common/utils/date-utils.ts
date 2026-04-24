/**
 * date-utils — أدوات التاريخ بتوقيت المملكة (Asia/Riyadh UTC+3)
 *
 * يُستخدم `sv-SE` لأنها تُرجع صيغة ISO-like "YYYY-MM-DD HH:mm:ss" بدون AM/PM،
 * ويمكن لـ `Date` تحليلها بشكل موثوق. (`en-CA` مع Node قد يُرجع "a.m." فيفشل التحليل.)
 */
export function nowSaudi(): Date {
  try {
    const str = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Riyadh' });
    const d = new Date(str);
    if (Number.isNaN(d.getTime())) return new Date();
    return d;
  } catch {
    return new Date();
  }
}
