import React, { type ReactNode } from 'react';
import Button, { type ButtonProps } from './Button';
import { cn } from './cn';

export type DialogActionRole =
  | 'close'
  | 'cancel'
  | 'primary'
  | 'save'
  | 'print'
  | 'edit'
  | 'success'
  | 'delete'
  | 'danger'
  | 'secondary';

export type DialogAction = {
  key: string;
  label: ReactNode;
  onClick?: () => void;
  role?: DialogActionRole;
  disabled?: boolean;
  loading?: boolean;
  hidden?: boolean;
  icon?: ReactNode;
  type?: ButtonProps['type'];
  form?: ButtonProps['form'];
  className?: string;
  ariaLabel?: string;
};

export type DialogActionsProps = {
  actions: readonly DialogAction[];
  className?: string;
  primarySide?: 'start' | 'end';
  size?: ButtonProps['size'];
};

function variantForRole(role: DialogActionRole | undefined): ButtonProps['variant'] {
  if (role === 'primary' || role === 'save' || role === 'print') return 'primary';
  if (role === 'edit' || role === 'success') return 'success';
  if (role === 'delete' || role === 'danger') return 'danger';
  if (role === 'close' || role === 'cancel') return 'ghost';
  return 'default';
}

function weightForRole(role: DialogActionRole | undefined): number {
  if (role === 'close' || role === 'cancel') return 10;
  if (role === 'secondary') return 20;
  if (role === 'delete' || role === 'danger') return 70;
  if (role === 'edit') return 80;
  if (role === 'print') return 90;
  if (role === 'success') return 95;
  if (role === 'primary' || role === 'save') return 100;
  return 50;
}

export default function DialogActions({
  actions,
  className = '',
  primarySide = 'end',
  size = 'sm',
}: DialogActionsProps) {
  const visibleActions = actions
    .filter((action) => !action.hidden)
    .slice()
    .sort((left, right) => {
      const diff = weightForRole(left.role) - weightForRole(right.role);
      return primarySide === 'end' ? diff : -diff;
    });

  if (visibleActions.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap items-center justify-end gap-2', className)}>
      {visibleActions.map((action) => (
        <Button
          key={action.key}
          type={action.type || 'button'}
          size={size}
          variant={variantForRole(action.role)}
          onClick={action.onClick}
          disabled={action.disabled}
          loading={action.loading}
          icon={action.icon}
          form={action.form}
          className={action.className}
          aria-label={action.ariaLabel}
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
}
