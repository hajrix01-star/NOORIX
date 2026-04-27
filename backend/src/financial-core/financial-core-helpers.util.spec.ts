import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { validateJournalBalance } from './financial-core-helpers.util';

describe('validateJournalBalance', () => {
  it('accepts balanced single debit and single credit', () => {
    expect(() =>
      validateJournalBalance([{ amount: new Prisma.Decimal('100.00') }], [{ amount: '100' }]),
    ).not.toThrow();
  });

  it('accepts balanced multiple lines', () => {
    expect(() =>
      validateJournalBalance(
        [{ amount: 60 }, { amount: 40 }],
        [{ amount: new Prisma.Decimal('50') }, { amount: new Prisma.Decimal('50') }],
      ),
    ).not.toThrow();
  });

  it('throws when debit total differs from credit total', () => {
    expect(() =>
      validateJournalBalance([{ amount: '100' }], [{ amount: '99.99' }]),
    ).toThrow(BadRequestException);
  });

  it('throws on non-finite amounts', () => {
    expect(() => validateJournalBalance([{ amount: Number.NaN }], [{ amount: 0 }])).toThrow(BadRequestException);
  });

  it('accepts decimal sums without float drift (0.1 + 0.2 = 0.3)', () => {
    expect(() =>
      validateJournalBalance([{ amount: '0.1' }, { amount: '0.2' }], [{ amount: new Prisma.Decimal('0.3') }]),
    ).not.toThrow();
  });

  it('matches transfer pattern: one debit line and one credit line same amount', () => {
    expect(() => validateJournalBalance([{ amount: 500 }], [{ amount: 500 }])).not.toThrow();
  });
});
