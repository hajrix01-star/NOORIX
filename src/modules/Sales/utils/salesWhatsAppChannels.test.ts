import { describe, expect, it } from 'vitest';
import {
  aggregateDayChannelWhatsAppSummary,
  buildVaultLookup,
  channelsFromEntryPayload,
} from './salesWhatsAppChannels';

describe('salesWhatsAppChannels', () => {
  const vaultById = buildVaultLookup([
    { id: 'v1', nameAr: 'Cash', sortOrder: 1, type: 'cash' },
    { id: 'v2', nameAr: 'Bank', sortOrder: 2, type: 'bank' },
  ]);

  it('aggregates active day channels into one compact collection line', () => {
    const line = aggregateDayChannelWhatsAppSummary(
      [
        {
          status: 'active',
          transactionDate: '2026-05-10',
          channels: [
            { vaultId: 'v1', amount: 100 },
            { vaultId: 'v2', amount: 50 },
          ],
        },
        {
          status: 'active',
          transactionDate: '2026-05-10',
          channels: [{ vaultId: 'v1', amount: 200 }],
        },
        {
          status: 'cancelled',
          transactionDate: '2026-05-10',
          channels: [{ vaultId: 'v1', amount: 999 }],
        },
      ],
      '2026-05-10',
      'ar',
      vaultById,
    );

    expect(line).toBe('Cash: 300 | Bank: 50');
  });

  it('builds entry payload channels with vault references', () => {
    const channels = channelsFromEntryPayload(
      { channels: [{ vaultId: 'v1', amount: '125' }] },
      [{ id: 'v1', nameAr: 'Cash', sortOrder: 1 }],
    );

    expect(channels).toEqual([
      {
        vaultId: 'v1',
        amount: '125',
        vault: { id: 'v1', nameAr: 'Cash', nameEn: undefined, sortOrder: 1, type: null },
      },
    ]);
  });
});
