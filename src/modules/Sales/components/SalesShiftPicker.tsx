/**
 * اختيار الشفت — يوم كامل / صباحي / مسائي
 */
import React from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { Button, cn } from '../../../ui';
import type { SalesShiftFormValue, SalesShiftValue, SalesListShiftFilter } from '../constants/salesShift';
import { isSalesShiftValue } from '../constants/salesShift';

type FormProps = {
  mode: 'form';
  value: SalesShiftFormValue;
  onChange: (value: SalesShiftValue) => void;
  required?: boolean;
  className?: string;
};

type FilterProps = {
  mode: 'filter';
  value: SalesListShiftFilter;
  onChange: (value: SalesListShiftFilter) => void;
  className?: string;
};

export type SalesShiftPickerProps = FormProps | FilterProps;

function shiftLabelKey(v: SalesShiftValue | 'any'): string {
  if (v === 'any') return 'salesShiftFilterAny';
  if (v === 'all') return 'salesShiftFullDay';
  if (v === 'morning') return 'salesShiftMorning';
  return 'salesShiftEvening';
}

export function SalesShiftPicker(props: SalesShiftPickerProps) {
  const { t } = useTranslation();
  const { className } = props;

  if (props.mode === 'filter') {
    const options: SalesListShiftFilter[] = ['any', 'all', 'morning', 'evening'];
    return (
      <div
        className={cn(
          'inline-flex flex-wrap items-center gap-1 rounded-lg border border-noorix-border bg-noorix-bg-muted/50 p-1',
          className,
        )}
        role="group"
        aria-label={t('salesShiftFilter')}
      >
        <span className="text-[12px] font-semibold text-noorix-muted px-1 shrink-0">{t('salesShiftFilter')}</span>
        {options.map((opt) => (
          <Button
            key={opt}
            size="sm"
            variant={props.value === opt ? 'primary' : 'ghost'}
            onClick={() => props.onChange(opt)}
            aria-pressed={props.value === opt}
          >
            {t(shiftLabelKey(opt))}
          </Button>
        ))}
      </div>
    );
  }

  const { value, onChange, required = true } = props;
  const options: SalesShiftValue[] = ['all', 'morning', 'evening'];
  const showHint = required && !isSalesShiftValue(value);

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-[13px] font-bold text-noorix-text m-0">
          {t('salesShiftLabel')}
          {required ? <span className="text-noorix-red"> *</span> : null}
        </label>
        {showHint ? (
          <span className="text-[11px] text-noorix-amber font-medium">{t('salesShiftRequired')}</span>
        ) : null}
      </div>
      <div
        className="grid grid-cols-1 min-[360px]:grid-cols-3 gap-2"
        role="radiogroup"
        aria-label={t('salesShiftLabel')}
        aria-required={required}
      >
        {options.map((opt) => {
          const selected = value === opt;
          return (
            <Button
              key={opt}
              type="button"
              size="sm"
              variant={selected ? 'primary' : 'ghost'}
              className={cn(
                'min-h-[44px] justify-center font-semibold',
                !selected && showHint && 'border border-dashed border-noorix-border',
              )}
              onClick={() => onChange(opt)}
              aria-pressed={selected}
            >
              {t(shiftLabelKey(opt))}
            </Button>
          );
        })}
      </div>
      <p className="m-0 text-[11px] text-noorix-muted leading-relaxed">{t('salesShiftHint')}</p>
    </div>
  );
}
