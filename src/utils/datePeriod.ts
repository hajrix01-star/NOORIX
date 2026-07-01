export type DatePeriodMode = 'all' | 'day' | 'month' | 'months' | 'year' | 'range';

export type DatePeriodState = {
  mode: DatePeriodMode;
  selYear: number;
  selMonth: number;
  selDay: string;
  rangeStart: string;
  rangeEnd: string;
  monthRangeStartYear: number;
  monthRangeStartMonth: number;
  monthRangeEndYear: number;
  monthRangeEndMonth: number;
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
    return {
      startDate: saudiDayStart(ymd(state.selYear, 1, 1)),
      endDate: saudiDayEnd(ymd(state.selYear, 12, 31)),
    };
  }

  if (state.mode === 'month') {
    const last = lastDayOfMonth(state.selYear, state.selMonth);
    return {
      startDate: saudiDayStart(ymd(state.selYear, state.selMonth, 1)),
      endDate: saudiDayEnd(ymd(state.selYear, state.selMonth, last)),
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
    const day = state.selDay || ymd(now.year, now.month, now.day);
    return { startDate: saudiDayStart(day), endDate: saudiDayEnd(day) };
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
  if (state.mode === 'all') return '-';
  if (state.mode === 'year') return String(state.selYear);
  if (state.mode === 'month') return formatMonth(state.selYear, state.selMonth);
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
  if (state.mode === 'day') return formatDate(state.selDay || ymd(now.year, now.month, now.day));
  const range = resolveDatePeriodRange(state, now);
  return `${formatDate(range.startDate)} - ${formatDate(range.endDate)}`;
}
