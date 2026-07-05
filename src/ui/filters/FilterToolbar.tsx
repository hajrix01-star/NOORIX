import React from 'react';
import { cn } from '../cn';

export type FilterToolbarProps = {
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  filtersClassName?: string;
  actionsClassName?: string;
  variant?: 'default' | 'execution' | 'bare';
  scroll?: boolean;
};

export default function FilterToolbar({
  children,
  actions,
  className = '',
  filtersClassName = '',
  actionsClassName = '',
  variant = 'default',
  scroll = false,
}: FilterToolbarProps) {
  if (variant === 'bare') {
    return (
      <div className={cn('noorix-print-hide', className)}>
        {children}
        {actions}
      </div>
    );
  }

  if (variant === 'execution') {
    return (
      <div className={cn('noorix-print-hide noorix-exec-filters', scroll && 'noorix-exec-filters--scroll', className)}>
        {children}
        {actions}
      </div>
    );
  }

  return (
    <div className={cn('noorix-print-hide nx-filter-toolbar', className)}>
      <div className={cn('nx-filter-toolbar__filters', filtersClassName)}>{children}</div>
      {actions && <div className={cn('nx-filter-toolbar__actions', actionsClassName)}>{actions}</div>}
    </div>
  );
}
