import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { getSaudiNow } from '../../utils/saudiDate';
import {
  buildDatePeriodLabel,
  type DatePeriodMode,
} from './datePeriod';
import DateRangeField from './DateRangeField';
import { DayRangeCalendar, MonthRangeCalendar, YearRangeCalendar } from './PeriodCalendars';
import { DatePeriodActions, DatePeriodBadge, DatePeriodModeGroup, type DatePeriodModeOption } from './DatePeriodControls';
import { cn } from '../cn';
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
  modes?: DatePeriodMode[];
  showBadge?: boolean;
  showActions?: boolean;
  className?: string;
};

const DEFAULT_MODES: DatePeriodMode[] = ['all', 'month', 'year', 'day', 'range'];

export default function DateFilterBar({
  filter,
  modes = DEFAULT_MODES,
  showBadge = true,
  showActions = true,
  className = '',
}: DateFilterBarProps) {
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

  const availableModes = useMemo(
    () => new Set(modes.map((item) => toDatePeriodUiMode(item))),
    [modes],
  );
  const fallbackMode = modeOptionsFallback(modes);

  const modeOptions = useMemo<DatePeriodModeOption[]>(() => {
    const options: DatePeriodModeOption[] = [
      { id: 'all', label: t('dateFilterAll') },
      { id: 'month', label: t('dateFilterMonth') },
      { id: 'year', label: t('dateFilterYear') },
      { id: 'day', label: t('dateFilterDay') },
      { id: 'range', label: t('dateFilterRange') },
    ];
    return options.filter((item) => availableModes.has(item.id));
  }, [availableModes, t]);

  const setMode = (nextMode: DatePeriodMode) => {
    if (!availableModes.has(toDatePeriodUiMode(nextMode))) return;
    const change = getDatePeriodModeChange(draft, nextMode, now);
    updateDraft(change.patch);
    setOpenPanel(change.openPanel);
  };

  useEffect(() => {
    if (availableModes.has(mode) || !fallbackMode) return;
    const change = getDatePeriodModeChange(draft, fallbackMode, now);
    updateDraft(change.patch);
    setOpenPanel(null);
  }, [availableModes, draft, fallbackMode, mode, now, updateDraft]);

  const apply = () => {
    applyDatePeriodDraft(filter, draft);
    setOpenPanel(null);
  };

  const reset = () => {
    filter.reset();
    setOpenPanel(null);
  };

  return (
    <div className={cn('noorix-date-filter-bar', className)} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
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

      {showBadge && mode !== 'all' && <DatePeriodBadge label={draftLabel} pending={isDirty} />}

      {showActions && (
        <DatePeriodActions
          applyLabel={t('dateFilterApply')}
          resetLabel={t('dateFilterReset')}
          canApply={isDirty}
          onApply={apply}
          onReset={reset}
        />
      )}
    </div>
  );
}

function modeOptionsFallback(modes: DatePeriodMode[]): DatePeriodMode | null {
  return modes.length > 0 ? toDatePeriodUiMode(modes[0]) : null;
}
