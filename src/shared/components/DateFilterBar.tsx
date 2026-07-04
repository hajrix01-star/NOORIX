import React, { useMemo, useState } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { useDateFilter } from '../../hooks/useDateFilter';
import { Button, DateRangeField } from '../../ui';
import {
  DayRangeCalendar,
  DateFilterMonthPicker,
  MonthRangeCalendar,
  YearRangeCalendar,
  applyDatePeriodDraft,
  areDatePeriodStatesEqual,
  getGregorianMonthNames,
  getGregorianWeekdayNames,
  normalizeDatePeriodMode,
  toDatePeriodUiMode,
  useDatePeriodDraft,
  type DateFilterMonthPickerProps,
} from '../../ui/date';
import { getSaudiNow } from '../../utils/saudiDate';
import {
  buildDatePeriodLabel,
  ymd,
  type DatePeriodMode,
} from '../../utils/datePeriod';

export { useDateFilter };
export { DateFilterMonthPicker };
export type { DateFilterMonthPickerProps };


export default function DateFilterBar({ filter }: any) {
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

  const setMode = (nextMode: DatePeriodMode) => {
    const normalized = normalizeDatePeriodMode(nextMode);
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
    applyDatePeriodDraft(filter, draft);
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
          â†؛
        </Button>
      </div>
    </div>
  );
}
