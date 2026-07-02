import React, { forwardRef } from 'react';
import EditableTextCell, { type EditableTextCellProps } from './EditableTextCell';
import { cn } from './cn';

export type EditableNumberCellProps = Omit<EditableTextCellProps, 'type'> & {
  align?: 'start' | 'end';
};

const EditableNumberCell = forwardRef<HTMLInputElement, EditableNumberCellProps>(function EditableNumberCell(
  { align = 'end', className = '', inputMode = 'decimal', ...rest },
  ref,
) {
  return (
    <EditableTextCell
      ref={ref}
      type="number"
      inputMode={inputMode}
      className={cn(align === 'end' && 'text-end tabular-nums', className)}
      {...rest}
    />
  );
});

export default EditableNumberCell;
