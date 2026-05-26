import { toDateInputYmd } from '../../utils/saudiDate';

export function addCalendarDaysYmd(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split('-').map((x) => parseInt(x, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return ymd;
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  if (isNaN(dt.getTime())) return ymd;
  return toDateInputYmd(dt) || ymd;
}
