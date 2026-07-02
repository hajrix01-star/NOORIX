import React, { forwardRef, useId } from 'react';
import { cn } from './cn';

export type FileInputProps = Omit<React.ComponentPropsWithoutRef<'input'>, 'type'> & {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  containerClassName?: string;
};

const FileInput = forwardRef<HTMLInputElement, FileInputProps>(function FileInput(
  { label, hint, error, id: externalId, className = '', containerClassName = '', ...rest },
  ref,
) {
  const generatedId = useId();
  const id = externalId ?? generatedId;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={cn('flex flex-col gap-1', containerClassName)}>
      {label && (
        <label htmlFor={id} className="text-[13px] font-semibold text-noorix-text">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        type="file"
        aria-invalid={!!error || undefined}
        aria-describedby={describedBy}
        className={cn(
          'w-full rounded-lg border border-noorix-border bg-noorix-surface text-[13px] text-noorix-text',
          'file:me-3 file:h-9 file:border-0 file:bg-noorix-bg-muted file:px-3 file:text-[13px] file:font-medium file:text-noorix-text',
          'focus:outline-none focus:border-noorix-blue focus:ring-1 focus:ring-noorix-blue/30',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...rest}
      />
      {hint && !error && <p id={`${id}-hint`} className="text-[12px] text-noorix-muted">{hint}</p>}
      {error && <p id={`${id}-error`} role="alert" className="text-[12px] font-medium text-noorix-red">{error}</p>}
    </div>
  );
});

export default FileInput;
