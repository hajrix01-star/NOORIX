import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { useDateFilter } from '../../hooks/useDateFilter';
import { Button, Input } from '../../ui';
import { getSaudiNow } from '../../utils/saudiDate';
import {
  buildDatePeriodLabel,
  ymd,
  type DatePeriodMode,
  type DatePeriodState,
} from '../../utils/datePeriod';

export { useDateFilter };

const MONTH_NAMES_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAMES_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

function normalizeMode(mode: DatePeriodMode): DatePeriodMode {
  return mode === 'month' ? 'months' : mode;
}

function toUiMode(mode: DatePeriodMode): DatePeriodMode {
  return mode === 'months' ? 'month' : mode;
}

function cloneDateState(state: DatePeriodState): DatePeriodState {
  return { ...state, mode: normalizeMode(state.mode) };
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
}

type MonthCalendarProps = {
  draft: DatePeriodState;
  monthNames: string[];
  years: number[];
  updateDraft: (patch: Partial<DatePeriodState>) => void;
  fromLabel: string;
  toLabel: string;
};

function MonthCalendar({ draft, monthNames, years, updateDraft, fromLabel, toLabel }: MonthCalendarProps) {
  return (
    <div className="ndfb-calendar ndfb-calendar--months">
      {[
        {
          key: 'from',
          label: fromLabel,
          year: draft.monthRangeStartYear,
          month: draft.monthRangeStartMonth,
          setYear: (year: number) => updateDraft({ monthRangeStartYear: year }),
          setMonth: (month: number) => updateDraft({ monthRangeStartMonth: month }),
        },
        {
          key: 'to',
          label: toLabel,
          year: draft.monthRangeEndYear,
          month: draft.monthRangeEndMonth,
          setYear: (year: number) => updateDraft({ monthRangeEndYear: year }),
          setMonth: (month: number) => updateDraft({ monthRangeEndMonth: month }),
        },
      ].map((panel) => (
        <div key={panel.key} className="ndfb-calendar-panel">
          <div className="ndfb-calendar-panel__head">
            <span>{panel.label}</span>
            <select
              className="ndfb-calendar-year-select"
              value={panel.year}
              onChange={(event) => panel.setYear(Number(event.target.value))}
              aria-label={panel.label}
            >
              {years.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </div>
          <div className="ndfb-month-grid">
            {monthNames.map((name, index) => {
              const month = index + 1;
              const active = panel.month === month;
              return (
                <button
                  key={month}
                  type="button"
                  className={`ndfb-month-cell${active ? ' ndfb-month-cell--active' : ''}`}
                  aria-label={`${panel.label} ${name}`}
                  onClick={() => panel.setMonth(month)}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

type YearCalendarProps = {
  selectedYear: number;
  years: number[];
  onSelect: (year: number) => void;
};

function YearCalendar({ selectedYear, years, onSelect }: YearCalendarProps) {
  return (
    <div className="ndfb-calendar ndfb-calendar--years">
      {years.map((year) => (
        <button
          key={year}
          type="button"
          className={`ndfb-year-cell${selectedYear === year ? ' ndfb-year-cell--active' : ''}`}
          onClick={() => onSelect(year)}
        >
          {year}
        </button>
      ))}
    </div>
  );
}

export default function DateFilterBar({ filter }: any) {
  const { t, lang } = useTranslation();
  const now = getSaudiNow();
  const years = useMemo(() => [now.year + 1, now.year, now.year - 1, now.year - 2, now.year - 3], [now.year]);
  const monthNames = lang === 'ar' ? MONTH_NAMES_AR : MONTH_NAMES_EN;
  const { draft, updateDraft } = useDraftDateState(filter);
  const mode = toUiMode(draft.mode);
  const draftLabel = buildDatePeriodLabel(draft, now);
  const isDirty = JSON.stringify(cloneDateState(filter.state)) !== JSON.stringify(draft);

  const setMode = (nextMode: DatePeriodMode) => {
    updateDraft({ mode: normalizeMode(nextMode) });
  };

  const apply = () => {
    applyDraft(filter, draft);
  };

  const reset = () => {
    filter.reset();
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

      {mode === 'month' && (
        <MonthCalendar
          draft={draft}
          monthNames={monthNames}
          years={years}
          updateDraft={updateDraft}
          fromLabel={t('dateFilterFrom')}
          toLabel={t('dateFilterTo')}
        />
      )}

      {mode === 'year' && (
        <YearCalendar
          selectedYear={draft.selYear}
          years={years}
          onSelect={(year) => updateDraft({ selYear: year })}
        />
      )}

      {mode === 'day' && (
        <div className="ndfb-fields">
          <Input
            type="date"
            size="sm"
            containerClassName="ndfb-field ndfb-field--date"
            value={draft.selDay}
            max={ymd(now.year, now.month, now.day)}
            onChange={(event: any) => updateDraft({ selDay: event.target.value })}
            aria-label={t('dateFilterDay')}
          />
        </div>
      )}

      {mode === 'range' && (
        <div className="ndfb-fields ndfb-fields--range">
          <Input
            type="date"
            size="sm"
            containerClassName="ndfb-field ndfb-field--date"
            value={draft.rangeStart}
            onChange={(event: any) => updateDraft({ rangeStart: event.target.value })}
            aria-label={t('dateFilterFrom')}
          />
          <span className="ndfb-range-separator" aria-hidden="true">-</span>
          <Input
            type="date"
            size="sm"
            containerClassName="ndfb-field ndfb-field--date"
            value={draft.rangeEnd}
            min={draft.rangeStart}
            onChange={(event: any) => updateDraft({ rangeEnd: event.target.value })}
            aria-label={t('dateFilterTo')}
          />
        </div>
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
