import React, { forwardRef, useId } from 'react';
import { cn } from './cn';

export type RadioProps = Omit<React.ComponentPropsWithoutRef<'input'>, 'type'> & {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  containerClassName?: string;
};

const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio(
  { label, hint, error, id: externalId, className = '', containerClassName = '', disabled, ...rest },
  ref,
) {
  const generatedId = useId();
  const id = externalId ?? generatedId;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  const input = (
      <input
        ref={ref}
        id={id}
        type="radio"
        disabled={disabled}
        aria-invalid={!!error || undefined}
        aria-describedby={describedBy}
        className={cn(
          'mt-0.5 size-4 shrink-0 border-noorix-border accent-noorix-blue',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-noorix-blue focus-visible:ring-offset-1',
          'disabled:cursor-not-allowed',
          className,
        )}
        {...rest}
      />
  );

  if (!label && !hint && !error) return input;

  return (
    <label className={cn('inline-flex min-w-0 items-start gap-2 text-[13px] text-noorix-text', disabled && 'opacity-60', containerClassName)}>
      {input}
      {(label || hint || error) && (
        <span className="min-w-0 flex-1">
          {label && <span className="block leading-5">{label}</span>}
          {hint && !error && <span id={`${id}-hint`} className="block text-[12px] text-noorix-muted">{hint}</span>}
          {error && <span id={`${id}-error`} role="alert" className="block text-[12px] font-medium text-noorix-red">{error}</span>}
        </span>
      )}
    </label>
  );
});

export default Radio;
