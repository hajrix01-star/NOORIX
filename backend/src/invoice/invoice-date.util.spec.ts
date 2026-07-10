import { BadRequestException } from '@nestjs/common';
import { parseInvoiceDate, parseInvoiceDayBoundary } from './invoice-date.util';

describe('invoice-date.util', () => {
  it('parses invoice transaction dates consistently', () => {
    expect(parseInvoiceDate('2026-07-06').toISOString()).toBe('2026-07-06T00:00:00.000Z');
    expect(parseInvoiceDayBoundary('2026-07-06', 'start').toISOString()).toBe('2026-07-06T00:00:00.000Z');
    expect(parseInvoiceDayBoundary('2026-07-06', 'end').toISOString()).toBe('2026-07-06T23:59:59.999Z');
  });

  it('rejects invalid invoice dates', () => {
    expect(() => parseInvoiceDate('invalid-date')).toThrow(BadRequestException);
    expect(() => parseInvoiceDayBoundary('invalid-date', 'start')).toThrow(BadRequestException);
  });
});
