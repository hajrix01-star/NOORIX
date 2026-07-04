import React from 'react';
import DateField, { type DateFieldProps } from './DateField';
import { cn } from '../cn';

function stringClassName(value: unknown) {
  return typeof value === 'string' ? value : '';
}

export type DateRangeFieldProps = {
  startValue?: string;
  endValue?: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  startLabel?: React.ReactNode;
  endLabel?: React.ReactNode;
  startAriaLabel?: string;
  endAriaLabel?: string;
  minEnd?: string;
  size?: DateFieldProps['size'];
  className?: string;
  separatorClassName?: string;
  startContainerClassName?: string;
  endContainerClassName?: string;
  startFieldProps?: Omit<DateFieldProps, 'value' | 'onValueChange' | 'type'>;
  endFieldProps?: Omit<DateFieldProps, 'value' | 'onValueChange' | 'type'>;
};

export default function DateRangeField({
  startValue = '',
  endValue = '',
  onStartChange,
  onEndChange,
  startLabel,
  endLabel,
  startAriaLabel,
  endAriaLabel,
  minEnd,
  size = 'sm',
  className = '',
  separatorClassName = '',
  startContainerClassName = '',
  endContainerClassName = '',
  startFieldProps,
  endFieldProps,
}: DateRangeFieldProps) {
  return (
    <div className={cn('noorix-date-range-field', className)}>
      <DateField
        {...startFieldProps}
        size={size}
        label={startLabel}
        containerClassName={cn(startContainerClassName, stringClassName(startFieldProps?.containerClassName))}
        value={startValue}
        onValueChange={onStartChange}
        aria-label={startAriaLabel}
      />
      <span className={cn('noorix-date-range-field__separator', separatorClassName)} aria-hidden="true">-</span>
      <DateField
        {...endFieldProps}
        size={size}
        label={endLabel}
        containerClassName={cn(endContainerClassName, stringClassName(endFieldProps?.containerClassName))}
        value={endValue}
        min={minEnd}
        onValueChange={onEndChange}
        aria-label={endAriaLabel}
      />
    </div>
  );
}
