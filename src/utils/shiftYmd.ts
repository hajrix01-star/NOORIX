/**
 * إزاحة YMD بعدد أيام (توقيت الرياض) — معاينة في الواجهة.
 */
const RIYADH_TZ = 'Asia/Riyadh';

function ymdFromDateInRiyadh(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: RIYADH_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const y = parts.find((p) => p.type === 'year')?.value ?? '';
  const m = parts.find((p) => p.type === 'month')?.value ?? '';
  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  return `${y}-${m}-${day}`;
}

export function shiftYmd(ymd: string, days: number): string {
  if (!days || !ymd) return ymd;
  const [y, m, d] = ymd.split('-').map((x) => parseInt(x, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return ymd;
  const base = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  base.setUTCDate(base.getUTCDate() + days);
  return ymdFromDateInRiyadh(base);
}
