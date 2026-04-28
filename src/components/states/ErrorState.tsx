import React, { type ReactNode } from 'react';
import { cn } from '../../ui';

export type ErrorStateProps = {
  className?: string;
  title?: ReactNode;
  children: ReactNode;
};

/** خطأ قابل للعرض في بطاقة أو قسم */
export function ErrorState({ className, title, children }: ErrorStateProps) {
  return (
    <div
      className={cn(
        'rounded border border-noorix-red/20 bg-noorix-red/5 p-5 text-noorix-red text-[13px]',
        className,
      )}
      dir="auto"
      role="alert"
    >
      {title != null && <div className="font-semibold mb-1">{title}</div>}
      {children}
    </div>
  );
}
