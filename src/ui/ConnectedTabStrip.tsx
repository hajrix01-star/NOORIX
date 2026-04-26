import React, { type ReactNode } from 'react';
import { useUiDir } from '../hooks/useUiDir';
import Button from './Button';
import { cn } from './cn';

export type ConnectedTabItem = { id: string; label: ReactNode };

export type ConnectedTabStripProps = {
  items: ConnectedTabItem[];
  value: string;
  onChange: (id: string) => void;
  children?: ReactNode;
  animateContent?: boolean;
  contentClassName?: string;
  shellClassName?: string;
  tabBarEnd?: ReactNode;
};

/**
 * شريط تبويبات متصل — زوايا علوية ناعمة، فواصل عمودية، سباركلاين للنشط أسفل التسمية، انتقال للمحتوى.
 * يُستدعى عادةً عبر `ScreenTabs` (variant الافتراضي `connected`) — لا تستورد هذا المكوّن مباشرة في شاشات أقسام جديدة.
 */
export default function ConnectedTabStrip({
  items,
  value,
  onChange,
  children,
  animateContent = true,
  contentClassName,
  shellClassName,
  tabBarEnd,
}: ConnectedTabStripProps) {
  const uiDir = useUiDir();
  const hasEnd = tabBarEnd != null && tabBarEnd !== false;
  return (
    <div
      className={cn(
        'noorix-surface-card overflow-hidden p-0',
        shellClassName,
      )}
    >
      <div
        className={cn(
          'flex w-full flex-col border-b border-noorix-border sm:flex-row sm:items-stretch sm:justify-between sm:gap-0',
          hasEnd && 'bg-gradient-to-b from-noorix-bg-muted to-noorix-bg-muted/80',
        )}
      >
        <div
          className={cn(
            'nx-connected-tab-strip isolate flex min-w-0 flex-nowrap items-stretch overflow-x-auto text-[14px]',
            /* مع tabBarEnd: لا نستخدم flex-1 حتى لا يبقى فراغ كبير بين التبويبات وشريط الأدوات */
            hasEnd ? 'min-w-0 max-w-full shrink bg-transparent' : 'min-w-0 flex-1 bg-gradient-to-b from-noorix-bg-muted to-noorix-bg-muted/80',
            '[-webkit-overflow-scrolling:touch] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
          )}
          role="tablist"
          dir={uiDir}
        >
          {items.map((item: any) => {
            const active = value === item.id;
            return (
              <Button
                key={item.id}
                type="button"
                variant="raw"
                size="auto"
                role="tab"
                aria-selected={active}
                data-active={active ? 'true' : 'false'}
                className={cn(
                  /* grid: مركز النص في الصف العلوي؛ السباركلاين صف ثابت — size=auto يزيل h-9 من الزر */
                  '!grid !h-full min-h-[39px] grid-cols-1 grid-rows-[minmax(36px,1fr)_3px] sm:grid-rows-[minmax(38px,1fr)_3px] self-stretch shrink-0 rounded-none',
                  'border-0 border-e border-noorix-border-strong last:border-e-0',
                  'text-[14px] leading-normal whitespace-nowrap',
                  /* انتقال محدود — لا يشمل font-weight لتفادي اهتزاز الرسم */
                  'transition-[background-color,color,box-shadow] duration-200 ease-out',
                  active
                    ? 'relative z-[1] bg-noorix-surface text-noorix-text shadow-[0_6px_18px_-4px_rgba(10,31,68,0.14)]'
                    : 'z-0 bg-noorix-bg-muted/90 text-noorix-muted shadow-none hover:bg-noorix-surface hover:text-noorix-text hover:shadow-[0_3px_10px_-2px_rgba(10,31,68,0.1)]',
                )}
                onClick={() => {
                  if (item.id !== value) onChange(item.id);
                }}
              >
                <span className="grid h-full min-h-0 w-full place-items-center px-3 py-0">
                  <span
                    aria-hidden
                    className="invisible col-start-1 row-start-1 font-bold leading-normal whitespace-nowrap"
                  >
                    {item.label}
                  </span>
                  <span
                    className={cn(
                      'col-start-1 row-start-1 flex min-h-0 w-full min-w-0 items-center justify-center text-center leading-normal whitespace-nowrap',
                      'transition-[color] duration-200 ease-out',
                      active ? 'font-bold' : 'font-semibold',
                    )}
                  >
                    {item.label}
                  </span>
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
        {hasEnd && (
          <div
            className={cn(
              'flex min-w-0 shrink-0 flex-nowrap items-center justify-end gap-2 overflow-x-auto border-noorix-border bg-noorix-surface px-3 py-2 shadow-[inset_0_1px_0_0_var(--noorix-border)] sm:min-h-[39px] sm:border-s sm:border-t-0 sm:py-0 sm:shadow-none',
              'border-t [-webkit-overflow-scrolling:touch]',
            )}
          >
            {tabBarEnd}
          </div>
        )}
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
