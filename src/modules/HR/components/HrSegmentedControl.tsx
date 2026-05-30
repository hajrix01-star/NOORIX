/**
 * شريط تبويبات segmented موحّد لـ HR — حالة نشطة واضحة + هوامش متسقة.
 */
import React, { type ReactNode } from 'react';
import { cn } from '../../../ui';
import ScreenTabs, { type ScreenTabItem } from '../../../ui/ScreenTabs';
import {
  HR_SEGMENTED_BAR_CLASS,
  HR_SEGMENTED_INLINE_CLASS,
  HR_SEGMENTED_SHELL_INSET_CLASS,
} from '../hrWorkspaceLayout';

export function hrSegmentedTabClassName(active: boolean) {
  return cn(
    'flex-1 min-w-0 min-h-[42px] rounded-lg border',
    'px-2.5 py-2 sm:px-3 sm:py-2.5',
    'text-[12px] sm:text-[13px] leading-snug',
    'transition-[color,background-color,box-shadow,border-color] duration-150',
    active
      ? 'border-noorix-border bg-noorix-surface font-bold text-noorix-blue shadow-sm'
      : 'border-transparent bg-transparent font-semibold text-noorix-muted hover:bg-noorix-surface/80 hover:text-noorix-text',
  );
}

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
  const paddedItems = items.map((item) => ({
    ...item,
    label: (
      <span className="block w-full min-w-0 truncate px-0.5 text-center">{item.label}</span>
    ),
  }));

  return (
    <ScreenTabs
      items={paddedItems}
      value={value}
      onChange={onChange}
      variant="segmented"
      segmentedFlat
      barClassName={HR_SEGMENTED_BAR_CLASS}
      shellClassName={cn('w-full min-w-0', shellClassName)}
      className={cn(
        shellInset ? HR_SEGMENTED_SHELL_INSET_CLASS : cn(HR_SEGMENTED_INLINE_CLASS, '!p-0 !border-0'),
        className,
      )}
      getTabClassName={(_, active) => hrSegmentedTabClassName(active)}
      animateContent={false}
      contentClassName={contentClassName}
    >
      {children}
    </ScreenTabs>
  );
}
