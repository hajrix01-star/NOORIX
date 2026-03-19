/**
 * date-utils — أدوات التاريخ بتوقيت المملكة (Asia/Riyadh UTC+3)
 */
export function nowSaudi(): Date {
  try {
    const str = new Date().toLocaleString('en-CA', { timeZone: 'Asia/Riyadh' });
    const d = new Date(str);
    if (Number.isNaN(d.getTime())) return new Date();
    return d;
  } catch {
    return new Date();
  }
}
