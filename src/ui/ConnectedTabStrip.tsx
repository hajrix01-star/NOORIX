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
  stripClassName?: string;
  /** على الجوال: توزيع متساوٍ بدون تمرير أفقي (لأشرطة بعدد تبويبات قليل) */
  compactMobile?: boolean;
  /** توزيع متساوٍ على كل العروض (تبويبات فرعية HR 2–4 حبات) */
  compactAll?: boolean;
  /** داخل كرت أب — بدون noorix-surface-card وبدون غلاف محتوى إضافي */
  embedded?: boolean;
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
  stripClassName,
  compactMobile = false,
  compactAll = false,
  embedded = false,
  tabBarEnd,
}: ConnectedTabStripProps) {
  const uiDir = useUiDir();
  const hasEnd = tabBarEnd != null && tabBarEnd !== false;
  const denseMobile = compactMobile && items.length > 4;
  const equalTabs = compactAll || compactMobile;
  const hasContent = children != null;

  return (
    <div
      className={cn(
        embedded
          ? 'flex w-full min-w-0 flex-col'
          : 'noorix-surface-card overflow-hidden p-0',
        shellClassName,
      )}
    >
      <div
        className={cn(
          'flex w-full flex-col sm:flex-row sm:items-stretch sm:justify-between sm:gap-0',
          !embedded && 'border-b border-noorix-border',
          hasEnd && 'bg-gradient-to-b from-noorix-bg-muted to-noorix-bg-muted/80',
        )}
      >
        <div
          className={cn(
            'nx-connected-tab-strip isolate flex min-w-0 flex-nowrap items-stretch text-[14px]',
            equalTabs
              ? cn(
                  'w-full overflow-x-hidden',
                  compactAll ? 'text-[12px] sm:text-[13px]' : 'max-sm:overflow-x-hidden max-sm:text-[11px]',
                )
              : cn(
                  'nx-connected-tab-strip--scroll overflow-x-auto [-webkit-overflow-scrolling:touch]',
                  '[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
                ),
            hasEnd ? 'min-w-0 max-w-full shrink bg-transparent' : 'min-w-0 flex-1 bg-gradient-to-b from-noorix-bg-muted to-noorix-bg-muted/80',
            stripClassName,
          )}
          role="tablist"
          dir={uiDir}
        >
          {items.map((item) => {
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
                  '!grid !h-full min-h-[39px] grid-cols-1 grid-rows-[minmax(36px,1fr)_3px] sm:grid-rows-[minmax(38px,1fr)_3px] self-stretch rounded-none',
                  compactAll && 'min-h-[34px] sm:min-h-[36px] sm:grid-rows-[minmax(32px,1fr)_3px]',
                  equalTabs && 'min-w-0 flex-1 basis-0 shrink',
                  compactMobile && !compactAll && 'max-sm:min-h-[34px] max-sm:min-w-0 max-sm:flex-1 max-sm:basis-0 max-sm:shrink',
                  compactMobile && !compactAll && denseMobile && 'max-sm:min-h-[40px]',
                  !equalTabs && 'shrink-0',
                  'border-0 border-e border-noorix-border-strong last:border-e-0',
                  equalTabs
                    ? cn(
                        'leading-snug sm:leading-normal',
                        compactAll
                          ? 'text-[12px] sm:text-[13px] max-sm:truncate max-sm:whitespace-nowrap max-sm:px-0.5'
                          : cn(
                              'text-[14px] max-sm:leading-tight',
                              denseMobile
                                ? 'max-sm:text-[11px] max-sm:whitespace-normal'
                                : 'max-sm:text-[11px] max-sm:whitespace-nowrap',
                            ),
                      )
                    : 'text-[14px] leading-normal whitespace-nowrap',
                  'transition-[background-color,color,box-shadow] duration-200 ease-out',
                  active
                    ? 'relative z-[1] bg-noorix-surface text-noorix-text shadow-[0_6px_18px_-4px_rgba(10,31,68,0.14)]'
                    : 'z-0 bg-noorix-bg-muted/90 text-noorix-muted shadow-none hover:bg-noorix-surface hover:text-noorix-text hover:shadow-[0_3px_10px_-2px_rgba(10,31,68,0.1)]',
                )}
                onClick={() => {
                  if (item.id !== value) onChange(item.id);
                }}
              >
                <span
                  className={cn(
                    'grid h-full min-h-0 w-full min-w-0 place-items-center py-0',
                    equalTabs ? 'px-1 sm:px-2' : compactMobile ? 'px-1 max-sm:px-1 sm:px-3' : 'px-3',
                  )}
                >
                  {!equalTabs && !compactMobile && (
                    <span
                      aria-hidden
                      className="invisible col-start-1 row-start-1 font-bold leading-normal whitespace-nowrap"
                    >
                      {item.label}
                    </span>
                  )}
                  <span
                    className={cn(
                      'col-start-1 row-start-1 flex min-h-0 w-full min-w-0 items-center justify-center text-center',
                      equalTabs
                        ? 'truncate whitespace-nowrap px-0.5 leading-snug sm:leading-normal'
                        : compactMobile
                          ? cn(
                              denseMobile
                                ? 'max-sm:line-clamp-2 max-sm:whitespace-normal max-sm:leading-tight max-sm:px-0.5'
                                : 'max-sm:truncate max-sm:whitespace-nowrap max-sm:px-0.5',
                              'leading-snug sm:leading-normal sm:whitespace-nowrap',
                            )
                          : 'leading-normal whitespace-nowrap',
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
      {hasContent && (
        <div
          className={cn(
            !embedded && 'border-t border-noorix-border/60 bg-noorix-surface/30',
          )}
        >
          <div
            key={animateContent ? value : undefined}
            className={cn(animateContent && 'nx-connected-tab-content-swap', contentClassName)}
          >
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
