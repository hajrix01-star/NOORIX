import React from 'react';
import Button from '../Button';
import { type DatePeriodMode } from '../../utils/datePeriod';

export type DatePeriodModeOption = {
  id: DatePeriodMode;
  label: React.ReactNode;
};

export type DatePeriodModeGroupProps = {
  mode: DatePeriodMode;
  options: DatePeriodModeOption[];
  ariaLabel: string;
  onModeChange: (mode: DatePeriodMode) => void;
};

export function DatePeriodModeGroup({
  mode,
  options,
  ariaLabel,
  onModeChange,
}: DatePeriodModeGroupProps) {
  return (
    <div className="ndfb-mode-group" role="group" aria-label={ariaLabel}>
      {options.map((item) => (
        <Button
          key={item.id}
          type="button"
          size="auto"
          variant="raw"
          className={`ndfb-mode-btn${mode === item.id ? ' ndfb-mode-btn--active' : ''}`}
          aria-pressed={mode === item.id}
          onClick={() => onModeChange(item.id)}
        >
          {item.label}
        </Button>
      ))}
    </div>
  );
}

export type DatePeriodBadgeProps = {
  label: string;
  pending?: boolean;
};

export function DatePeriodBadge({ label, pending = false }: DatePeriodBadgeProps) {
  return (
    <span className={`ndfb-period-badge${pending ? ' ndfb-period-badge--pending' : ''}`} title={label}>
      {label}
    </span>
  );
}

export type DatePeriodActionsProps = {
  applyLabel: React.ReactNode;
  resetLabel: string;
  canApply: boolean;
  onApply: () => void;
  onReset: () => void;
};

export function DatePeriodActions({
  applyLabel,
  resetLabel,
  canApply,
  onApply,
  onReset,
}: DatePeriodActionsProps) {
  return (
    <div className="ndfb-actions">
      <Button
        type="button"
        size="sm"
        variant="primary"
        className="ndfb-apply-btn"
        onClick={onApply}
        disabled={!canApply}
      >
        {applyLabel}
      </Button>
      <Button
        type="button"
        size="auto"
        variant="raw"
        className="ndfb-reset-btn"
        onClick={onReset}
        title={resetLabel}
        aria-label={resetLabel}
      >
        {'↺'}
      </Button>
    </div>
  );
}
