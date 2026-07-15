import type { ReportPeriodMode } from './reportTypes';
import type { ComparisonColumnPeriod } from './reportsComparablePeriodModel';

export type AccountingMonthPeriod = {
  year: number;
  month: number;
};

export type AccountingQuarterPeriod = {
  year: number;
  quarter: number;
};

export type AccountingPeriodSelection = {
  mode: ReportPeriodMode;
  anchorYear: number;
  selectedMonthPeriods: AccountingMonthPeriod[];
  selectedQuarterPeriods: AccountingQuarterPeriod[];
  selectedYears: number[];
};

export function buildAccountingPeriodColumns({
  selection,
  monthNames,
  quarterLabel,
}: {
  selection: AccountingPeriodSelection;
  monthNames: string[];
  quarterLabel: string;
}): ComparisonColumnPeriod[] {
  if (selection.mode === 'year') {
    return selection.selectedYears.map((itemYear) => ({
      key: `year-${itemYear}`,
      label: String(itemYear),
      period: {
        mode: 'year',
        year: itemYear,
        month: null,
        monthStart: 1,
        monthEnd: 12,
      },
    }));
  }

  if (selection.mode === 'quarter') {
    return selection.selectedQuarterPeriods.map((item) => {
      const start = (item.quarter - 1) * 3 + 1;
      return {
        key: `quarter-${item.year}-${item.quarter}`,
        label: `${quarterLabel} ${item.quarter} ${item.year}`,
        period: {
          mode: 'quarter',
          year: item.year,
          month: null,
          monthStart: start,
          monthEnd: start + 2,
        },
      };
    });
  }

  return selection.selectedMonthPeriods.map((item) => ({
    key: `month-${item.year}-${item.month}`,
    label: `${monthNames[item.month - 1] || item.month} ${item.year}`,
    period: {
      mode: 'month',
      year: item.year,
      month: item.month,
      monthStart: item.month,
      monthEnd: item.month,
    },
  }));
}

export function getAccountingPeriodYears(selection: AccountingPeriodSelection) {
  const years = new Set<number>([selection.anchorYear]);
  if (selection.mode === 'month') {
    selection.selectedMonthPeriods.forEach((item) => years.add(item.year));
  } else if (selection.mode === 'quarter') {
    selection.selectedQuarterPeriods.forEach((item) => years.add(item.year));
  } else {
    selection.selectedYears.forEach((itemYear) => years.add(itemYear));
  }
  return Array.from(years).sort((a, b) => b - a);
}

export function toggleAccountingMonthPeriod({
  periods,
  itemYear,
  month,
  anchorYear,
}: {
  periods: AccountingMonthPeriod[];
  itemYear: number;
  month: number;
  anchorYear: number;
}) {
  const exists = periods.some((item) => item.year === itemYear && item.month === month);
  const next = exists
    ? periods.filter((item) => !(item.year === itemYear && item.month === month))
    : [...periods, { year: itemYear, month }];
  return sortMonthPeriods(next.length > 0 ? next : [{ year: itemYear, month }], anchorYear);
}

export function toggleAccountingFullYearMonths({
  periods,
  itemYear,
  anchorYear,
}: {
  periods: AccountingMonthPeriod[];
  itemYear: number;
  anchorYear: number;
}) {
  const allMonths = Array.from({ length: 12 }, (_, index) => index + 1);
  const hasFullYear = allMonths.every((month) => periods.some((item) => item.year === itemYear && item.month === month));
  const next = hasFullYear
    ? periods.filter((item) => item.year !== itemYear)
    : [
        ...periods.filter((item) => item.year !== itemYear),
        ...allMonths.map((month) => ({ year: itemYear, month })),
      ];
  return sortMonthPeriods(next.length > 0 ? next : allMonths.map((month) => ({ year: itemYear, month })), anchorYear);
}

export function toggleAccountingQuarterPeriod({
  periods,
  itemYear,
  quarter,
  anchorYear,
}: {
  periods: AccountingQuarterPeriod[];
  itemYear: number;
  quarter: number;
  anchorYear: number;
}) {
  const key = `${itemYear}:${quarter}`;
  const exists = periods.some((item) => `${item.year}:${item.quarter}` === key);
  const next = exists
    ? periods.filter((item) => `${item.year}:${item.quarter}` !== key)
    : [...periods, { year: itemYear, quarter }];
  return sortQuarterPeriods(next.length > 0 ? next : [{ year: itemYear, quarter }], anchorYear);
}

export function toggleAccountingYearPeriod({
  years,
  itemYear,
  anchorYear,
}: {
  years: number[];
  itemYear: number;
  anchorYear: number;
}) {
  const next = years.includes(itemYear)
    ? years.filter((value) => value !== itemYear)
    : [...years, itemYear];
  return sortYears(next.length > 0 ? next : [itemYear], anchorYear);
}

export function ensureAnchorMonthPeriod(
  periods: AccountingMonthPeriod[],
  anchorYear: number,
  fallbackMonth: number,
) {
  const clean = periods.filter((item) => isValidMonth(item.month));
  return clean.some((item) => item.year === anchorYear) ? clean : [{ year: anchorYear, month: fallbackMonth }, ...clean];
}

export function ensureAnchorQuarterPeriod(
  periods: AccountingQuarterPeriod[],
  anchorYear: number,
  fallbackQuarter: number,
) {
  const clean = periods.filter((item) => item.quarter >= 1 && item.quarter <= 4);
  return clean.some((item) => item.year === anchorYear) ? clean : [{ year: anchorYear, quarter: fallbackQuarter }, ...clean];
}

export function sortMonthPeriods(periods: AccountingMonthPeriod[], anchorYear: number) {
  const seen = new Set<string>();
  const unique = periods.filter((item) => {
    const key = `${item.year}:${item.month}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return [...unique].sort((a, b) => {
    if (a.year === anchorYear && b.year !== anchorYear) return -1;
    if (a.year !== anchorYear && b.year === anchorYear) return 1;
    return a.year === b.year ? a.month - b.month : b.year - a.year;
  });
}

export function sortQuarterPeriods(periods: AccountingQuarterPeriod[], anchorYear: number) {
  const seen = new Set<string>();
  const unique = periods.filter((item) => {
    const key = `${item.year}:${item.quarter}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return [...unique].sort((a, b) => {
    if (a.year === anchorYear && b.year !== anchorYear) return -1;
    if (a.year !== anchorYear && b.year === anchorYear) return 1;
    return a.year === b.year ? a.quarter - b.quarter : b.year - a.year;
  });
}

export function sortYears(years: number[], anchorYear: number) {
  return [...new Set(years)].sort((a, b) => {
    if (a === anchorYear && b !== anchorYear) return -1;
    if (a !== anchorYear && b === anchorYear) return 1;
    return b - a;
  });
}

function isValidMonth(month: number) {
  return month >= 1 && month <= 12;
}
