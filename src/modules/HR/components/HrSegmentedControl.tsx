/**
 * شريط تبويبات فرعية HR — يستخدم نفس محرك التبويبات الرئيسية.
 * المستوى 2: tone="section" — تنقل بين تبويبات القسم.
 * المستوى 3: tone="filter" — فلاتر داخل الشاشة (نشطون | مفصولين | …).
 */
import React, { type ReactNode } from 'react';
import { cn, ScreenTabs } from '../../../ui';
import { type ScreenTabItem } from '../../../ui/ScreenTabs';
import {
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
      variant="connected"
      compactMobile={false}
      compactAll={false}
      embedded
      animateContent={false}
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
