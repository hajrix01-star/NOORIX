import type React from 'react';

import { cn } from '../../../../ui';

type ProfileInfoRowProps = {
  label: React.ReactNode;
  value?: React.ReactNode;
  accent?: boolean;
};

export function ProfileInfoRow({ label, value, accent = false }: ProfileInfoRowProps) {
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
