import { describe, expect, it } from 'vitest';
import {
  asInvoiceExecutiveCount,
  asInvoiceExecutiveNumber,
  getInvoiceExecutiveRemainderToneClass,
  mapInvoiceExecutiveVaultRows,
} from './invoiceExecutiveCardsModel';

describe('invoiceExecutiveCardsModel', () => {
  it('normalizes numbers and counts', () => {
    expect(asInvoiceExecutiveNumber('12.5')).toBe(12.5);
    expect(asInvoiceExecutiveNumber(undefined)).toBe(0);
    expect(asInvoiceExecutiveCount(null)).toBe(0);
    expect(asInvoiceExecutiveCount('3')).toBe('3');
  });

  it('maps vault rows and remainder tones', () => {
    expect(getInvoiceExecutiveRemainderToneClass(5)).toBe('text-nx-profit');
    expect(getInvoiceExecutiveRemainderToneClass(-5)).toBe('text-nx-expenses');
    expect(getInvoiceExecutiveRemainderToneClass(0)).toBe('text-noorix-muted');

    expect(
      mapInvoiceExecutiveVaultRows({
        rows: [{ vaultId: 'v1', total: '100', outflow: 30, remainder: '70' }],
        labelForRow: () => 'Cash',
      }),
    ).toEqual([
      {
        key: 'v1',
        label: 'Cash',
        inflow: 100,
        outflow: 30,
        remainder: 70,
        remainderToneClass: 'text-nx-profit',
      },
    ]);
  });
});
