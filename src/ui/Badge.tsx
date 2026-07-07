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

export type BadgeColor = keyof typeof BADGE_COLORS | string;
export type BadgeSize = keyof typeof SIZE_CLASS;

export type BadgeProps = React.ComponentPropsWithoutRef<'span'> & {
  color?: BadgeColor;
  size?: BadgeSize;
  dot?: boolean;
  label?: React.ReactNode;
};

export type BadgeStatusMap = Record<string, { color?: BadgeColor; label?: React.ReactNode } | unknown>;

export type BadgeFromStatusResult = {
  color: BadgeColor;
  children: React.ReactNode;
};

type BadgeComponent = ((props: BadgeProps) => React.ReactElement) & {
  fromStatus: (status: unknown, map?: BadgeStatusMap) => BadgeFromStatusResult;
};

function BadgeBase({ color = 'gray', size = 'md', dot = false, className = '', children, label, ...rest }: BadgeProps) {
  const palette = BADGE_COLORS[color as keyof typeof BADGE_COLORS] ?? BADGE_COLORS.gray;
  const badgeStyle = {
    '--nx-badge-bg': palette.bg,
    '--nx-badge-color': palette.color,
  } as React.CSSProperties;

  return (
    <span
      className={cn(
        'nx-badge inline-flex items-center gap-1 rounded-full font-semibold whitespace-nowrap',
        SIZE_CLASS[size as keyof typeof SIZE_CLASS] ?? SIZE_CLASS.md,
        className,
      )}
      style={badgeStyle}
      {...rest}
    >
      {dot && (
        <span
          className="nx-badge-dot w-1.5 h-1.5 rounded-full shrink-0"
          aria-hidden="true"
        />
      )}
      {children ?? label}
    </span>
  );
}

const Badge = BadgeBase as BadgeComponent;

Badge.fromStatus = function fromStatus(status: unknown, map?: BadgeStatusMap) {
  const key = status == null ? '' : String(status);
  const rawEntry = map?.[key];
  const entry = rawEntry && typeof rawEntry === 'object'
    ? rawEntry as { color?: BadgeColor; label?: React.ReactNode }
    : undefined;
  const children = entry?.label ?? (status == null ? '—' : String(status));
  return { color: entry?.color ?? 'gray', children };
};

export default Badge;
