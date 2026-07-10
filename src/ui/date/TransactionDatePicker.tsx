import React from 'react';
import DateField, { type DateFieldProps } from './DateField';

export type TransactionDatePickerProps = Omit<DateFieldProps, 'value' | 'onValueChange' | 'type'> & {
  value: string;
  onValueChange: (value: string) => void;
};

export default function TransactionDatePicker({
  label,
  size = 'md',
  value,
  onValueChange,
  ...props
}: TransactionDatePickerProps) {
  return (
    <DateField
      {...props}
      label={label}
      size={size}
      value={value}
      onValueChange={onValueChange}
    />
  );
}
