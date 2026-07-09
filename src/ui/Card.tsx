/**
 * Card — مكوّن البطاقات الموحّد لنظام نووريكس
 * variants: surface | exec | stat | plain
 */
import React, { type ReactNode } from 'react';
import { cn } from './cn';

const PAD = { none: '', sm: 'p-3', md: 'p-4 lg:p-5', lg: 'p-5 lg:p-6' };

/** شريط علوي h-1 — نفس كروت لوحة التحكم */
const STRIPE_TOP = {
  blue:   'bg-noorix-blue',
  green:  'bg-noorix-green',
  red:    'bg-noorix-red',
  amber:  'bg-noorix-amber',
  violet: 'bg-noorix-violet',
};

const STAT_COLOR = {
  blue:   { accent: 'var(--noorix-accent-blue)', bg: 'var(--noorix-blue-8)'  },
  green:  { accent: 'var(--noorix-accent-green)', bg: 'var(--noorix-green-8)'  },
  red:    { accent: 'var(--noorix-accent-red)', bg: 'var(--noorix-red-8)'   },
  amber:  { accent: 'var(--noorix-accent-amber)', bg: 'var(--noorix-amber-8)'   },
  violet: { accent: 'var(--noorix-accent-violet)', bg: 'var(--noorix-violet-8)'  },
  gray:   { accent: 'var(--noorix-text-muted)', bg: 'var(--noorix-muted-8)' },
};

export type SurfaceCardProps = {
  padding?: keyof typeof PAD;
  className?: string;
  children?: ReactNode;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
} & Record<string, unknown>;

export function SurfaceCard({ padding = 'md', className = '', children, onClick, ...rest }: SurfaceCardProps) {
  return (
    <div
      className={cn(
        'noorix-surface-card min-w-0',
        PAD[padding] ?? PAD.md,
        onClick && 'cursor-pointer hover:[box-shadow:var(--noorix-card-shadow-hover)]',
        className,
      )}
      onClick={onClick}
      {...rest}
    >
      {children}
    </div>
  );
}

export type ExecCardProps = {
  stripe?: keyof typeof STRIPE_TOP | string;
  title?: ReactNode;
  subtitle?: ReactNode;
  value?: ReactNode;
  icon?: ReactNode;
  footer?: ReactNode;
  className?: string;
  children?: ReactNode;
} & Record<string, unknown>;

export function ExecCard({ stripe = 'blue', title, subtitle, value, icon, footer, className = '', children, ...rest }: ExecCardProps) {
  return (
    <div
      className={cn(
        'noorix-exec-card relative',
        className,
      )}
      {...rest}
    >
      <span
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 z-[1] h-1',
          STRIPE_TOP[stripe as keyof typeof STRIPE_TOP] ?? STRIPE_TOP.blue,
        )}
        aria-hidden
      />
      <div className="flex items-center gap-2.5 p-3.5 pb-2">
        {icon && <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-noorix-bg-muted" aria-hidden="true">{icon}</span>}
        <div className="min-w-0">
          {title    && <h3 className="text-[11px] font-bold text-noorix-muted uppercase tracking-wide truncate">{title}</h3>}
          {subtitle && <p  className="text-[12px] text-noorix-muted">{subtitle}</p>}
        </div>
      </div>
      {value !== undefined && (
        <div className="px-3.5 pb-2 text-[20px] font-bold text-noorix-text">{value}</div>
      )}
      {children}
      {footer && <div className="px-3.5 py-2 border-t border-noorix-border text-[12px] text-noorix-muted">{footer}</div>}
    </div>
  );
}

export type StatCardProps = {
  color?: keyof typeof STAT_COLOR | string;
  label?: ReactNode;
  value?: ReactNode;
  /** نسبة مئوية للعرض في شريط دلتا الكرت */
  delta?: number | string;
  icon?: ReactNode;
  className?: string;
  children?: ReactNode;
} & Record<string, unknown>;

export function StatCard({ color = 'blue', label, value, delta, icon, className = '', children, ...rest }: StatCardProps) {
  const palette = STAT_COLOR[color as keyof typeof STAT_COLOR] ?? STAT_COLOR.blue;
  const statStyle = {
    '--nx-stat-accent': palette.accent,
    '--nx-stat-bg': palette.bg,
  } as React.CSSProperties;
  return (
    <div
      className={cn('noorix-stat-card p-4', className)}
      style={statStyle}
      {...rest}
    >
      <div className="flex items-center gap-3">
        {icon && (
          <span
            className="nx-stat-card-icon w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-[18px]"
            aria-hidden="true"
          >{icon}</span>
        )}
        <div className="min-w-0 flex-1">
          {label !== undefined && <p className="text-[12px] text-noorix-muted truncate">{label}</p>}
          {value !== undefined && <p className="nx-stat-card-value text-[18px] font-bold">{value}</p>}
          {delta !== undefined && (
            <p className={`text-[11px] font-semibold ${Number(delta) >= 0 ? 'text-noorix-green' : 'text-noorix-red'}`}>
              {Number(delta) >= 0 ? '↑' : '↓'} {Math.abs(Number(delta))}%
            </p>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

export type CardProps = {
  variant?: string;
} & Record<string, unknown>;

export default function Card({ variant = 'surface', ...props }: CardProps) {
  const p = props as Record<string, unknown>;
  if (variant === 'exec') return <ExecCard {...p} />;
  if (variant === 'stat') return <StatCard {...p} />;
  if (variant === 'plain') {
    const { padding = 'md', className = '', children, ...rest } = p;
    return (
      <div className={cn(PAD[padding as keyof typeof PAD] ?? PAD.md, String(className || ''))} {...rest}>
        {children as ReactNode}
      </div>
    );
  }
  return <SurfaceCard {...p} />;
}
