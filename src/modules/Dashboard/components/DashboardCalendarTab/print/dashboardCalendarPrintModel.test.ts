import { describe, expect, it } from 'vitest';
import type { DashboardSalesSummary } from '../../../../../types/api/domains/dashboard';
import { buildDashboardCalendarDayDetailsPrintBody } from './dashboardCalendarPrintModel';

describe('dashboard calendar day print accounting source', () => {
  it('prints the ledger day total and never prints operational summary amounts', () => {
    const summary = {
      summaryNumber: 'SUM-1',
      customerCount: 2,
      totalAmount: 999,
      channels: [],
    } as unknown as DashboardSalesSummary;

    const html = buildDashboardCalendarDayDetailsPrintBody({
      dayTarget: 100,
      daySummaries: [summary],
      totalAmount: 123,
      achieved: true,
      t: (key) => key,
      lang: 'ar',
    });

    expect(html).toContain('123');
    expect(html).not.toContain('999');
    expect(html).toContain('SUM-1');
  });
});