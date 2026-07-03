/**
 * Spinner — مكوّن التحميل الموحّد لنظام نووريكس
 * sizes: xs | sm | md | lg
 * colors: primary | white | muted | inherit
 */
import React from 'react';
import { cn } from './cn';

const SIZE_PX   = { xs: 14, sm: 18, md: 24, lg: 36 };
const BORDER_PX = { xs: 2,  sm: 2,  md: 3,  lg: 3  };

const COLOR_MAP = {
  primary: { border: 'var(--noorix-blue-20)',   top: 'var(--noorix-accent-blue, #2563eb)' },
  white:   { border: 'rgba(255,255,255,0.3)', top: '#ffffff' },
  muted:   { border: 'var(--noorix-muted-20)', top: 'var(--noorix-text-muted, #64748b)' },
  inherit: { border: 'rgba(0,0,0,0.15)',       top: 'currentColor' },
};

type SpinnerProps = {
  size?: keyof typeof SIZE_PX;
  color?: keyof typeof COLOR_MAP;
  label?: string;
  className?: string;
} & React.ComponentPropsWithoutRef<'span'>;

function Spinner({ size = 'md', color = 'primary', label, className = '', ...rest }: SpinnerProps) {
  const px      = SIZE_PX[size]   ?? SIZE_PX.md;
  const border  = BORDER_PX[size] ?? BORDER_PX.md;
  const palette = COLOR_MAP[color] ?? COLOR_MAP.primary;
  const spinnerStyle = {
    '--nx-spinner-size': `${px}px`,
    '--nx-spinner-border-width': `${border}px`,
    '--nx-spinner-border': palette.border,
    '--nx-spinner-top': palette.top,
  } as React.CSSProperties;

  return (
    <span
      className={cn('inline-flex items-center gap-2', className)}
      role="status"
      aria-label={label ?? 'جاري التحميل'}
      {...rest}
    >
      <span
        aria-hidden="true"
        className="nx-spinner rounded-full shrink-0"
        style={spinnerStyle}
      />
      {label && <span className="text-noorix-muted text-[13px]">{label}</span>}
    </span>
  );
}

Spinner.Page = function SpinnerPage({
  label,
  size = 'lg',
  color = 'primary',
}: {
  label?: string;
  size?: keyof typeof SIZE_PX;
  color?: keyof typeof COLOR_MAP;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 min-h-[200px]" role="status" aria-label={label ?? 'جاري التحميل'}>
      <Spinner size={size} color={color} aria-hidden="true" />
      {label && <p className="text-noorix-muted text-[13px]">{label}</p>}
    </div>
  );
};

export default Spinner;
