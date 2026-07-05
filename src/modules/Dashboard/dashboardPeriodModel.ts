export type DashboardPeriodFilter = {
  year: number;
  selectedMonth: number | null;
  label: string;
};

export function buildDashboardYearOptions(currentYear: number, count = 3): number[] {
  const safeCount = Math.max(1, Math.floor(count));
  return Array.from({ length: safeCount }, (_, index) => currentYear - index);
}

export function parseDashboardMonthValue(month: string | number | null | undefined): number | null {
  const raw = String(month ?? '').trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 12 ? parsed : null;
}

export function buildDashboardPeriodFilter(
  year: number,
  selectedMonth: number | null,
  monthNames: string[],
): DashboardPeriodFilter {
  const safeMonth = selectedMonth != null && selectedMonth >= 1 && selectedMonth <= 12 ? selectedMonth : null;
  return {
    year,
    selectedMonth: safeMonth,
    label: safeMonth ? `${monthNames[safeMonth - 1] || safeMonth} ${year}` : String(year),
  };
}
