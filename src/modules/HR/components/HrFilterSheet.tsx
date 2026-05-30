/**
 * Sheet فلاتر HR على الجوال — نفس حقول سطح المكتب داخل AdaptiveSheet.
 */
import React, { type ReactNode } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { AdaptiveSheet, Button } from '../../../ui';

export type HrFilterSheetProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  onReset?: () => void;
  showReset?: boolean;
};

export function HrFilterSheet({
  open,
  onClose,
  children,
  onReset,
  showReset = true,
}: HrFilterSheetProps) {
  const { t } = useTranslation();

  return (
    <AdaptiveSheet
      open={open}
      onClose={onClose}
      title={t('hrFiltersTitle')}
      size="md"
    >
      <div className="flex flex-col gap-4 pb-2">
        <div className="flex flex-col gap-3">{children}</div>
        <div className="flex flex-wrap items-center gap-2 border-t border-noorix-border pt-4">
          {showReset && onReset && (
            <Button variant="ghost" size="sm" className="min-h-[44px] flex-1" onClick={onReset}>
              {t('hrFiltersReset')}
            </Button>
          )}
          <Button variant="primary" size="sm" className="min-h-[44px] flex-1" onClick={onClose}>
            {t('hrFiltersApply')}
          </Button>
        </div>
      </div>
    </AdaptiveSheet>
  );
}
