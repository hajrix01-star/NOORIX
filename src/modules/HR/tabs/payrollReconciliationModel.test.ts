import { describe, expect, it } from 'vitest';
import { normalizePayrollReconciliationResponse } from './payrollReconciliationModel';

describe('normalizePayrollReconciliationResponse', () => {
  it('normalizes the backend reconciliation contract and keeps diagnostic totals separate', () => {
    const result = normalizePayrollReconciliationResponse({
      companyId: 'company-1',
      year: 2026,
      months: [{
        month: '2026-07',
        payrollRunsTotal: '48051',
        salaryInvoicesTotal: 17851,
        structuredAdvanceSettlementsTotal: 30200,
        documentedHistoricalRepairTotal: 5000,
        legacyAdvanceSettlementLedgerTotal: 13100,
        ledgerPayrollCostTotal: 61151,
        difference: 13100,
        confidence: 'medium',
        reviewStatus: 'needs_review',
        rows: [{
          id: 'row-1',
          date: '2026-07-06',
          employeeName: 'موظف تجريبي',
          runNumber: 'PR-001',
          advanceInvoiceNumber: 'ADV-001',
          amount: '13100',
          source: 'documented_historical_repair',
          confidence: 'medium',
          reason: 'رابط تاريخي غير مباشر',
        }],
      }],
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      month: '2026-07',
      payrollRunsTotal: 48051,
      salaryInvoicesTotal: 17851,
      structuredAdvanceSettlementsTotal: 30200,
      documentedHistoricalRepairTotal: 5000,
      legacyAdvanceSettlementLedgerTotal: 13100,
      advanceSettlementsTotal: 48300,
      ledgerPayrollCostTotal: 61151,
      difference: 13100,
      confidence: 'medium',
      reviewStatus: 'needs_review',
    });
    expect(result[0].rows[0]).toMatchObject({
      id: 'row-1',
      employeeName: 'موظف تجريبي',
      amount: 13100,
      source: 'documented_historical_repair',
      confidence: 'medium',
    });
  });

  it('accepts the fallback name for documented historical repairs', () => {
    const [month] = normalizePayrollReconciliationResponse({
      months: [{
        month: '2026-05',
        payrollRunsTotal: 12000,
        ledgerPayrollCostTotal: 12000,
        historicalRepairTotal: '2500',
      }],
    });

    expect(month.documentedHistoricalRepairTotal).toBe(2500);
    expect(month.advanceSettlementsTotal).toBe(2500);
  });

  it('derives the difference from ledger cost minus payroll runs when the API omits it', () => {
    const [month] = normalizePayrollReconciliationResponse({
      rows: [{
        month: '2026-08',
        payrollRunsTotal: 50000,
        salaryInvoicesTotal: 44000,
        structuredAdvanceSettlementsTotal: 6000,
        legacyAdvanceSettlementLedgerTotal: 9000,
        ledgerPayrollCostTotal: 50000,
      }],
    });

    expect(month.difference).toBe(0);
    expect(month.reviewStatus).toBe('matched');
  });

  it('accepts a nested data envelope, ignores invalid months, and sorts newest first', () => {
    const result = normalizePayrollReconciliationResponse({
      data: {
        months: [
          { month: '2026-06', payrollRunsTotal: 10, ledgerPayrollCostTotal: 10 },
          { unexpected: true },
          { month: '2026-08', payrollRunsTotal: 20, ledgerPayrollCostTotal: 20 },
        ],
      },
    });

    expect(result.map((item) => item.month)).toEqual(['2026-08', '2026-06']);
  });
});
