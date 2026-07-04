import React from 'react';
import Input, { type InputProps } from '../Input';
import { cn } from '../cn';

export type DateFieldProps = Omit<InputProps, 'type' | 'value' | 'onChange'> & {
  value?: string;
  onValueChange?: (value: string) => void;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
};

export default function DateField({
  value = '',
  onValueChange,
  onChange,
  className = '',
  ...rest
}: DateFieldProps) {
  const safeClassName = typeof className === 'string' ? className : '';
  const handleChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    onValueChange?.(event.target.value);
    onChange?.(event);
  };

  return (
    <Input
      {...rest}
      type="date"
      value={value}
      onChange={handleChange}
      className={cn('noorix-date-field', safeClassName)}
    />
  );
}
