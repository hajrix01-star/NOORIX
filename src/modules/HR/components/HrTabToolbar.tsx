/**
 * شريط أدوات موحّد لتبويبات HR — فلاتر مضغوطة على الجوال، صف كامل على lg+.
 */
import React, { useState, type ReactNode } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { useIsMobile640 } from '../../../hooks/useMediaQuery';
import { Button, KebabMenu, cn } from '../../../ui';

export type HrTabToolbarMenuItem = {
  key: string;
  label: ReactNode;
  onClick: () => void;
  hidden?: boolean;
  style?: React.CSSProperties;
};
import { HrFilterSheet } from './HrFilterSheet';

export type HrTabToolbarProps = {
  className?: string;
  /** عناصر دائمة (مثل سنة) — تظهر على كل العروض */
  leading?: ReactNode;
  /** حقول الفلتر — lg+ في الشريط؛ جوال داخل Sheet */
  filters?: ReactNode;
  activeFilterCount?: number;
  onResetFilters?: () => void;
  primaryAction?: { label: string; onClick: () => void; hidden?: boolean };
  menuItems?: HrTabToolbarMenuItem[];
  menuAriaLabel?: string;
  /** أزرار إضافية على سطح المكتب بجانب الفلاتر */
  desktopActions?: ReactNode;
};

export function HrTabToolbar({
  className,
  leading,
  filters,
  activeFilterCount = 0,
  onResetFilters,
  primaryAction,
  menuItems,
  menuAriaLabel,
  desktopActions,
}: HrTabToolbarProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile640();
  const [filterOpen, setFilterOpen] = useState(false);

  const hasFilters = filters != null;
  const hasMenu = menuItems != null && menuItems.length > 0;
  const showMenu = hasMenu && (isMobile || !desktopActions);
  const showPrimary = primaryAction && !primaryAction.hidden;

  return (
    <>
      <div
        className={cn(
          'nx-hr-tab-toolbar mb-3 flex min-h-11 flex-wrap items-center gap-2',
          className,
        )}
      >
        {leading && <div className="flex min-w-0 flex-wrap items-center gap-2">{leading}</div>}

        {hasFilters && isMobile && (
          <Button
            size="sm"
            variant="ghost"
            className="min-h-[44px] shrink-0"
            onClick={() => setFilterOpen(true)}
          >
            {t('hrFilters')}
            {activeFilterCount > 0 ? (
              <span className="ms-1 rounded-full bg-noorix-blue px-1.5 py-0.5 text-[11px] font-bold text-white tabular-nums">
                {activeFilterCount}
              </span>
            ) : null}
          </Button>
        )}

        {hasFilters && !isMobile && (
          <div className="nx-toolbar min-w-0 flex-1 flex-wrap">{filters}</div>
        )}

        {!isMobile && desktopActions}

        {showMenu && (
          <KebabMenu
            ariaLabel={menuAriaLabel || t('actions')}
            items={menuItems}
            buttonClassName="min-h-[44px] min-w-[44px]"
          />
        )}

        {showPrimary && (
          <Button
            variant="primary"
            size="sm"
            className="ms-auto min-h-[44px] shrink-0 sm:ms-0"
            onClick={primaryAction.onClick}
          >
            {primaryAction.label}
          </Button>
        )}
      </div>

      {hasFilters && isMobile && (
        <HrFilterSheet
          open={filterOpen}
          onClose={() => setFilterOpen(false)}
          onReset={onResetFilters}
          showReset={!!onResetFilters}
        >
          {filters}
        </HrFilterSheet>
      )}
    </>
  );
}
