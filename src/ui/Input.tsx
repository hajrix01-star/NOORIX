/**
 * Input — مكوّن حقل الإدخال الموحّد لنظام نووريكس
 * types: text | number | date | email | password | tel | search | select
 * multiline → textarea
 */
import React, { useId } from 'react';
import { cn } from './cn';

const SIZE_FIELD = {
  sm: 'h-7  px-2.5 text-[12px]',
  md: 'h-9  px-3   text-[13px]',
  lg: 'h-11 px-3.5 text-[14px]',
};

const FIELD_BASE = [
  'w-full rounded-lg border border-noorix-border bg-noorix-surface text-noorix-text',
  'placeholder:text-noorix-muted',
  'focus:outline-none focus:border-noorix-blue focus:ring-1 focus:ring-noorix-blue/30',
  'disabled:opacity-50 disabled:bg-noorix-bg-muted disabled:cursor-not-allowed',
  'read-only:bg-noorix-bg-muted read-only:cursor-default',
  'transition-colors duration-150',
].join(' ');

export type InputProps = {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  size?: keyof typeof SIZE_FIELD;
  type?: string;
  multiline?: boolean;
  rows?: number;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  className?: string;
  containerClassName?: string;
  children?: React.ReactNode;
  id?: string;
} & Record<string, unknown>;

export default function Input({
  label,
  hint,
  error,
  required,
  disabled,
  readOnly,
  size = 'md',
  type = 'text',
  multiline = false,
  rows = 3,
  prefix,
  suffix,
  className = '',
  containerClassName = '',
  children,
  id: externalId,
  ...rest
}: InputProps) {
  const generatedId = useId();
  const id          = externalId ?? generatedId;

  const isSelect   = type === 'select';
  const isTextarea = multiline;
  const hasWrapper = prefix || suffix;

  const fieldCls = cn(
    FIELD_BASE,
    SIZE_FIELD[size] ?? SIZE_FIELD.md,
    error     && 'border-noorix-red focus:ring-noorix-red/30',
    prefix    && 'ps-9',
    suffix    && 'pe-9',
    isSelect  && 'cursor-pointer appearance-none',
    isTextarea && '!h-auto py-2',
    className,
  );

  const shared = {
    id,
    className: fieldCls,
    disabled,
    readOnly,
    'aria-required':    required  || undefined,
    'aria-invalid':     !!error   || undefined,
    'aria-describedby': error ? `${id}-error` : hint ? `${id}-hint` : undefined,
    ...(type === 'date' && { dir: 'ltr' }),
    ...rest,
  };

  const renderField = () => {
    if (isSelect)   return <select {...shared}>{children}</select>;
    if (isTextarea) return <textarea rows={rows} {...shared} />;
    return <input type={type} {...shared} />;
  };

  return (
    <div className={cn('flex flex-col gap-1', containerClassName)}>
      {label && (
        <label htmlFor={id} className="text-[13px] font-semibold text-noorix-text">
          {label}
          {required && <span className="text-noorix-red ms-0.5" aria-hidden="true">*</span>}
        </label>
      )}

      {hasWrapper ? (
        <div className="relative flex items-center">
          {prefix && (
            <span className="absolute start-2.5 flex items-center text-noorix-muted text-[13px] pointer-events-none">
              {prefix}
            </span>
          )}
          {renderField()}
          {suffix && (
            <span className="absolute end-2.5 flex items-center text-noorix-muted text-[13px] pointer-events-none">
              {suffix}
            </span>
          )}
        </div>
      ) : (
        renderField()
      )}

      {hint && !error && (
        <p id={`${id}-hint`} className="text-[12px] text-noorix-muted">{hint}</p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-[12px] text-noorix-red font-medium">{error}</p>
      )}
    </div>
  );
}
