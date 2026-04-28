import { useMemo } from 'react';

export type WarrantyBadgeKey = 'none' | 'active' | 'expiring' | 'expired';

export function useWarrantyBadgeMap(t: (k: string) => string) {
  return useMemo(
    () =>
      ({
        none: { color: 'gray' as const, label: t('assetWarrantyNone') },
        active: { color: 'green' as const, label: t('assetWarrantyActive') },
        expiring: { color: 'amber' as const, label: t('assetWarrantyExpiring') },
        expired: { color: 'red' as const, label: t('assetWarrantyExpired') },
      }) satisfies Record<
        WarrantyBadgeKey,
        { color: 'gray' | 'green' | 'amber' | 'red'; label: string }
      >,
    [t],
  );
}
