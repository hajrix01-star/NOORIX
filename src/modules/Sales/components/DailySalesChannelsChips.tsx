import React from 'react';
import { fmt } from '../../../utils/format';
import { vaultDisplayName } from '../../../utils/vaultDisplay';
import { cn } from '../../../ui';

/** مرجع خزينة مضمّن في قناة المبيعات */
export type DailySalesVaultRef = {
  id?: string;
  nameAr?: string | null;
  nameEn?: string | null;
  sortOrder?: number | null;
  type?: string | null;
};

/** قناة بيع في ملخص يومي (عرض/جدول) */
export type DailySalesChannelEntry = {
  vaultId?: string;
  amount?: number | string | null;
  vault?: DailySalesVaultRef | null;
};

export type DailySalesChannelsChipsProps = {
  channels?: DailySalesChannelEntry[] | null;
  lang: string;
};

/** عرض قنوات البيع في الجدول والجوال — شرائح واضحة بدل نص مفصول بـ | */
export function DailySalesChannelsChips({ channels, lang }: DailySalesChannelsChipsProps) {
  const list = Array.isArray(channels)
    ? [...channels].sort(
        (a, b) =>
          (a.vault?.sortOrder ?? 0) - (b.vault?.sortOrder ?? 0) ||
          String(a.vault?.nameAr || '').localeCompare(String(b.vault?.nameAr || ''), 'ar'),
      )
    : [];
  if (list.length === 0) {
    return <span className="text-[12px] text-noorix-muted">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5 justify-end">
      {list.map((ch, i) => {
        const vid = ch.vaultId ?? ch.vault?.id ?? i;
        const label = vaultDisplayName(ch.vault, lang);
        return (
          <div
            key={vid}
            className={cn(
              'inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-lg border border-noorix-border',
              'bg-noorix-bg-muted/90 px-2 py-1 shadow-sm',
            )}
            title={label}
          >
            <span className="min-w-0 truncate text-[11px] font-semibold text-noorix-text">{label}</span>
            <span dir="ltr" className="shrink-0 whitespace-nowrap text-[12px] font-bold tabular-nums text-nx-sales">
              {fmt(ch.amount)} <span className="nx-sar">SR</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
