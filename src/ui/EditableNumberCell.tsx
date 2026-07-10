import React, { forwardRef } from 'react';
import EditableTextCell, { type EditableTextCellProps } from './EditableTextCell';
import { cn } from './cn';

export type EditableNumberCellProps = Omit<EditableTextCellProps, 'type'> & {
  align?: 'start' | 'end';
  selectOnFocus?: boolean;
};

const EditableNumberCell = forwardRef<HTMLInputElement, EditableNumberCellProps>(function EditableNumberCell(
  { align = 'end', className = '', inputMode = 'decimal', min = '0', selectOnFocus = false, onFocus, ...rest },
  ref,
) {
  return (
    <EditableTextCell
      ref={ref}
      type="number"
      inputMode={inputMode}
      min={min}
      onFocus={(event) => {
        if (selectOnFocus) event.currentTarget.select();
        onFocus?.(event);
      }}
      className={cn(align === 'end' && 'text-end tabular-nums', className)}
      {...rest}
    />
  );
});

export default EditableNumberCell;
