/**
 * Button — مكوّن الزر الموحّد لنظام نووريكس
 *
 * variants: default | primary | success | danger | warning | ghost | raw
 * sizes:    sm | md | lg | auto (no size classes — full layout via className)
 */
import React, { forwardRef, type ReactNode } from 'react';
import { cn } from './cn';

const VARIANT = {
  default: 'bg-white border border-[var(--btn-default-border)] text-[var(--btn-default-text)] hover:bg-[var(--btn-default-hover)] active:bg-[var(--btn-default-hover)]',
  /** alias تاريخي — نفس أسلوب default */
  secondary: 'bg-white border border-[var(--btn-default-border)] text-[var(--btn-default-text)] hover:bg-[var(--btn-default-hover)] active:bg-[var(--btn-default-hover)]',
  primary: 'bg-[var(--btn-primary-bg)] text-white hover:bg-[var(--btn-primary-hover)] active:bg-[var(--btn-primary-hover)] border border-transparent',
  success: 'bg-[var(--btn-success-bg)] text-white hover:bg-[var(--btn-success-hover)] active:bg-[var(--btn-success-hover)] border border-transparent',
  danger:  'bg-[var(--btn-danger-bg)] text-white hover:bg-[var(--btn-danger-hover)] active:bg-[var(--btn-danger-hover)] border border-transparent',
  warning: 'bg-[var(--btn-warning-bg)] text-white hover:bg-[var(--btn-warning-hover)] active:bg-[var(--btn-warning-hover)] border border-transparent',
  ghost:   'bg-transparent border border-transparent text-noorix-text hover:bg-noorix-bg-muted active:bg-noorix-bg-muted',
  raw:     '',
};

const SIZE = {
  sm:   'h-7 px-3 text-[12px] gap-1.5 rounded',
  md:   'h-9 px-4 text-[13px] gap-2   rounded',
  lg:   'h-11 px-6 text-[14px] gap-2  rounded',
  auto: '',
};

const BASE = 'inline-flex items-center justify-center font-medium font-cairo cursor-pointer select-none transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noorix-accent-blue)] focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none';

export type ButtonProps = React.ComponentPropsWithoutRef<'button'> & {
  variant?: keyof typeof VARIANT;
  size?: keyof typeof SIZE;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
  iconEnd?: ReactNode;
  runtimeStyle?: Pick<React.CSSProperties, 'background' | 'border' | 'color'>;
  styleVars?: Record<`--${string}`, string | number | undefined>;
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'default',
    size = 'md',
    loading = false,
    disabled = false,
    fullWidth = false,
    icon,
    iconEnd,
    runtimeStyle,
    styleVars,
    style,
    type = 'button',
    className = '',
    children,
    ...rest
  },
  ref,
) {
  const buttonStyle = {
    ...(styleVars || null),
    ...(runtimeStyle || null),
    ...(style || null),
  } as React.CSSProperties;
  const hasButtonStyle = Object.keys(buttonStyle).length > 0;

  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        BASE,
        VARIANT[variant as keyof typeof VARIANT] ?? VARIANT.default,
        SIZE[size as keyof typeof SIZE]       ?? SIZE.md,
        fullWidth && 'w-full',
        loading   && 'relative opacity-75 pointer-events-none',
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      style={hasButtonStyle ? buttonStyle : undefined}
      {...rest}
    >
      {loading && (
        <span
          className="nx-button-spinner w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white shrink-0"
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
