/** تواريخ YYYY-MM-DD بمنطقة السعودية (إجازات/مسيرات) */

export function dateToSaudiYmd(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
}

export function saudiDateYmd(): string {
  return dateToSaudiYmd(new Date());
}

export function isSaudiYmdInLeaveRange(ymd: string, start: Date, end: Date): boolean {
  const s = dateToSaudiYmd(start);
  const e = dateToSaudiYmd(end);
  return ymd >= s && ymd <= e;
}

export function daysInclusiveBetweenSaudiYmd(startYmd: string, endYmd: string): number {
  const d0 = new Date(`${startYmd}T00:00:00.000Z`);
  const d1 = new Date(`${endYmd}T00:00:00.000Z`);
  if (d1 < d0) return 0;
  const n = Math.round((d1.getTime() - d0.getTime()) / 86400000) + 1;
  return Math.max(1, n);
}
