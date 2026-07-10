/**
 * شريط أدوات موحّد لتبويبات HR — فلاتر مضغوطة على الجوال، صف كامل على lg+.
 */
import React, { useState, type ReactNode } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { useIsMobile640 } from '../../../ui';
import { Button, FilterToolbar, KebabMenu, cn } from '../../../ui';

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
  const hasActionsRow = hasFilters || showMenu || showPrimary || desktopActions;

  return (
    <>
      <div className={cn('nx-hr-tab-toolbar mb-3 flex w-full min-w-0 flex-col gap-3', className)}>
        {leading ? <div className="w-full min-w-0">{leading}</div> : null}

        {hasActionsRow ? (
          <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:gap-3">
            {hasFilters && isMobile ? (
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
            ) : null}

            {hasFilters && !isMobile ? (
              <FilterToolbar
                className="min-w-0 flex-1"
                filtersClassName="nx-toolbar min-w-0 flex-1 flex-wrap"
              >
                {filters}
              </FilterToolbar>
            ) : null}

            {!isMobile && desktopActions}

            {showMenu ? (
              <KebabMenu
                ariaLabel={menuAriaLabel || t('actions')}
                items={menuItems}
                buttonClassName="min-h-[44px] min-w-[44px]"
              />
            ) : null}

            {showPrimary ? (
              <Button
                variant="primary"
                size="sm"
                className={cn(
                  'min-h-[44px] shrink-0 whitespace-nowrap',
                  isMobile ? 'w-full sm:w-auto' : 'ms-auto sm:ms-0',
                )}
                onClick={primaryAction.onClick}
              >
                {primaryAction.label}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {hasFilters && isMobile ? (
        <HrFilterSheet
          open={filterOpen}
          onClose={() => setFilterOpen(false)}
          onReset={onResetFilters}
          showReset={!!onResetFilters}
        >
          {filters}
        </HrFilterSheet>
      ) : null}
    </>
  );
}
