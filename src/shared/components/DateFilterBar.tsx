import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { useDateFilter } from '../../hooks/useDateFilter';
import { Button, DateRangeField } from '../../ui';
import {
  DayRangeCalendar,
  DateFilterMonthPicker,
  MonthRangeCalendar,
  YearRangeCalendar,
  type DateFilterMonthPickerProps,
} from '../../ui/date';
import { getSaudiNow } from '../../utils/saudiDate';
import {
  buildDatePeriodLabel,
  ymd,
  type DatePeriodMode,
  type DatePeriodState,
} from '../../utils/datePeriod';

export { useDateFilter };
export { DateFilterMonthPicker };
export type { DateFilterMonthPickerProps };

const MONTH_NAMES_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAMES_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const WEEKDAY_NAMES_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_NAMES_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

function normalizeMode(mode: DatePeriodMode): DatePeriodMode {
  return mode === 'month' ? 'months' : mode;
}

function toUiMode(mode: DatePeriodMode): DatePeriodMode {
  return mode === 'months' ? 'month' : mode;
}

function cloneDateState(state: DatePeriodState): DatePeriodState {
  return {
    ...state,
    mode: normalizeMode(state.mode),
    yearRangeStart: state.yearRangeStart || state.selYear,
    yearRangeEnd: state.yearRangeEnd || state.selYear,
  };
}

function useDraftDateState(filter: any) {
  const [draft, setDraft] = useState<DatePeriodState>(() => cloneDateState(filter.state));

  useEffect(() => {
    setDraft(cloneDateState(filter.state));
  }, [filter.state]);

  const updateDraft = (patch: Partial<DatePeriodState>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  return { draft, updateDraft, setDraft };
}

function applyDraft(filter: any, draft: DatePeriodState) {
  filter.setMode(normalizeMode(draft.mode));
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

export default function DateFilterBar({ filter }: any) {
  const { t, lang } = useTranslation();
  const now = getSaudiNow();
  const years = useMemo(() => [now.year + 1, now.year, now.year - 1, now.year - 2, now.year - 3], [now.year]);
  const monthNames = lang === 'ar' ? MONTH_NAMES_AR : MONTH_NAMES_EN;
  const weekdayNames = lang === 'ar' ? WEEKDAY_NAMES_AR : WEEKDAY_NAMES_EN;
  const { draft, updateDraft } = useDraftDateState(filter);
  const [openPanel, setOpenPanel] = useState<DatePeriodMode | null>(null);
  const mode = toUiMode(draft.mode);
  const draftLabel = buildDatePeriodLabel(draft, now);
  const isDirty = JSON.stringify(cloneDateState(filter.state)) !== JSON.stringify(draft);

  const setMode = (nextMode: DatePeriodMode) => {
    const normalized = normalizeMode(nextMode);
    if (normalized === 'day') {
      const day = draft.selDay || ymd(now.year, now.month, now.day);
      updateDraft({ mode: normalized, rangeStart: day, rangeEnd: day });
      setOpenPanel('day');
      return;
    }
    if (normalized === 'year') {
      const year = draft.yearRangeStart || draft.selYear || now.year;
      updateDraft({ mode: normalized, selYear: year, yearRangeStart: year, yearRangeEnd: draft.yearRangeEnd || year });
      setOpenPanel('year');
      return;
    }
    updateDraft({ mode: normalized });
    setOpenPanel(nextMode === 'all' ? null : nextMode);
  };

  const apply = () => {
    applyDraft(filter, draft);
    setOpenPanel(null);
  };

  const reset = () => {
    filter.reset();
    setOpenPanel(null);
  };

  return (
    <div className="noorix-date-filter-bar" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="ndfb-mode-group" role="group" aria-label={t('dateFilterPeriod')}>
        {[
          { id: 'all', label: t('dateFilterAll') },
          { id: 'month', label: t('dateFilterMonth') },
          { id: 'year', label: t('dateFilterYear') },
          { id: 'day', label: t('dateFilterDay') },
          { id: 'range', label: t('dateFilterRange') },
        ].map((item) => (
          <Button
            key={item.id}
            type="button"
            size="auto"
            variant="raw"
            className={`ndfb-mode-btn${mode === item.id ? ' ndfb-mode-btn--active' : ''}`}
            aria-pressed={mode === item.id}
            onClick={() => setMode(item.id as DatePeriodMode)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      {mode === 'month' && openPanel === 'month' && (
        <MonthRangeCalendar
          draft={draft}
          monthNames={monthNames}
          years={years}
          updateDraft={updateDraft}
          yearLabel={t('dateFilterYear')}
        />
      )}

      {mode === 'year' && openPanel === 'year' && (
        <YearRangeCalendar
          draft={draft}
          years={years}
          updateDraft={updateDraft}
          yearLabel={t('dateFilterYear')}
        />
      )}

      {mode === 'day' && openPanel === 'day' && (
        <DayRangeCalendar
          draft={draft}
          monthNames={monthNames}
          weekdayNames={weekdayNames}
          years={years}
          updateDraft={updateDraft}
          yearLabel={t('dateFilterYear')}
          monthLabel={t('dateFilterMonth')}
        />
      )}

      {mode === 'range' && (
        <DateRangeField
          className="ndfb-fields ndfb-fields--range"
          separatorClassName="ndfb-range-separator"
          startContainerClassName="ndfb-field ndfb-field--date"
          endContainerClassName="ndfb-field ndfb-field--date"
          startValue={draft.rangeStart}
          endValue={draft.rangeEnd}
          minEnd={draft.rangeStart}
          onStartChange={(value) => updateDraft({ rangeStart: value })}
          onEndChange={(value) => updateDraft({ rangeEnd: value })}
          startAriaLabel={t('dateFilterFrom')}
          endAriaLabel={t('dateFilterTo')}
        />
      )}

      {mode !== 'all' && (
        <span className={`ndfb-period-badge${isDirty ? ' ndfb-period-badge--pending' : ''}`} title={draftLabel}>
          {draftLabel}
        </span>
      )}

      <div className="ndfb-actions">
        <Button
          type="button"
          size="sm"
          variant="primary"
          className="ndfb-apply-btn"
          onClick={apply}
          disabled={!isDirty}
        >
          {t('dateFilterApply')}
        </Button>
        <Button
          type="button"
          size="auto"
          variant="raw"
          className="ndfb-reset-btn"
          onClick={reset}
          title={t('dateFilterReset')}
          aria-label={t('dateFilterReset')}
        >
          ↺
        </Button>
      </div>
    </div>
  );
}
