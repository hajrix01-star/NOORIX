import type { ReactNode } from 'react';
import { cn } from './cn';

export type ChartStateKind = 'loading' | 'empty' | 'error' | 'noData';

export type ChartStateProps = {
  kind: ChartStateKind;
  children?: ReactNode;
  icon?: ReactNode;
  className?: string;
  label?: ReactNode;
};

function defaultLabel(kind: ChartStateKind): string {
  if (kind === 'loading') return 'Loading...';
  if (kind === 'error') return 'Unable to load chart';
  return 'No data';
}

export default function ChartState({ kind, children, icon, className, label }: ChartStateProps) {
  const isError = kind === 'error';
  const isLoading = kind === 'loading';
  const content = children ?? label ?? defaultLabel(kind);

  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-busy={isLoading || undefined}
      className={cn(
        'flex min-h-[160px] w-full flex-col items-center justify-center rounded-xl border border-dashed border-noorix-border bg-noorix-bg-muted/30 px-4 py-8 text-center',
        isError ? 'text-noorix-red' : 'text-noorix-muted',
        className,
      )}
    >
      {icon ? <div className="mb-2 text-noorix-muted">{icon}</div> : null}
      <div className="text-[13px] font-medium leading-relaxed">{content}</div>
    </div>
  );
}
