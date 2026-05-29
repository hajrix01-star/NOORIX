import { describe, it, expect } from 'vitest';
import {
  aggregateShiftChannelWhatsAppLines,
  buildSummaryChannelWhatsAppLines,
  buildVaultLookup,
} from './salesWhatsAppChannels';

describe('salesWhatsAppChannels', () => {
  const vaultById = buildVaultLookup([
    { id: 'v1', nameAr: 'نقدي', sortOrder: 1, type: 'cash' },
    { id: 'v2', nameAr: 'بنك', sortOrder: 2, type: 'bank' },
  ]);

  it('builds lines from channels with vaultId only', () => {
    const lines = buildSummaryChannelWhatsAppLines(
      [{ vaultId: 'v1', amount: 100 }],
      'ar',
      vaultById,
    );
    expect(lines).toEqual(['  • نقدي: 100 SR']);
  });

  it('aggregates channels per shift for a day', () => {
    const lines = aggregateShiftChannelWhatsAppLines(
      [
        {
          status: 'active',
          transactionDate: '2026-05-10',
          shift: 'morning',
          channels: [
            { vaultId: 'v1', amount: 100, vault: { nameAr: 'نقدي', sortOrder: 1, type: 'cash' } },
            { vaultId: 'v2', amount: 50, vault: { nameAr: 'بنك', sortOrder: 2, type: 'bank' } },
          ],
        },
        {
          status: 'active',
          transactionDate: '2026-05-10',
          shift: 'morning',
          channels: [{ vaultId: 'v1', amount: 200, vault: { nameAr: 'نقدي', sortOrder: 1 } }],
        },
      ],
      '2026-05-10',
      'morning',
      'ar',
    );
    expect(lines).toContain('  • نقدي: 300 SR');
    expect(lines).toContain('  • بنك: 50 SR');
  });
});
