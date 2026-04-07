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
  primary: { border: 'rgba(37,99,235,0.2)',   top: 'var(--noorix-accent-blue, #2563eb)' },
  white:   { border: 'rgba(255,255,255,0.3)', top: '#ffffff' },
  muted:   { border: 'rgba(100,116,139,0.2)', top: 'var(--noorix-text-muted, #64748b)' },
  inherit: { border: 'rgba(0,0,0,0.15)',       top: 'currentColor' },
};

function Spinner({ size = 'md', color = 'primary', label, className = '', ...rest }) {
  const px      = SIZE_PX[size]   ?? SIZE_PX.md;
  const border  = BORDER_PX[size] ?? BORDER_PX.md;
  const palette = COLOR_MAP[color] ?? COLOR_MAP.primary;

  return (
    <span
      className={cn('inline-flex items-center gap-2', className)}
      role="status"
      aria-label={label ?? 'جاري التحميل'}
      {...rest}
    >
      <span
        aria-hidden="true"
        className="rounded-full shrink-0"
        style={{
          width: px, height: px,
          border: `${border}px solid ${palette.border}`,
          borderTopColor: palette.top,
          animation: 'noorix-spin 0.7s linear infinite',
        }}
      />
      {label && <span className="text-noorix-muted text-[13px]">{label}</span>}
    </span>
  );
}

Spinner.Page = function SpinnerPage({ label, size = 'lg', color = 'primary' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 min-h-[200px]" role="status" aria-label={label ?? 'جاري التحميل'}>
      <Spinner size={size} color={color} aria-hidden="true" />
      {label && <p className="text-noorix-muted text-[13px]">{label}</p>}
    </div>
  );
};

export default Spinner;
