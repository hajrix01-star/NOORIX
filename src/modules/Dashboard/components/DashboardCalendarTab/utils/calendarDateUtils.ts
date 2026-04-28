/** Pure calendar helpers — moved as-is from DashboardCalendarTab */

export function lastDayOfMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

export function calendarYmd(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function getDayOfWeek(year: number, month: number, day: number) {
  return new Date(year, month - 1, day).getDay();
}

export function dateInRange(dateStr: string, fromDate: string | undefined, toDate: string | undefined) {
  if (!fromDate || !toDate) return false;
  return dateStr >= fromDate && dateStr <= toDate;
}
