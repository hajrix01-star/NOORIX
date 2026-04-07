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
}) {
  const bar = (
    <div
      role="tablist"
      className={cn(
        variant === 'underline' && 'nx-tab-bar',
        variant === 'segmented' && 'nx-segmented-tab-bar',
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
            )}
            onClick={() => onChange(item.id)}
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
          'relative nx-tab-bar-fade-wrap bg-noorix-surface rounded-xl border border-noorix-border p-1',
          className,
        )
      : cn('relative nx-tab-bar-fade-wrap', className);

  return <div className={shellClass}>{bar}</div>;
}
