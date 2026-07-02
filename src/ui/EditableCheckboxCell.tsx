import React, { forwardRef } from 'react';
import { cn } from './cn';

export type EditableCheckboxCellProps = Omit<React.ComponentPropsWithoutRef<'input'>, 'type'> & {
  containerClassName?: string;
};

const EditableCheckboxCell = forwardRef<HTMLInputElement, EditableCheckboxCellProps>(function EditableCheckboxCell(
  { className = '', containerClassName = '', disabled, ...rest },
  ref,
) {
  return (
    <span className={cn('inline-flex h-8 items-center justify-center', disabled && 'opacity-60', containerClassName)}>
      <input
        ref={ref}
        type="checkbox"
        disabled={disabled}
        className={cn(
          'size-4 shrink-0 rounded border-noorix-border accent-noorix-blue',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-noorix-blue focus-visible:ring-offset-1',
          'disabled:cursor-not-allowed',
          className,
        )}
        {...rest}
      />
    </span>
  );
});

export default EditableCheckboxCell;
