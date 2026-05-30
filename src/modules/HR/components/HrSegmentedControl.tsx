/**
 * شريط تبويبات segmented موحّد لـ HR — حالة نشطة واضحة (Tailwind فوق طبقة components).
 */
import React, { type ReactNode } from 'react';
import { cn } from '../../../ui';
import ScreenTabs, { type ScreenTabItem } from '../../../ui/ScreenTabs';
import { HR_SEGMENTED_BAR_CLASS } from '../hrWorkspaceLayout';

export function hrSegmentedTabClassName(active: boolean) {
  return cn(
    'flex-1 min-w-0 min-h-[40px] rounded-lg border text-[12px] sm:text-[13px] leading-snug',
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
};

export function HrSegmentedControl({
  items,
  value,
  onChange,
  className,
  shellClassName,
  children,
  contentClassName,
}: HrSegmentedControlProps) {
  return (
    <ScreenTabs
      items={items}
      value={value}
      onChange={onChange}
      variant="segmented"
      segmentedFlat
      barClassName={HR_SEGMENTED_BAR_CLASS}
      shellClassName={cn('w-full min-w-0', shellClassName)}
      className={className}
      getTabClassName={(_, active) => hrSegmentedTabClassName(active)}
      animateContent={false}
      contentClassName={contentClassName}
    >
      {children}
    </ScreenTabs>
  );
}
