import { BadRequestException } from '@nestjs/common';
import {
  OrdersV4EffectDocument,
  ordersV4DocumentEffectLockKey,
  ordersV4OwnedEffectEntryFilter,
  ordersV4PurchaseWindowLockKey,
  resolveOrdersV4EffectHead,
} from './orders-v4-document-effect.policy';

describe('Orders V4 document effect ownership policy', () => {
  it('centralizes the ordered purchase and document effect lock keys', () => {
    expect(ordersV4PurchaseWindowLockKey('company-1')).toBe('orders-v4:receive:company-1');
    expect(ordersV4DocumentEffectLockKey('company-1', 'purchase-1'))
      .toBe('orders-v4:reverse:company-1:purchase-1');
  });

  it('uses only a corrected business document own non-reversal entries', async () => {
    const corrected = { id: 'B', reversalOfId: null };
    const head = await resolveOrdersV4EffectHead(corrected, async () => null);

    expect(head).toBe(corrected);
    expect(ordersV4OwnedEffectEntryFilter(head)).toEqual({ entryType: { not: 'reversal' } });
  });

  it('resolves cancel then undo to the latest effect head and owns its reversal entries', async () => {
    const documents = new Map<string, OrdersV4EffectDocument>([
      ['A', { id: 'R', reversalOfId: 'A' }],
      ['R', { id: 'U', reversalOfId: 'R' }],
    ]);
    const head = await resolveOrdersV4EffectHead(
      { id: 'A', reversalOfId: null },
      async (documentId) => documents.get(documentId) ?? null,
    );

    expect(head).toEqual({ id: 'U', reversalOfId: 'R' });
    expect(ordersV4OwnedEffectEntryFilter(head)).toEqual({});
  });

  it('rejects a corrupted cyclic effect chain', async () => {
    const documents = new Map<string, OrdersV4EffectDocument>([
      ['A', { id: 'R', reversalOfId: 'A' }],
      ['R', { id: 'A', reversalOfId: null }],
    ]);

    await expect(resolveOrdersV4EffectHead(
      { id: 'A', reversalOfId: null },
      async (documentId) => documents.get(documentId) ?? null,
    )).rejects.toBeInstanceOf(BadRequestException);
  });
});
