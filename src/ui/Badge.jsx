/**
 * Badge — مكوّن شارة الحالة الموحّد لنظام نووريكس
 * colors: green | red | amber | blue | violet | gray | sky | navy
 */
import React from 'react';
import { cn } from './cn';

export const BADGE_COLORS = {
  green:  { bg: 'rgba(22,163,74,0.1)',   color: '#15803d' },
  red:    { bg: 'rgba(220,38,38,0.1)',   color: 'var(--noorix-accent-red)' },
  amber:  { bg: 'rgba(217,119,6,0.12)',  color: '#b45309' },
  blue:   { bg: 'rgba(37,99,235,0.1)',   color: 'var(--noorix-accent-blue)' },
  sky:    { bg: 'rgba(2,132,199,0.1)',   color: '#0369a1' },
  violet: { bg: 'rgba(99,102,241,0.1)',  color: '#4f46e5' },
  gray:   { bg: 'rgba(100,116,139,0.1)', color: '#475569' },
  navy:   { bg: 'rgba(10,31,68,0.1)',    color: 'var(--noorix-navy)' },
};

const SIZE_CLASS = {
  sm: 'text-[11px] px-2 py-0.5',
  md: 'text-[12px] px-2.5 py-0.5',
};

export default function Badge({ color = 'gray', size = 'md', dot = false, className = '', children, ...rest }) {
  const palette = BADGE_COLORS[color] ?? BADGE_COLORS.gray;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-semibold whitespace-nowrap',
        SIZE_CLASS[size] ?? SIZE_CLASS.md,
        className,
      )}
      style={{ background: palette.bg, color: palette.color }}
      {...rest}
    >
      {dot && (
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: palette.color }}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}

Badge.fromStatus = function fromStatus(status, map) {
  const entry = map?.[status];
  return { color: entry?.color ?? 'gray', children: entry?.label ?? status ?? '—' };
};
