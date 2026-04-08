/**
 * ScreenTabs — شريط تبويبات موحّد للأقسام (نمط underline أو segmented)
 *
 * items[].label يقبل ReactNode (نص، أيقونة، إلخ)
 */
import React from 'react';
import Button from './Button';
import { cn } from './cn';

/**
 * @typedef {{ id: string; label: React.ReactNode }} ScreenTabItem
 */

/**
 * @param {{
 *   items: ScreenTabItem[];
 *   value: string;
 *   onChange: (id: string) => void;
 *   variant?: 'underline' | 'segmented';
 *   fadeWrap?: boolean;
 *   className?: string;
 *   barClassName?: string;
 *   buttonSize?: 'auto' | 'sm' | 'md' | 'lg';
 *   getTabClassName?: (item: ScreenTabItem, active: boolean) => string | undefined;
 *   omitDefaultBarClasses?: boolean — عند true لا يُضاف nx-tab-bar / nx-segmented-tab-bar (لأشرطة مخصّصة مثل الإعدادات)
 * }} props
 */
export default function ScreenTabs({
  items,
  value,
  onChange,
  variant = 'underline',
  fadeWrap = true,
  className,
  barClassName,
  buttonSize = 'auto',
  getTabClassName,
  omitDefaultBarClasses = false,
}) {
  /* dir="ltr" على الشريط فقط: ترتيب التبويبات يطابق ترتيب المصفوفة (يسار→يمين)
     ولا يعكسه اتجاه الصفحة RTL؛ نص كل تبويب يبقى عربي/إنجليزي طبيعي داخل الزر */
  const bar = (
    <div
      role="tablist"
      dir="ltr"
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
            size={buttonSize}
            role="tab"
            aria-selected={active}
            className={cn(
              'nx-tab-btn',
              variant === 'underline' && active && 'nx-tab-btn--active',
              variant === 'segmented' && 'nx-tab-btn--segmented',
              variant === 'segmented' && active && 'nx-tab-btn--segmented-active',
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

  /* segmented: بدون nx-tab-bar-fade-wrap — الـ ::after يغطي آخر تبويب (مثل «شهري») ولا حاجة لتلاشي التمرير هنا */
  const shellClass =
    variant === 'segmented'
      ? cn(
          'relative bg-noorix-surface rounded-xl border border-noorix-border p-1',
          className,
        )
      : cn('relative nx-tab-bar-fade-wrap', className);

  return <div className={shellClass}>{bar}</div>;
}
