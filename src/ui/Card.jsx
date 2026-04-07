/**
 * Card — مكوّن البطاقات الموحّد لنظام نووريكس
 * variants: surface | exec | stat | plain
 */
import React from 'react';
import { cn } from './cn';

const PAD = { none: '', sm: 'p-3', md: 'p-4 lg:p-5', lg: 'p-5 lg:p-6' };

const STRIPE_COLOR = {
  blue:   'border-t-noorix-blue',
  green:  'border-t-noorix-green',
  red:    'border-t-noorix-red',
  amber:  'border-t-noorix-amber',
  violet: 'border-t-noorix-violet',
};

const STAT_COLOR = {
  blue:   { accent: 'var(--noorix-accent-blue)', bg: 'rgba(37,99,235,0.08)'  },
  green:  { accent: 'var(--noorix-accent-green)', bg: 'rgba(22,163,74,0.08)'  },
  red:    { accent: 'var(--noorix-accent-red)', bg: 'rgba(220,38,38,0.08)'   },
  amber:  { accent: 'var(--noorix-accent-amber)', bg: 'rgba(217,119,6,0.08)'   },
  violet: { accent: 'var(--noorix-accent-violet)', bg: 'rgba(99,102,241,0.08)'  },
  gray:   { accent: '#64748b', bg: 'rgba(100,116,139,0.08)' },
};

export function SurfaceCard({ padding = 'md', className = '', children, onClick, ...rest }) {
  return (
    <div
      className={cn(
        'bg-noorix-surface rounded-xl border border-noorix-border shadow-sm noorix-surface-card',
        PAD[padding] ?? PAD.md,
        onClick && 'cursor-pointer hover:shadow-md transition-shadow',
        className,
      )}
      onClick={onClick}
      {...rest}
    >
      {children}
    </div>
  );
}

export function ExecCard({ stripe = 'blue', title, subtitle, value, icon, footer, className = '', children, ...rest }) {
  return (
    <div
      className={cn(
        'bg-noorix-surface rounded-xl border border-noorix-border shadow-sm border-t-4',
        STRIPE_COLOR[stripe] ?? STRIPE_COLOR.blue,
        'noorix-exec-card',
        className,
      )}
      {...rest}
    >
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

export function StatCard({ color = 'blue', label, value, delta, icon, className = '', children, ...rest }) {
  const palette = STAT_COLOR[color] ?? STAT_COLOR.blue;
  return (
    <div
      className={cn('bg-noorix-surface rounded-xl border border-noorix-border shadow-sm p-4 noorix-stat-card', className)}
      {...rest}
    >
      <div className="flex items-center gap-3">
        {icon && (
          <span
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-[18px]"
            style={{ background: palette.bg, color: palette.accent }}
            aria-hidden="true"
          >{icon}</span>
        )}
        <div className="min-w-0 flex-1">
          {label !== undefined && <p className="text-[12px] text-noorix-muted truncate">{label}</p>}
          {value !== undefined && <p className="text-[18px] font-bold" style={{ color: palette.accent }}>{value}</p>}
          {delta !== undefined && (
            <p className={`text-[11px] font-semibold ${Number(delta) >= 0 ? 'text-noorix-green' : 'text-noorix-red'}`}>
              {Number(delta) >= 0 ? '↑' : '↓'} {Math.abs(delta)}%
            </p>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

export default function Card({ variant = 'surface', ...props }) {
  if (variant === 'exec')  return <ExecCard {...props} />;
  if (variant === 'stat')  return <StatCard {...props} />;
  if (variant === 'plain') {
    const { padding = 'md', className = '', children, ...rest } = props;
    return <div className={cn(PAD[padding] ?? PAD.md, className)} {...rest}>{children}</div>;
  }
  return <SurfaceCard {...props} />;
}
