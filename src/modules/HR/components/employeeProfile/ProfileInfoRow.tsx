import { cn } from '../../../../ui';

export function ProfileInfoRow({ label, value, accent = false }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-noorix-border last:border-0">
      <span className="text-[12px] text-noorix-muted shrink-0">{label}</span>
      <span
        className={cn('text-[13px] font-medium text-end', accent ? 'text-noorix-red' : 'text-noorix-text')}
      >
        {value || '—'}
      </span>
    </div>
  );
}
