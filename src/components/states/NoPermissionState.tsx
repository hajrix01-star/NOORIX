import React from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { cn } from '../../ui';

export type NoPermissionStateProps = {
  className?: string;
};

/** رسالة صلاحية — لا يُعرَض 403 كامل؛ للأقسام الداخلية إن لزم */
export function NoPermissionState({ className }: NoPermissionStateProps) {
  const { t } = useTranslation();
  return (
    <div className={cn('p-6 text-center text-noorix-muted text-[13px]', className)} dir="auto">
      {t('forbidden403Desc')}
    </div>
  );
}
