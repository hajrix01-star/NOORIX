import { Prisma } from '@prisma/client';
import { scaleVaultAllocationsToTotal } from './financial-outflow-ledger.util';

describe('scaleVaultAllocationsToTotal', () => {
  it('يحافظ على مجموع يساوي newTotal لثلاث خزائن', () => {
    const rows = [
      { vaultId: 'a', amount: new Prisma.Decimal('30') },
      { vaultId: 'b', amount: new Prisma.Decimal('50') },
      { vaultId: 'c', amount: new Prisma.Decimal('20') },
    ];
    const newTotal = new Prisma.Decimal('100');
    const out = scaleVaultAllocationsToTotal(rows, newTotal);
    const sum = out.reduce((s, r) => s.plus(r.amount), new Prisma.Decimal(0));
    expect(sum.equals(newTotal)).toBe(true);
    expect(out).toHaveLength(3);
  });
});
