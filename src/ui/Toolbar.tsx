import React from 'react';
import { cn } from './cn';

export type ToolbarProps = {
  children: React.ReactNode;
  className?: string;
  leading?: React.ReactNode;
  actions?: React.ReactNode;
  actionsClassName?: string;
  direction?: 'row' | 'column';
  justify?: 'start' | 'between' | 'end' | 'center';
  align?: 'start' | 'center' | 'end' | 'stretch';
  wrap?: boolean;
  printHidden?: boolean;
};

const justifyClass = {
  start: 'justify-start',
  between: 'justify-between',
  end: 'justify-end',
  center: 'justify-center',
};

const alignClass = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
};

export default function Toolbar({
  children,
  className = '',
  leading,
  actions,
  actionsClassName = '',
  direction = 'row',
  justify = 'start',
  align = 'center',
  wrap = true,
  printHidden = true,
}: ToolbarProps) {
  return (
    <div
      className={cn(
        direction === 'column' ? 'flex flex-col' : 'flex',
        alignClass[align],
        direction === 'row' && justifyClass[justify],
        direction === 'row' && wrap && 'flex-wrap',
        printHidden && 'noorix-print-hide',
        className,
      )}
    >
      {leading}
      {children}
      {actions && <div className={cn('flex flex-wrap gap-2', actionsClassName)}>{actions}</div>}
    </div>
  );
}
