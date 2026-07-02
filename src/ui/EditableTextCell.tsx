import React, { forwardRef } from 'react';
import { cn } from './cn';

export type EditableTextCellProps = React.ComponentPropsWithoutRef<'input'> & {
  invalid?: boolean;
};

const EditableTextCell = forwardRef<HTMLInputElement, EditableTextCellProps>(function EditableTextCell(
  { className = '', invalid = false, type = 'text', ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      aria-invalid={invalid || undefined}
      className={cn(
        'h-8 w-full min-w-0 rounded border border-noorix-border bg-noorix-surface px-2 text-[12px] text-noorix-text',
        'placeholder:text-noorix-muted',
        'focus:outline-none focus:border-noorix-blue focus:ring-1 focus:ring-noorix-blue/30',
        'disabled:cursor-not-allowed disabled:bg-noorix-bg-muted disabled:opacity-60',
        invalid && 'border-noorix-red focus:border-noorix-red focus:ring-noorix-red/30',
        className,
      )}
      {...rest}
    />
  );
});

export default EditableTextCell;
