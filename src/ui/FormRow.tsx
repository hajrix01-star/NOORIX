/**
 * FormRow — مساعد تخطيط النماذج
 * يعرض حقلين أو أكثر في صف على الشاشات الكبيرة، وعمود على الجوال.
 */
import React from 'react';
import { cn } from './cn';

const COLS_CLASS = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
};

const GAP_CLASS = {
  sm: 'gap-2',
  md: 'gap-3',
  lg: 'gap-4',
};

export type FormRowProps = React.ComponentPropsWithoutRef<'div'> & {
  cols?: keyof typeof COLS_CLASS;
  gap?: keyof typeof GAP_CLASS;
};

export default function FormRow({ cols = 2, gap = 'md', className = '', children, ...rest }: FormRowProps) {
  return (
    <div
      className={cn(
        'grid',
        COLS_CLASS[cols as keyof typeof COLS_CLASS] ?? COLS_CLASS[2],
        GAP_CLASS[gap as keyof typeof GAP_CLASS]   ?? GAP_CLASS.md,
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
