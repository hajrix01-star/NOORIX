import React, { useMemo, useState } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { getSaudiNow } from '../../utils/saudiDate';
import {
  buildDatePeriodLabel,
  type DatePeriodMode,
} from '../../utils/datePeriod';
import DateRangeField from './DateRangeField';
import { DayRangeCalendar, MonthRangeCalendar, YearRangeCalendar } from './PeriodCalendars';
import { DatePeriodActions, DatePeriodBadge, DatePeriodModeGroup, type DatePeriodModeOption } from './DatePeriodControls';
import {
  applyDatePeriodDraft,
  areDatePeriodStatesEqual,
  getDatePeriodModeChange,
  toDatePeriodUiMode,
  useDatePeriodDraft,
  type DatePeriodDraftFilter,
} from './datePeriodDraft';
import { getGregorianMonthNames, getGregorianWeekdayNames } from './dateLocale';

export type DateFilterBarProps = {
  filter: DatePeriodDraftFilter;
};

export default function DateFilterBar({ filter }: DateFilterBarProps) {
  const { t, lang } = useTranslation();
  const now = getSaudiNow();
  const years = useMemo(() => [now.year + 1, now.year, now.year - 1, now.year - 2, now.year - 3], [now.year]);
  const monthNames = useMemo(() => getGregorianMonthNames(lang), [lang]);
  const weekdayNames = useMemo(() => getGregorianWeekdayNames(lang), [lang]);
  const { draft, updateDraft } = useDatePeriodDraft(filter);
  const [openPanel, setOpenPanel] = useState<DatePeriodMode | null>(null);
  const mode = toDatePeriodUiMode(draft.mode);
  const draftLabel = buildDatePeriodLabel(draft, now);
  const isDirty = !areDatePeriodStatesEqual(filter.state, draft);

  const modeOptions = useMemo<DatePeriodModeOption[]>(() => [
    { id: 'all', label: t('dateFilterAll') },
    { id: 'month', label: t('dateFilterMonth') },
    { id: 'year', label: t('dateFilterYear') },
    { id: 'day', label: t('dateFilterDay') },
    { id: 'range', label: t('dateFilterRange') },
  ], [t]);

  const setMode = (nextMode: DatePeriodMode) => {
    const change = getDatePeriodModeChange(draft, nextMode, now);
    updateDraft(change.patch);
    setOpenPanel(change.openPanel);
  };

  const apply = () => {
    applyDatePeriodDraft(filter, draft);
    setOpenPanel(null);
  };

  const reset = () => {
    filter.reset();
    setOpenPanel(null);
  };

  return (
    <div className="noorix-date-filter-bar" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <DatePeriodModeGroup
        mode={mode}
        options={modeOptions}
        ariaLabel={t('dateFilterPeriod')}
        onModeChange={setMode}
      />

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

      {mode !== 'all' && <DatePeriodBadge label={draftLabel} pending={isDirty} />}

      <DatePeriodActions
        applyLabel={t('dateFilterApply')}
        resetLabel={t('dateFilterReset')}
        canApply={isDirty}
        onApply={apply}
        onReset={reset}
      />
    </div>
  );
}
