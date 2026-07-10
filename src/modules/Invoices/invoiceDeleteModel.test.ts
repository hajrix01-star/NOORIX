import { describe, expect, it } from 'vitest';
import { buildInvoiceDeleteConfirmationMessage, canDeleteInvoiceRow } from './invoiceDeleteModel';

describe('invoiceDeleteModel', () => {
  it('centralizes invoice delete confirmation inputs', () => {
    const t = (key: string, ...args: unknown[]) => `${key}:${args.join('|')}`;
    expect(buildInvoiceDeleteConfirmationMessage(t, { invoiceNumber: 'INV-1' })).toBe(
      'deleteInvoiceConfirm:INV-1',
    );
    expect(canDeleteInvoiceRow({ id: 'invoice-1' })).toBe(true);
    expect(canDeleteInvoiceRow({ id: '' })).toBe(false);
  });
});
