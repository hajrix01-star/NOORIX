import { describe, it, expect } from 'vitest';
import { formatSalesApiAmount, buildCreateSalesSummaryApiBody } from './salesApiPayload';

describe('salesApiPayload', () => {
  it('formatSalesApiAmount matches server regex', () => {
    expect(formatSalesApiAmount('100')).toBe('100');
    expect(formatSalesApiAmount('100.5')).toBe('100.5');
    expect(formatSalesApiAmount('100.567')).toBe('100.57');
    expect(formatSalesApiAmount('1,234.5')).toBe('1234.5');
  });

  it('omits idempotencyKey when requested', () => {
    const body = buildCreateSalesSummaryApiBody({
      companyId: 'c1',
      transactionDate: '2026-05-10',
      customerCount: 5,
      shift: 'morning',
      channels: [{ vaultId: 'v1', amount: '100' }],
      idempotencyKey: 'k1',
      omitIdempotencyKey: true,
    });
    expect(body).not.toHaveProperty('idempotencyKey');
    expect(body.shift).toBe('morning');
  });
});
