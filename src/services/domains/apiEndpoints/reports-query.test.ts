import { describe, expect, it } from 'vitest';
import {
  generalProfitLossDetailsQuery,
  periodAnalyticsQuery,
  taxVatReportQuery,
  vatPlanningDeleteQuery,
  vatPlanningRegistryQuery,
  withReportsApiQuery,
} from './reports-query';

describe('reports-query', () => {
  it('omits blank optional values and preserves official report selectors', () => {
    expect(generalProfitLossDetailsQuery(' c1 ', 2026, '', 'sales', '')).toEqual({
      companyId: 'c1',
      year: '2026',
      groupKey: 'sales',
    });
  });

  it('builds VAT query flags only when explicitly enabled', () => {
    expect(taxVatReportQuery('c1', 2026, 'Q1', { salesAmountIncludesVat: true })).toEqual({
      companyId: 'c1',
      year: '2026',
      period: 'Q1',
      salesAmountIncludesVat: 'true',
    });

    expect(taxVatReportQuery('c1', 2026, 'Q1')).toEqual({
      companyId: 'c1',
      year: '2026',
      period: 'Q1',
    });
  });

  it('centralizes VAT planning registry and delete query strings', () => {
    expect(vatPlanningRegistryQuery({ year: 2026, quarter: '', companyId: ' c1 ' })).toEqual({
      year: '2026',
      companyId: 'c1',
    });

    expect(withReportsApiQuery('/api/v1/vat-planning', vatPlanningDeleteQuery('c 1', 2026, 2))).toBe(
      '/api/v1/vat-planning?companyId=c+1&year=2026&quarter=2',
    );
  });

  it('normalizes period analytics dates through the shared date helper', () => {
    expect(periodAnalyticsQuery('c1', '2026-01-01T12:00:00Z', '2026-01-31T12:00:00Z')).toEqual({
      companyId: 'c1',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    });
  });
});
