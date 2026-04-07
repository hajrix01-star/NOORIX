/**
 * Divider — فاصل أفقي/عمودي بسيط
 */
import React from 'react';
import { cn } from './cn';

export default function Divider({ label, vertical = false, className = '', ...rest }) {
  if (vertical) {
    return (
      <span
        className={cn('inline-block w-px self-stretch bg-noorix-border mx-2', className)}
        aria-hidden="true"
        {...rest}
      />
    );
  }
  if (label) {
    return (
      <div className={cn('flex items-center gap-3 my-2', className)} {...rest}>
        <span className="flex-1 h-px bg-noorix-border" aria-hidden="true" />
        <span className="text-[12px] text-noorix-muted whitespace-nowrap">{label}</span>
        <span className="flex-1 h-px bg-noorix-border" aria-hidden="true" />
      </div>
    );
  }
  return (
    <hr
      className={cn('border-0 border-t border-noorix-border my-2', className)}
      aria-hidden="true"
      {...rest}
    />
  );
}
