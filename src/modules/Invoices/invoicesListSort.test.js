import { describe, it, expect } from 'vitest';
import { nextInvoiceSortState } from './invoicesListSort';

describe('nextInvoiceSortState', () => {
  it('flips direction when same column', () => {
    expect(nextInvoiceSortState('transactionDate', 'desc', 'transactionDate')).toEqual({
      sortKey: 'transactionDate',
      sortDir: 'asc',
    });
    expect(nextInvoiceSortState('transactionDate', 'asc', 'transactionDate')).toEqual({
      sortKey: 'transactionDate',
      sortDir: 'desc',
    });
  });

  it('switches column and resets to desc', () => {
    expect(nextInvoiceSortState('transactionDate', 'asc', 'totalAmount')).toEqual({
      sortKey: 'totalAmount',
      sortDir: 'desc',
    });
  });
});
