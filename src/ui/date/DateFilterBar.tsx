import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../../i18n/useTranslation';
import { getSaudiNow } from '../../utils/saudiDate';
import {
  buildDatePeriodLabel,
  type DatePeriodMode,
} from './datePeriod';
import DateRangeField from './DateRangeField';
import { DayRangeCalendar, MonthRangeCalendar, QuarterCalendar, YearRangeCalendar } from './PeriodCalendars';
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

const DEFAULT_MODES: DatePeriodMode[] = ['all', 'day', 'month', 'quarter', 'year', 'range'];

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
  const rootRef = useRef<HTMLDivElement | null>(null);
  const anchorRef = useRef<HTMLElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties | null>(null);
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
      { id: 'day', label: t('dateFilterDay') },
      { id: 'month', label: t('dateFilterMonth') },
      { id: 'quarter', label: t('dateFilterQuarter') },
      { id: 'year', label: t('dateFilterYear') },
      { id: 'range', label: t('dateFilterRange') },
    ];
    return options.filter((item) => availableModes.has(item.id));
  }, [availableModes, t]);

  const setMode = (nextMode: DatePeriodMode, trigger?: HTMLElement) => {
    if (!availableModes.has(toDatePeriodUiMode(nextMode))) return;
    if (trigger) anchorRef.current = trigger;
    if (nextMode === 'all') {
      filter.setMode('all');
      updateDraft({ mode: 'all' });
      setPopoverStyle(null);
      setOpenPanel(null);
      return;
    }
    const change = getDatePeriodModeChange(draft, nextMode, now);
    updateDraft(change.patch);
    setPopoverStyle(null);
    setOpenPanel(change.openPanel);
  };

  useEffect(() => {
    if (availableModes.has(mode) || !fallbackMode) return;
    const change = getDatePeriodModeChange(draft, fallbackMode, now);
    updateDraft(change.patch);
    setOpenPanel(null);
  }, [availableModes, draft, fallbackMode, mode, now, updateDraft]);

  useLayoutEffect(() => {
    if (!openPanel) return undefined;
    const updatePopoverPosition = () => {
      const anchor = anchorRef.current ?? rootRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const margin = 16;
      const width = Math.min(380, window.innerWidth - margin * 2);
      const preferredLeft = rect.left + rect.width / 2 - width / 2;
      const left = Math.min(Math.max(preferredLeft, margin), window.innerWidth - width - margin);
      const estimatedHeight = Math.min(popoverRef.current?.offsetHeight || 360, window.innerHeight - margin * 2);
      const belowTop = rect.bottom + 8;
      const aboveTop = rect.top - estimatedHeight - 8;
      const hasBelowRoom = belowTop + estimatedHeight <= window.innerHeight - margin;
      const top = hasBelowRoom ? belowTop : Math.max(margin, aboveTop);
      setPopoverStyle({
        position: 'fixed',
        top,
        left,
        width,
      });
    };
    const closeOnOutsidePointer = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setPopoverStyle(null);
      setOpenPanel(null);
    };
    updatePopoverPosition();
    window.addEventListener('resize', updatePopoverPosition);
    window.addEventListener('scroll', updatePopoverPosition, true);
    document.addEventListener('mousedown', closeOnOutsidePointer);
    document.addEventListener('touchstart', closeOnOutsidePointer);
    return () => {
      window.removeEventListener('resize', updatePopoverPosition);
      window.removeEventListener('scroll', updatePopoverPosition, true);
      document.removeEventListener('mousedown', closeOnOutsidePointer);
      document.removeEventListener('touchstart', closeOnOutsidePointer);
    };
  }, [lang, openPanel]);

  const apply = () => {
    applyDatePeriodDraft(filter, draft);
    setPopoverStyle(null);
    setOpenPanel(null);
  };

  const reset = () => {
    filter.reset();
    setPopoverStyle(null);
    setOpenPanel(null);
  };

  const popover = openPanel && mode !== 'all' ? (
    <div
      ref={popoverRef}
      className="ndfb-popover ndfb-popover--floating"
      role="dialog"
      aria-label={t('dateFilterPeriod')}
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      style={popoverStyle ?? { position: 'fixed', top: 0, left: 0, width: 380, visibility: 'hidden' }}
    >
      {mode === 'month' && (
        <MonthRangeCalendar
          draft={draft}
          monthNames={monthNames}
          years={years}
          updateDraft={updateDraft}
          yearLabel={t('dateFilterYear')}
        />
      )}

      {mode === 'year' && (
        <YearRangeCalendar
          draft={draft}
          years={years}
          updateDraft={updateDraft}
          yearLabel={t('dateFilterYear')}
        />
      )}

      {mode === 'quarter' && (
        <QuarterCalendar
          draft={draft}
          years={years}
          updateDraft={updateDraft}
          quarterLabel={t('dateFilterQuarter')}
          yearLabel={t('dateFilterYear')}
        />
      )}

      {mode === 'day' && (
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

      {showActions && (
        <DatePeriodActions
          applyLabel={t('dateFilterApply')}
          resetLabel={lang === 'ar' ? 'إعادة' : 'Reset'}
          canApply={isDirty}
          onApply={apply}
          onReset={reset}
        />
      )}
    </div>
  ) : null;

  return (
    <div ref={rootRef} className={cn('noorix-date-filter-bar', className)} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <DatePeriodModeGroup
        mode={mode}
        options={modeOptions}
        ariaLabel={t('dateFilterPeriod')}
        onModeChange={setMode}
      />

      {showBadge && mode !== 'all' && <DatePeriodBadge label={draftLabel} pending={isDirty} />}
      {popover ? createPortal(popover, document.body) : null}
    </div>
  );
}

function modeOptionsFallback(modes: DatePeriodMode[]): DatePeriodMode | null {
  return modes.length > 0 ? toDatePeriodUiMode(modes[0]) : null;
}
