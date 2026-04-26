/**
 * Badge — مكوّن شارة الحالة الموحّد لنظام نووريكس
 * colors: green | red | amber | blue | violet | gray | sky | navy
 */
import React from 'react';
import { cn } from './cn';

export const BADGE_COLORS = {
  green:  { bg: 'var(--noorix-green-10)',   color: 'var(--noorix-accent-green)' },
  red:    { bg: 'var(--noorix-red-10)',   color: 'var(--noorix-accent-red)' },
  amber:  { bg: 'var(--noorix-amber-12)',  color: 'var(--noorix-accent-amber)' },
  blue:   { bg: 'var(--noorix-blue-10)',   color: 'var(--noorix-accent-blue)' },
  sky:    { bg: 'var(--noorix-sky-10)',   color: 'var(--noorix-accent-sky)' },
  violet: { bg: 'var(--noorix-violet-10)',  color: 'var(--noorix-accent-violet)' },
  gray:   { bg: 'var(--noorix-muted-10)', color: 'var(--noorix-text-muted)' },
  navy:   { bg: 'var(--noorix-navy-10)',    color: 'var(--noorix-navy)' },
};

const SIZE_CLASS = {
  sm: 'text-[11px] px-2 py-0.5',
  md: 'text-[12px] px-2.5 py-0.5',
};

export default function Badge({ color = 'gray', size = 'md', dot = false, className = '', children, ...rest }: any) {
  const palette = BADGE_COLORS[color as keyof typeof BADGE_COLORS] ?? BADGE_COLORS.gray;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-semibold whitespace-nowrap',
        SIZE_CLASS[size as keyof typeof SIZE_CLASS] ?? SIZE_CLASS.md,
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

Badge.fromStatus = function fromStatus(status: any, map: any) {
  const entry = map?.[status];
  return { color: entry?.color ?? 'gray', children: entry?.label ?? status ?? '—' };
};
