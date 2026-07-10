import type { DashboardSpecialDay } from '../../../types/api/domains/dashboard';

export type DashboardSpecialDayDraft = Pick<DashboardSpecialDay, 'id' | 'name' | 'fromDate' | 'toDate' | 'color'>;

export function dashboardLastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function dashboardYmd(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function dashboardMonthFromYmd(value: string): number | null {
  const month = Number(value.slice(5, 7));
  return Number.isInteger(month) && month >= 1 && month <= 12 ? month : null;
}

export function splitDashboardSpecialDayByMonth(
  id: string,
  name: string,
  color: string,
  fromDate: string,
  toDate: string,
): DashboardSpecialDayDraft[] {
  const fromMonth = dashboardMonthFromYmd(fromDate);
  const toMonth = dashboardMonthFromYmd(toDate);
  const fromYear = Number(fromDate.slice(0, 4));
  const toYear = Number(toDate.slice(0, 4));

  if (!fromMonth || !toMonth || fromYear !== toYear || toDate < fromDate) {
    return [{ id, name, color, fromDate, toDate }];
  }

  const rows: DashboardSpecialDayDraft[] = [];
  for (let month = fromMonth; month <= toMonth; month += 1) {
    const segmentFrom = month === fromMonth ? fromDate : dashboardYmd(fromYear, month, 1);
    const segmentTo = month === toMonth ? toDate : dashboardYmd(fromYear, month, dashboardLastDayOfMonth(fromYear, month));
    rows.push({ id, name, color, fromDate: segmentFrom, toDate: segmentTo });
  }
  return rows;
}
