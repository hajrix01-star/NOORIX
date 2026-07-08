export type DatePeriodMode = 'all' | 'day' | 'month' | 'months' | 'quarter' | 'year' | 'range';

export type DatePeriodState = {
  mode: DatePeriodMode;
  selYear: number;
  selMonth: number;
  selQuarter: number;
  selDay: string;
  rangeStart: string;
  rangeEnd: string;
  monthRangeStartYear: number;
  monthRangeStartMonth: number;
  monthRangeEndYear: number;
  monthRangeEndMonth: number;
  yearRangeStart: number;
  yearRangeEnd: number;
};

export type DatePeriodNow = {
  year: number;
  month: number;
  day: number;
};

const MONTH_NAMES_EN = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function ymd(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function lastDayOfMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

export function saudiDayStart(dateStr: string) {
  return `${dateStr}T00:00:00+03:00`;
}

export function saudiDayEnd(dateStr: string) {
  return `${dateStr}T23:59:59+03:00`;
}

export function toYmdOnly(value: string | null | undefined) {
  return String(value || '').split('T')[0] || '';
}

export function compareYearMonth(yearA: number, monthA: number, yearB: number, monthB: number) {
  return yearA * 12 + monthA - (yearB * 12 + monthB);
}

export function normalizeMonthSpan(
  startYear: number,
  startMonth: number,
  endYear: number,
  endMonth: number,
) {
  if (compareYearMonth(startYear, startMonth, endYear, endMonth) <= 0) {
    return { startYear, startMonth, endYear, endMonth };
  }
  return {
    startYear: endYear,
    startMonth: endMonth,
    endYear: startYear,
    endMonth: startMonth,
  };
}

export function normalizeDateSpan(startDate: string, endDate: string) {
  const s = toYmdOnly(startDate);
  const e = toYmdOnly(endDate);
  if (!s && !e) return { startDate: '', endDate: '' };
  if (!s) return { startDate: e, endDate: e };
  if (!e) return { startDate: s, endDate: s };
  return s <= e ? { startDate: s, endDate: e } : { startDate: e, endDate: s };
}

export function normalizeYearSpan(startYear: number, endYear: number) {
  const start = Number.isFinite(startYear) ? startYear : endYear;
  const end = Number.isFinite(endYear) ? endYear : startYear;
  return start <= end
    ? { startYear: start, endYear: end }
    : { startYear: end, endYear: start };
}

export function normalizeQuarter(value: number) {
  const quarter = Math.trunc(Number(value));
  if (quarter < 1) return 1;
  if (quarter > 4) return 4;
  return quarter;
}

export function quarterStartMonth(quarter: number) {
  return (normalizeQuarter(quarter) - 1) * 3 + 1;
}

export function quarterEndMonth(quarter: number) {
  return quarterStartMonth(quarter) + 2;
}

export function listYearMonthsInRange(startDate: string, endDate: string) {
  const start = toYmdOnly(startDate);
  const end = toYmdOnly(endDate);
  if (!start || !end) return [];
  const s = start <= end ? start : end;
  const e = start <= end ? end : start;
  const [startYear, startMonth] = s.split('-').map(Number);
  const [endYear, endMonth] = e.split('-').map(Number);
  if (!startYear || !startMonth || !endYear || !endMonth) return [];
  const out: Array<{ year: number; month: number; key: string }> = [];
  let y = startYear;
  let m = startMonth;
  while (compareYearMonth(y, m, endYear, endMonth) <= 0) {
    out.push({ year: y, month: m, key: `${y}-${String(m).padStart(2, '0')}` });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

export function resolveDatePeriodRange(state: DatePeriodState, now: DatePeriodNow) {
  if (state.mode === 'all') {
    return {
      startDate: saudiDayStart('2020-01-01'),
      endDate: saudiDayEnd(ymd(now.year + 1, 12, 31)),
    };
  }

  if (state.mode === 'year') {
    const span = normalizeYearSpan(state.yearRangeStart || state.selYear, state.yearRangeEnd || state.selYear);
    return {
      startDate: saudiDayStart(ymd(span.startYear, 1, 1)),
      endDate: saudiDayEnd(ymd(span.endYear, 12, 31)),
    };
  }

  if (state.mode === 'month') {
    const last = lastDayOfMonth(state.selYear, state.selMonth);
    return {
      startDate: saudiDayStart(ymd(state.selYear, state.selMonth, 1)),
      endDate: saudiDayEnd(ymd(state.selYear, state.selMonth, last)),
    };
  }

  if (state.mode === 'quarter') {
    const quarter = normalizeQuarter(state.selQuarter || Math.ceil((state.selMonth || now.month) / 3));
    const startMonth = quarterStartMonth(quarter);
    const endMonth = quarterEndMonth(quarter);
    return {
      startDate: saudiDayStart(ymd(state.selYear, startMonth, 1)),
      endDate: saudiDayEnd(ymd(state.selYear, endMonth, lastDayOfMonth(state.selYear, endMonth))),
    };
  }

  if (state.mode === 'months') {
    const span = normalizeMonthSpan(
      state.monthRangeStartYear,
      state.monthRangeStartMonth,
      state.monthRangeEndYear,
      state.monthRangeEndMonth,
    );
    return {
      startDate: saudiDayStart(ymd(span.startYear, span.startMonth, 1)),
      endDate: saudiDayEnd(ymd(span.endYear, span.endMonth, lastDayOfMonth(span.endYear, span.endMonth))),
    };
  }

  if (state.mode === 'day') {
    const fallbackDay = state.selDay || ymd(now.year, now.month, now.day);
    const span = normalizeDateSpan(state.rangeStart || fallbackDay, state.rangeEnd || fallbackDay);
    return {
      startDate: saudiDayStart(span.startDate || fallbackDay),
      endDate: saudiDayEnd(span.endDate || fallbackDay),
    };
  }

  const fallbackStart = ymd(now.year, now.month, 1);
  const fallbackEnd = ymd(now.year, now.month, now.day);
  const s = state.rangeStart || fallbackStart;
  const e = state.rangeEnd || fallbackEnd;
  return {
    startDate: saudiDayStart(s <= e ? s : e),
    endDate: saudiDayEnd(s <= e ? e : s),
  };
}

function formatDate(value: string) {
  const ymdValue = toYmdOnly(value);
  const [year, month, day] = ymdValue.split('-');
  if (!year || !month || !day) return ymdValue || '-';
  return `${day}-${month}-${year}`;
}

function formatMonth(year: number, month: number) {
  return `${MONTH_NAMES_EN[month - 1] || String(month).padStart(2, '0')} ${year}`;
}

export function buildDatePeriodLabel(state: DatePeriodState, now: DatePeriodNow) {
  if (state.mode === 'all') return 'All';
  if (state.mode === 'year') {
    const span = normalizeYearSpan(state.yearRangeStart || state.selYear, state.yearRangeEnd || state.selYear);
    return span.startYear === span.endYear ? String(span.startYear) : `${span.startYear} - ${span.endYear}`;
  }
  if (state.mode === 'month') return formatMonth(state.selYear, state.selMonth);
  if (state.mode === 'quarter') {
    const quarter = normalizeQuarter(state.selQuarter || Math.ceil((state.selMonth || now.month) / 3));
    return `Q${quarter} ${state.selYear}`;
  }
  if (state.mode === 'months') {
    const span = normalizeMonthSpan(
      state.monthRangeStartYear,
      state.monthRangeStartMonth,
      state.monthRangeEndYear,
      state.monthRangeEndMonth,
    );
    if (span.startYear === span.endYear && span.startMonth === span.endMonth) {
      return formatMonth(span.startYear, span.startMonth);
    }
    return `${formatMonth(span.startYear, span.startMonth)} - ${formatMonth(span.endYear, span.endMonth)}`;
  }
  if (state.mode === 'day') {
    const fallbackDay = state.selDay || ymd(now.year, now.month, now.day);
    const span = normalizeDateSpan(state.rangeStart || fallbackDay, state.rangeEnd || fallbackDay);
    if (span.startDate && span.endDate && span.startDate !== span.endDate) {
      return `${formatDate(span.startDate)} - ${formatDate(span.endDate)}`;
    }
    return formatDate(span.startDate || fallbackDay);
  }
  const range = resolveDatePeriodRange(state, now);
  return `${formatDate(range.startDate)} - ${formatDate(range.endDate)}`;
}
