import type { ReactNode } from 'react';
import { FmtNum } from './FmtNum';
import { cn } from './cn';

export type SummaryBarTone = 'default' | 'green' | 'blue' | 'amber' | 'purple' | 'red';

export type SummaryBarItem = {
  key: string;
  label: ReactNode;
  value: ReactNode | number | string;
  tone?: SummaryBarTone;
  currency?: ReactNode;
  helper?: ReactNode;
  prefix?: ReactNode;
};

export type SummaryBarProps = {
  items: SummaryBarItem[];
  caption?: ReactNode;
  className?: string;
};

function toneClass(tone: SummaryBarTone | undefined): string | undefined {
  if (!tone || tone === 'default') return undefined;
  if (tone === 'red') return 'text-noorix-red';
  return `noorix-summary-bar__value--${tone}`;
}

function SummaryValue({ item }: { item: SummaryBarItem }) {
  const numericValue = typeof item.value === 'number'
    ? item.prefix != null ? Math.abs(item.value) : item.value
    : null;

  return (
    <div className={cn('noorix-summary-bar__value', toneClass(item.tone))}>
      {item.prefix}
      {numericValue != null ? <FmtNum n={numericValue} /> : item.value}
      {item.currency ? <span className="nx-sar">{item.currency}</span> : null}
    </div>
  );
}

export default function SummaryBar({ items, caption, className }: SummaryBarProps) {
  const count = Math.min(Math.max(items.length, 1), 5);

  return (
    <>
      {caption ? (
        <div className="mb-1.5 px-1 text-[11px] text-noorix-muted">
          {caption}
        </div>
      ) : null}
      <div className={cn('noorix-summary-bar', `noorix-summary-bar--${count}`, className)}>
        {items.map((item) => (
          <div key={item.key} className="noorix-summary-bar__item">
            <div className="noorix-summary-bar__label">{item.label}</div>
            <SummaryValue item={item} />
            {item.helper ? (
              <div className="mt-0.5 text-[11px] font-medium text-noorix-muted">
                {item.helper}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </>
  );
}
