import { mapImportedLedgerRef } from './backup-logical-import-ledger-ref.util';

describe('mapImportedLedgerRef', () => {
  const maps = {
    invoiceMap: new Map([
      ['old-invoice', 'new-invoice'],
      ['old-salary', 'new-salary'],
      ['old-advance', 'new-advance'],
    ]),
    dailySalesSummaryMap: new Map([['old-sale', 'new-sale']]),
  };

  it.each([
    ['invoice', 'old-invoice', 'new-invoice'],
    ['salary', 'old-salary', 'new-salary'],
    ['advance', 'old-advance', 'new-advance'],
    ['sale', 'old-sale', 'new-sale'],
  ])('maps %s references through the imported row maps', (type, oldRef, expected) => {
    expect(mapImportedLedgerRef(type, oldRef, maps)).toBe(expected);
  });

  it('keeps unknown and unmapped references unchanged', () => {
    expect(mapImportedLedgerRef('manual', 'manual-ref', maps)).toBe('manual-ref');
    expect(mapImportedLedgerRef('invoice', 'missing-invoice', maps)).toBe('missing-invoice');
  });
});
