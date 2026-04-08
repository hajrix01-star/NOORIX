import React from 'react';
import Button from './Button';
import { cn } from './cn';

/**
 * شريط تبويبات متصل — زوايا علوية ناعمة، فواصل عمودية، سباركلاين للنشط أسفل التسمية، انتقال للمحتوى.
 * يُستخدم في الموارد البشرية ومعرض التجارب (ref #3).
 *
 * @param {{ id: string; label: React.ReactNode }[]} items
 * @param {string} value
 * @param {(id: string) => void} onChange
 * @param {boolean} [animateContent=true] — إعادة تشغيل حركة fade عند تغيير التبويب
 * @param {string} [contentClassName] — على غلاف المحتوى (مثلاً nx-tab-content أو p-4)
 * @param {string} [shellClassName] — على noorix-surface-card الخارجي
 */
export default function ConnectedTabStrip({
  items,
  value,
  onChange,
  children,
  animateContent = true,
  contentClassName,
  shellClassName,
}) {
  return (
    <div
      className={cn(
        'noorix-surface-card border border-noorix-border rounded-xl overflow-hidden p-0 shadow-sm',
        shellClassName,
      )}
    >
      <div
        className={cn(
          'nx-connected-tab-strip flex flex-nowrap items-stretch overflow-x-auto text-[14px]',
          'bg-gradient-to-b from-noorix-bg-muted to-noorix-bg-muted/80',
          '[-webkit-overflow-scrolling:touch] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
          'border-b border-noorix-border',
        )}
        role="tablist"
      >
        {items.map((item) => {
          const active = value === item.id;
          return (
            <Button
              key={item.id}
              type="button"
              variant="raw"
              role="tab"
              aria-selected={active}
              className={cn(
                '!flex !flex-col !items-stretch !justify-between !h-auto !min-h-0 rounded-none shrink-0',
                'border-0 border-e border-noorix-border last:border-e-0',
                'text-[14px] leading-snug whitespace-nowrap',
                'transition-all duration-200 ease-out',
                active
                  ? 'relative z-[1] bg-noorix-surface text-noorix-text font-bold shadow-[0_6px_18px_-4px_rgba(10,31,68,0.14)]'
                  : 'z-0 bg-noorix-bg-muted/90 text-noorix-muted font-semibold shadow-none hover:z-[1] hover:bg-noorix-surface hover:text-noorix-text hover:shadow-[0_3px_10px_-2px_rgba(10,31,68,0.1)]',
              )}
              onClick={() => onChange(item.id)}
            >
              <span className="flex min-h-[36px] flex-1 items-center justify-center px-3 py-1.5 sm:min-h-[38px] sm:py-2">
                {item.label}
              </span>
              <span
                className={cn(
                  'block h-[3px] w-full shrink-0 transition-opacity duration-200',
                  active ? 'nx-connected-tab-sparkline' : 'bg-transparent',
                )}
                aria-hidden
              />
            </Button>
          );
        })}
      </div>
      <div className="border-t border-noorix-border/60 bg-noorix-surface/30">
        <div
          key={animateContent ? value : undefined}
          className={cn(animateContent && 'nx-connected-tab-content-swap', contentClassName)}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
