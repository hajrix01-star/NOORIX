import { BadRequestException } from '@nestjs/common';

export type OrdersV4EffectDocument = {
  id: string;
  reversalOfId: string | null;
};

/** Shared lock for every purchase state transition that can change its ledgers. */
export function ordersV4PurchaseWindowLockKey(companyId: string): string {
  return `orders-v4:receive:${companyId}`;
}

/** Per-document lock, always acquired after the shared purchase-window lock. */
export function ordersV4DocumentEffectLockKey(companyId: string, documentId: string): string {
  return `orders-v4:reverse:${companyId}:${documentId}`;
}

/** Resolves the latest document whose ledger entries currently carry the effect. */
export async function resolveOrdersV4EffectHead<T extends OrdersV4EffectDocument>(
  root: T,
  findNext: (documentId: string) => Promise<T | null>,
): Promise<T> {
  let head = root;
  const visited = new Set<string>([root.id]);
  while (true) {
    const next = await findNext(head.id);
    if (!next) return head;
    if (visited.has(next.id)) throw new BadRequestException('تم اكتشاف دورة غير صالحة في سلسلة أثر المستند');
    visited.add(next.id);
    head = next;
  }
}

/**
 * Business documents can contain inherited reversal entries after correction;
 * those are not their own economic effect. A reversal-chain head, however,
 * carries its effective value entirely through reversal entries.
 */
export function ordersV4OwnedEffectEntryFilter(head: OrdersV4EffectDocument) {
  return head.reversalOfId ? {} : { entryType: { not: 'reversal' as const } };
}
