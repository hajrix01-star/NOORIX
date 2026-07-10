/**
 * ScreenTabs — شريط تبويبات موحّد للأقسام
 *
 * - **connected** (افتراضي): ينفّذ عبر `ConnectedTabStrip` — مصدر واحد للتصميم (سباركلاين، strut، إلخ).
 * - **underline** / **segmented**: للأشرطة المخصّصة أو المدمجة في جداول/مودالات.
 *
 * items[].label يقبل ReactNode (نص، أيقونة، إلخ)
 */
import React, { type ReactNode } from 'react';
import { useUiDir } from '../hooks/useUiDir';
import Button, { type ButtonProps } from './Button';
import ConnectedTabStrip from './ConnectedTabStrip';
import { cn } from './cn';

export type ScreenTabItem = { id: string; label: ReactNode };

export type ScreenTabsProps = {
  items: ScreenTabItem[];
  value: string;
  onChange: (id: string) => void;
  variant?: 'connected' | 'underline' | 'segmented' | string;
  fadeWrap?: boolean;
  className?: string;
  barClassName?: string;
  buttonSize?: 'auto' | 'sm' | 'md' | 'lg' | string;
  getTabClassName?: (item: ScreenTabItem, active: boolean) => string | undefined;
  omitDefaultBarClasses?: boolean;
  children?: ReactNode;
  contentClassName?: string;
  shellClassName?: string;
  stripClassName?: string;
  compactMobile?: boolean;
  animateContent?: boolean;
  tabBarEnd?: ReactNode;
  /** segmented: بدون كرت ثانٍ — شريط داخل حاوية أب (مثل HR) */
  segmentedFlat?: boolean;
};

export default function ScreenTabs({
  items,
  value,
  onChange,
  variant = 'connected',
  fadeWrap = true,
  className,
  barClassName,
  buttonSize = 'auto',
  getTabClassName,
  omitDefaultBarClasses = false,
  children,
  contentClassName,
  shellClassName,
  stripClassName,
  compactMobile,
  animateContent = true,
  tabBarEnd,
  segmentedFlat = false,
}: ScreenTabsProps) {
  const uiDir = useUiDir();
  /** توزيع متساوٍ على الجوال بدون تمرير — مناسب لمعظم شاشات الأقسام (≤8 تبويبات) */
  const resolvedCompactMobile = compactMobile ?? (items.length > 0 && items.length <= 8);

  if (variant === 'connected') {
    return (
      <ConnectedTabStrip
        items={items}
        value={value}
        onChange={onChange}
        animateContent={animateContent}
        contentClassName={contentClassName}
        shellClassName={cn(className, shellClassName)}
        stripClassName={stripClassName}
        compactMobile={resolvedCompactMobile}
        tabBarEnd={tabBarEnd}
      >
        {children}
      </ConnectedTabStrip>
    );
  }

  const bar = (
    <div
      role="tablist"
      dir={uiDir}
      className={cn(
        variant === 'underline' && !omitDefaultBarClasses && 'nx-tab-bar',
        variant === 'segmented' && !omitDefaultBarClasses && 'nx-segmented-tab-bar',
        barClassName,
      )}
    >
      {items.map((item) => {
        const active = item.id === value;
        return (
          <Button
            key={item.id}
            type="button"
            variant="raw"
            size={(variant === 'segmented' ? 'auto' : buttonSize) as ButtonProps['size']}
            role="tab"
            aria-selected={active}
            className={cn(
              'nx-tab-btn',
              variant === 'underline' && active && 'nx-tab-btn--active',
              variant === 'segmented' && 'nx-tab-btn--segmented',
              variant === 'segmented' && active && !getTabClassName && 'nx-tab-btn--segmented-active',
              getTabClassName?.(item, active),
            )}
            onClick={() => onChange(item.id)}
            data-active={active ? 'true' : 'false'}
          >
            {item.label}
          </Button>
        );
      })}
    </div>
  );

  const useShell = fadeWrap || variant === 'segmented';
  if (!useShell) {
    return <div className={className}>{bar}</div>;
  }

  const shellClass =
    variant === 'segmented'
      ? cn(
          segmentedFlat
            ? 'nx-segmented-shell--flat relative w-full min-w-0'
            : 'relative w-full min-w-0 rounded-xl border border-noorix-border bg-noorix-bg-muted p-1',
          className,
        )
      : cn('relative nx-tab-bar-fade-wrap', className);

  if (variant === 'segmented') {
    return (
      <div className={cn('flex w-full min-w-0 flex-col', shellClassName)}>
        <div className={cn(shellClass, 'relative z-[3] w-full min-w-0')}>{bar}</div>
        {children != null && (
          <div className={cn(contentClassName)} role="tabpanel">
            {children}
          </div>
        )}
      </div>
    );
  }

  return <div className={shellClass}>{bar}</div>;
}
