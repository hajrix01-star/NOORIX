import React, { useMemo } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { useDateFilter } from '../../hooks/useDateFilter';
import { Button, Input } from '../../ui';
import { getSaudiNow } from '../../utils/saudiDate';
import type { DatePeriodMode } from '../../utils/datePeriod';

export { useDateFilter };

const MONTH_NAMES_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function ymd(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function monthOptions() {
  return MONTH_NAMES_EN.map((name, index) => ({ value: index + 1, label: name }));
}

export default function DateFilterBar({ filter }: any) {
  const { t, lang } = useTranslation();
  const now = getSaudiNow();
  const years = useMemo(() => [now.year + 1, now.year, now.year - 1, now.year - 2, now.year - 3], [now.year]);
  const months = useMemo(() => monthOptions(), []);
  const mode = filter.mode === 'months' ? 'month' : filter.mode;

  const setMode = (nextMode: DatePeriodMode) => {
    if (nextMode === 'month') {
      filter.setMode('months');
      return;
    }
    filter.setMode(nextMode);
  };

  const monthLabel = filter.mode === 'months' ? filter.label : `${MONTH_NAMES_EN[filter.selMonth - 1]} ${filter.selYear}`;

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
        <div className="ndfb-fields ndfb-fields--months" dir="ltr" aria-label={monthLabel}>
          <Input
            type="select"
            size="sm"
            containerClassName="ndfb-field ndfb-field--year"
            className="ndfb-select"
            value={filter.monthRangeStartYear}
            onChange={(event: any) => filter.setMonthRangeStartYear(Number(event.target.value))}
            aria-label={t('dateFilterFrom')}
          >
            {years.map((year) => <option key={year} value={year}>{year}</option>)}
          </Input>
          <Input
            type="select"
            size="sm"
            containerClassName="ndfb-field ndfb-field--month"
            className="ndfb-select"
            value={filter.monthRangeStartMonth}
            onChange={(event: any) => filter.setMonthRangeStartMonth(Number(event.target.value))}
            aria-label={`${t('dateFilterFrom')} ${t('dateFilterMonth')}`}
          >
            {months.map((month) => <option key={month.value} value={month.value}>{month.label}</option>)}
          </Input>
          <span className="ndfb-range-separator" aria-hidden="true">-</span>
          <Input
            type="select"
            size="sm"
            containerClassName="ndfb-field ndfb-field--year"
            className="ndfb-select"
            value={filter.monthRangeEndYear}
            onChange={(event: any) => filter.setMonthRangeEndYear(Number(event.target.value))}
            aria-label={t('dateFilterTo')}
          >
            {years.map((year) => <option key={year} value={year}>{year}</option>)}
          </Input>
          <Input
            type="select"
            size="sm"
            containerClassName="ndfb-field ndfb-field--month"
            className="ndfb-select"
            value={filter.monthRangeEndMonth}
            onChange={(event: any) => filter.setMonthRangeEndMonth(Number(event.target.value))}
            aria-label={`${t('dateFilterTo')} ${t('dateFilterMonth')}`}
          >
            {months.map((month) => <option key={month.value} value={month.value}>{month.label}</option>)}
          </Input>
        </div>
      )}

      {mode === 'year' && (
        <div className="ndfb-fields" dir="ltr">
          <Input
            type="select"
            size="sm"
            containerClassName="ndfb-field ndfb-field--year"
            className="ndfb-select"
            value={filter.selYear}
            onChange={(event: any) => filter.setSelYear(Number(event.target.value))}
            aria-label={t('dateFilterYear')}
          >
            {years.map((year) => <option key={year} value={year}>{year}</option>)}
          </Input>
        </div>
      )}

      {mode === 'day' && (
        <div className="ndfb-fields">
          <Input
            type="date"
            size="sm"
            containerClassName="ndfb-field ndfb-field--date"
            value={filter.selDay}
            max={ymd(now.year, now.month, now.day)}
            onChange={(event: any) => filter.setSelDay(event.target.value)}
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
            value={filter.rangeStart}
            onChange={(event: any) => filter.setRangeStart(event.target.value)}
            aria-label={t('dateFilterFrom')}
          />
          <span className="ndfb-range-separator" aria-hidden="true">-</span>
          <Input
            type="date"
            size="sm"
            containerClassName="ndfb-field ndfb-field--date"
            value={filter.rangeEnd}
            min={filter.rangeStart}
            onChange={(event: any) => filter.setRangeEnd(event.target.value)}
            aria-label={t('dateFilterTo')}
          />
        </div>
      )}

      {mode !== 'all' && (
        <span className="ndfb-period-badge" title={filter.label}>
          {filter.label}
        </span>
      )}

      <Button
        type="button"
        size="auto"
        variant="raw"
        className="ndfb-reset-btn"
        onClick={filter.reset}
        title={t('dateFilterReset')}
        aria-label={t('dateFilterReset')}
      >
        ↺
      </Button>
    </div>
  );
}
