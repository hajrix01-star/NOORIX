/**
 * Button — مكوّن الزر الموحّد لنظام نووريكس
 *
 * variants: default | primary | success | danger | warning | ghost | raw
 * sizes:    sm | md | lg
 */
import React, { forwardRef } from 'react';
import { cn } from './cn';

const VARIANT = {
  default: 'bg-white border border-[var(--btn-default-border)] text-[var(--btn-default-text)] hover:bg-[var(--btn-default-hover)] active:bg-[var(--btn-default-hover)]',
  primary: 'bg-noorix-blue text-white hover:bg-blue-700 active:bg-blue-800 border border-transparent',
  success: 'bg-noorix-green text-white hover:bg-green-700 active:bg-green-800 border border-transparent',
  danger:  'bg-noorix-red  text-white hover:bg-red-700  active:bg-red-800  border border-transparent',
  warning: 'bg-noorix-amber text-white hover:bg-amber-700 active:bg-amber-800 border border-transparent',
  ghost:   'bg-transparent border border-transparent text-noorix-text hover:bg-noorix-bg-muted active:bg-noorix-bg-muted',
  raw:     '',
};

const SIZE = {
  sm: 'h-7 px-3 text-[12px] gap-1.5 rounded-md',
  md: 'h-9 px-4 text-[13px] gap-2   rounded-lg',
  lg: 'h-11 px-6 text-[14px] gap-2  rounded-lg',
};

const BASE = 'inline-flex items-center justify-center font-medium font-cairo cursor-pointer select-none transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-noorix-blue focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none';

const Button = forwardRef(function Button({
  variant   = 'default',
  size      = 'md',
  loading   = false,
  disabled  = false,
  fullWidth = false,
  icon,
  iconEnd,
  type      = 'button',
  className = '',
  children,
  ...rest
}, ref) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        BASE,
        VARIANT[variant] ?? VARIANT.default,
        SIZE[size]       ?? SIZE.md,
        fullWidth && 'w-full',
        loading   && 'relative opacity-75 pointer-events-none',
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && (
        <span
          className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white shrink-0"
          style={{ animation: 'noorix-spin 0.7s linear infinite' }}
          aria-hidden="true"
        />
      )}
      {!loading && icon && (
        <span className="shrink-0" aria-hidden="true">{icon}</span>
      )}
      {children}
      {!loading && iconEnd && (
        <span className="shrink-0" aria-hidden="true">{iconEnd}</span>
      )}
    </button>
  );
});

export default Button;
