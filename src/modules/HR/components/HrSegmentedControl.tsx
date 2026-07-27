/**
 * شريط تبويبات فرعية HR — pills (segmented) بدون sparkline.
 * المستوى 2: tone="section" — تنقل بين تبويبات القسم.
 * المستوى 3: tone="filter" — فلاتر داخل الشاشة (نشطون | مفصولين | …).
 */
import React, { type ReactNode } from 'react';
import { cn, ScreenTabs } from '../../../ui';
import { type ScreenTabItem } from '../../../ui/ScreenTabs';
import {
  HR_SEGMENTED_BAR_CLASS,
  HR_SUBTAB_INLINE_CLASS,
  HR_SUBTAB_SHELL_CLASS,
  HR_WORKSPACE_GUTTER_X,
} from '../hrWorkspaceLayout';

export type HrSegmentedControlProps = {
  items: ScreenTabItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
  shellClassName?: string;
  children?: ReactNode;
  contentClassName?: string;
  /** false داخل جسم المحتوى — الهامش من الأب فقط */
  shellInset?: boolean;
  /** section = تبويبات فرعية | filter = فلاتر عرض البيانات */
  tone?: 'section' | 'filter';
};

export function HrSegmentedControl({
  items,
  value,
  onChange,
  className,
  shellClassName,
  children,
  contentClassName,
  shellInset = true,
  tone = 'section',
}: HrSegmentedControlProps) {
  const isFilter = tone === 'filter';

  return (
    <ScreenTabs
      items={items}
      value={value}
      onChange={onChange}
      variant="segmented"
      segmentedFlat
      animateContent={false}
      barClassName={cn(
        isFilter
          ? 'nx-segmented-tab-bar nx-hr-filter-pills'
          : HR_SEGMENTED_BAR_CLASS,
      )}
      getTabClassName={(_, active) =>
        cn(
          'nx-hr-segment-pill',
          isFilter ? 'nx-hr-segment-pill--filter' : 'nx-hr-segment-pill--section',
          active && 'nx-hr-segment-pill--active',
        )
      }
      shellClassName={cn(
        isFilter
          ? 'nx-hr-filter-shell w-full min-w-0'
          : shellInset
            ? cn(HR_SUBTAB_SHELL_CLASS, HR_WORKSPACE_GUTTER_X, 'nx-hr-subtab-section pt-2 sm:pt-2.5 pb-0')
            : HR_SUBTAB_INLINE_CLASS,
        className,
        shellClassName,
      )}
      contentClassName={contentClassName}
    >
      {children}
    </ScreenTabs>
  );
}
