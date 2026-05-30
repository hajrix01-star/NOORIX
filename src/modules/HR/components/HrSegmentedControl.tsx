/**
 * شريط تبويبات فرعية HR — نفس أسلوب التبويبات الرئيسية (زوايا حادة + سباركلاين).
 */
import React, { type ReactNode } from 'react';
import { cn } from '../../../ui';
import ConnectedTabStrip from '../../../ui/ConnectedTabStrip';
import { type ScreenTabItem } from '../../../ui/ScreenTabs';
import {
  HR_SUBTAB_INLINE_CLASS,
  HR_SUBTAB_SHELL_CLASS,
} from '../hrWorkspaceLayout';

export type HrSegmentedControlProps = {
  items: ScreenTabItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
  shellClassName?: string;
  children?: ReactNode;
  contentClassName?: string;
  /** false داخل جسم المحتوى (فلاتر الموظفين) — الهامش من الأب فقط */
  shellInset?: boolean;
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
}: HrSegmentedControlProps) {
  return (
    <ConnectedTabStrip
      items={items}
      value={value}
      onChange={onChange}
      embedded
      compactAll
      animateContent={false}
      shellClassName={cn(
        'relative z-[3] w-full min-w-0',
        shellInset ? HR_SUBTAB_SHELL_CLASS : HR_SUBTAB_INLINE_CLASS,
        shellClassName,
        className,
      )}
      contentClassName={contentClassName}
    >
      {children}
    </ConnectedTabStrip>
  );
}
