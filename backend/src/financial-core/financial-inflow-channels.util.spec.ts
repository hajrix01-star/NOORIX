import { Prisma } from '@prisma/client';
import { buildChannelNetTaxForInflow, sumInflowChannelAmounts } from './financial-inflow-channels.util';

describe('financial-inflow-channels.util', () => {
  it('buildChannelNetTaxForInflow بدون ضريبة يعيد net = المبلغ', () => {
    const ch = [{ vaultId: 'v1', amount: '100' }];
    const { channelNetTax, totalNet, totalTax } = buildChannelNetTaxForInflow(ch, false, 0.15);
    expect(channelNetTax).toHaveLength(1);
    expect(totalTax.toString()).toBe('0');
    expect(totalNet.equals(new Prisma.Decimal('100'))).toBe(true);
  });

  it('sumInflowChannelAmounts يجمع القنوات', () => {
    const s = sumInflowChannelAmounts([
      { vaultId: 'a', amount: '10' },
      { vaultId: 'b', amount: '20.5' },
    ]);
    expect(s.equals(new Prisma.Decimal('30.5'))).toBe(true);
  });
});
