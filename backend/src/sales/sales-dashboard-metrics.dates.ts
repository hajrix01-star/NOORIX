import { toYmd } from '../common/utils/to-ymd.util';

export type YmdParts = {
  year: number;
  month: number;
  day: number;
};

export type MonthPeriodKey = {
  year: number;
  month: number;
  periodKey: string;
};

export function ymdParts(value: string): YmdParts | null {
  const ymd = toYmd(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const year = Number(ymd.slice(0, 4));
  const month = Number(ymd.slice(5, 7));
  const day = Number(ymd.slice(8, 10));
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  return { year, month, day };
}

export function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function monthKeysInRange(startDate: string, endDate: string): MonthPeriodKey[] {
  const start = ymdParts(startDate);
  const end = ymdParts(endDate);
  if (!start || !end) return [];
  const out: MonthPeriodKey[] = [];
  for (let year = start.year; year <= end.year; year += 1) {
    const fromMonth = year === start.year ? start.month : 1;
    const toMonth = year === end.year ? end.month : 12;
    for (let month = fromMonth; month <= toMonth; month += 1) {
      out.push({ year, month, periodKey: `${year}-${String(month).padStart(2, '0')}` });
    }
  }
  return out;
}
