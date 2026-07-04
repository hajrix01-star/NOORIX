import { useEffect, useState } from 'react';
import {
  type DatePeriodMode,
  type DatePeriodState,
} from '../../utils/datePeriod';

export type DatePeriodDraftFilter = {
  state: DatePeriodState;
  setMode: (mode: DatePeriodMode) => void;
  setSelYear: (year: number) => void;
  setSelMonth: (month: number) => void;
  setSelDay: (day: string) => void;
  setRangeStart: (date: string) => void;
  setRangeEnd: (date: string) => void;
  setMonthRangeStartYear: (year: number) => void;
  setMonthRangeStartMonth: (month: number) => void;
  setMonthRangeEndYear: (year: number) => void;
  setMonthRangeEndMonth: (month: number) => void;
  setYearRangeStart?: (year: number) => void;
  setYearRangeEnd?: (year: number) => void;
  reset: () => void;
};

export function normalizeDatePeriodMode(mode: DatePeriodMode): DatePeriodMode {
  return mode === 'month' ? 'months' : mode;
}

export function toDatePeriodUiMode(mode: DatePeriodMode): DatePeriodMode {
  return mode === 'months' ? 'month' : mode;
}

export function cloneDatePeriodState(state: DatePeriodState): DatePeriodState {
  return {
    ...state,
    mode: normalizeDatePeriodMode(state.mode),
    yearRangeStart: state.yearRangeStart || state.selYear,
    yearRangeEnd: state.yearRangeEnd || state.selYear,
  };
}

export function areDatePeriodStatesEqual(first: DatePeriodState, second: DatePeriodState) {
  return JSON.stringify(cloneDatePeriodState(first)) === JSON.stringify(cloneDatePeriodState(second));
}

export function useDatePeriodDraft(filter: DatePeriodDraftFilter) {
  const [draft, setDraft] = useState<DatePeriodState>(() => cloneDatePeriodState(filter.state));

  useEffect(() => {
    setDraft(cloneDatePeriodState(filter.state));
  }, [filter.state]);

  const updateDraft = (patch: Partial<DatePeriodState>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  return { draft, updateDraft, setDraft };
}

export function applyDatePeriodDraft(filter: DatePeriodDraftFilter, draft: DatePeriodState) {
  filter.setMode(normalizeDatePeriodMode(draft.mode));
  filter.setSelYear(draft.selYear);
  filter.setSelMonth(draft.selMonth);
  filter.setSelDay(draft.selDay);
  filter.setRangeStart(draft.rangeStart);
  filter.setRangeEnd(draft.rangeEnd);
  filter.setMonthRangeStartYear(draft.monthRangeStartYear);
  filter.setMonthRangeStartMonth(draft.monthRangeStartMonth);
  filter.setMonthRangeEndYear(draft.monthRangeEndYear);
  filter.setMonthRangeEndMonth(draft.monthRangeEndMonth);
  filter.setYearRangeStart?.(draft.yearRangeStart || draft.selYear);
  filter.setYearRangeEnd?.(draft.yearRangeEnd || draft.selYear);
}
