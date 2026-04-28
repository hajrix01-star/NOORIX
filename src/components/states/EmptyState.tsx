import React, { type ReactNode } from 'react';
import { cn } from '../../ui';

export type EmptyStateProps = {
  className?: string;
  icon?: ReactNode;
  children: ReactNode;
};

/** فراغ بيانات — الرسالة من children أو ترجمة من الأب */
export function EmptyState({ className, icon, children }: EmptyStateProps) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center text-noorix-muted gap-2 text-center', className)}
      dir="auto"
    >
      {icon}
      <div className="text-[12px]">{children}</div>
    </div>
  );
}
