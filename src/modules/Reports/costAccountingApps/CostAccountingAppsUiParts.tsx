import React from 'react';
import { cn } from '../../../ui';

export function Field({
  label,
  children,
  className,
  labelAlign = 'center',
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** محاذاة عنوان الحقل فوق الخانة */
  labelAlign?: 'start' | 'center' | 'end';
}) {
  const align =
    labelAlign === 'start' ? 'text-start' : labelAlign === 'end' ? 'text-end' : 'text-center';
  return (
    <div className={cn('flex min-w-0 flex-col gap-1', className)}>
      <span
        className={cn('line-clamp-2 text-[11px] font-bold leading-tight text-noorix-text', align)}
        title={typeof label === 'string' ? label : undefined}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

export function SectionHeading({
  children,
  tone = 'blue',
}: {
  children: React.ReactNode;
  tone?: 'blue' | 'green' | 'amber' | 'slate' | 'rose';
}) {
  const bar = {
    blue: 'bg-noorix-blue',
    green: 'bg-noorix-green',
    amber: 'bg-noorix-amber',
    slate: 'bg-noorix-text/45',
    rose: 'bg-noorix-red',
  }[tone];
  const shell = {
    blue: 'border-noorix-blue/25 bg-gradient-to-br from-noorix-blue/[0.12] via-noorix-blue/[0.04] to-[var(--noorix-surface-2)]',
    green: 'border-noorix-green/25 bg-gradient-to-br from-noorix-green/[0.11] via-noorix-green/[0.04] to-[var(--noorix-surface-2)]',
    amber: 'border-noorix-amber/35 bg-gradient-to-br from-noorix-amber/[0.14] via-noorix-amber/[0.05] to-[var(--noorix-surface-2)]',
    slate: 'border-noorix-border bg-gradient-to-br from-[var(--noorix-surface-2)] to-[var(--noorix-surface-1)]',
    rose: 'border-noorix-red/25 bg-gradient-to-br from-noorix-red/[0.09] via-noorix-red/[0.03] to-[var(--noorix-surface-2)]',
  }[tone];
  return (
    <div className={cn('mb-1 flex items-center gap-2.5 rounded-lg border px-3 py-2 shadow-sm', shell)}>
      <span className={cn('h-7 w-1 shrink-0 rounded-full', bar)} aria-hidden />
      <h3 className="m-0 min-w-0 text-[12px] font-bold leading-snug tracking-wide text-noorix-text">{children}</h3>
    </div>
  );
}
