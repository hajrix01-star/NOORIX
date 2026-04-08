/**
 * ScreenTabs — شريط تبويبات موحّد للأقسام
 *
 * - **connected** (افتراضي): ينفّذ عبر `ConnectedTabStrip` — مصدر واحد للتصميم (سباركلاين، strut، إلخ).
 * - **underline** / **segmented**: للأشرطة المخصّصة أو المدمجة في جداول/مودالات.
 *
 * items[].label يقبل ReactNode (نص، أيقونة، إلخ)
 */
import React from 'react';
import { useUiDir } from '../hooks/useUiDir';
import Button from './Button';
import ConnectedTabStrip from './ConnectedTabStrip';
import { cn } from './cn';

/**
 * @typedef {{ id: string; label: React.ReactNode }} ScreenTabItem
 */

/**
 * @param {{
 *   items: ScreenTabItem[];
 *   value: string;
 *   onChange: (id: string) => void;
 *   variant?: 'connected' | 'underline' | 'segmented';
 *   fadeWrap?: boolean;
 *   className?: string;
 *   barClassName?: string;
 *   buttonSize?: 'auto' | 'sm' | 'md' | 'lg';
 *   getTabClassName?: (item: ScreenTabItem, active: boolean) => string | undefined;
 *   omitDefaultBarClasses?: boolean;
 *   children?: React.ReactNode — مطلوب مع variant="connected" (محتوى التبويبات)
 *   contentClassName?: string — غلاف المحتوى داخل ConnectedTabStrip (مثل nx-tab-content)
 *   shellClassName?: string — على الكرت الخارجي للـ connected (يُدمج مع className)
 *   animateContent?: boolean — افتراضي true للـ connected
 *   tabBarEnd?: React.ReactNode — مع variant connected: محتوى بجانب التبويبات (نفس الصف على sm+)
 * }} props
 */
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
  animateContent = true,
  tabBarEnd,
}) {
  const uiDir = useUiDir();

  if (variant === 'connected') {
    return (
      <ConnectedTabStrip
        items={items}
        value={value}
        onChange={onChange}
        animateContent={animateContent}
        contentClassName={contentClassName}
        shellClassName={cn(className, shellClassName)}
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
            size={variant === 'segmented' ? 'auto' : buttonSize}
            role="tab"
            aria-selected={active}
            className={cn(
              'nx-tab-btn',
              variant === 'underline' && active && 'nx-tab-btn--active',
              variant === 'segmented' && 'nx-tab-btn--segmented',
              variant === 'segmented' && active && 'nx-tab-btn--segmented-active',
              getTabClassName?.(item, active),
            )}
            onClick={() => {
              if (item.id !== value) onChange(item.id);
            }}
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
          'relative bg-noorix-surface rounded-xl border border-noorix-border p-1',
          className,
        )
      : cn('relative nx-tab-bar-fade-wrap', className);

  return <div className={shellClass}>{bar}</div>;
}
