import React, { type ReactNode } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { cn } from '../../ui';

export type LoadingStateProps = {
  className?: string;
  message?: ReactNode;
};

/** حالة تحميل موحّدة — دعم RTL تلقائي من السياق */
export function LoadingState({ className, message }: LoadingStateProps) {
  const { t } = useTranslation();
  return (
    <div className={cn('flex items-center justify-center gap-2 text-noorix-muted text-[13px]', className)} dir="auto">
      {message ?? t('loading')}
    </div>
  );
}
