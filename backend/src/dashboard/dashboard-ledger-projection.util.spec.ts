import { buildDashboardLedgerProjection, fallbackReportingClassForLedgerRow, type DashboardLedgerProjectionRow } from './dashboard-ledger-projection.util';

const row = (overrides: Partial<DashboardLedgerProjectionRow>): DashboardLedgerProjectionRow => ({
  amount: '0', reportingClass: 'unclassified', referenceType: 'invoice', debitType: 'expense', debitCode: 'EXP-005', creditType: 'asset', creditCode: 'V-001', ...overrides,
});

describe('dashboard ledger parallel projection', () => {
  it('uses persisted reporting classes for the operating reconciliation', () => {
    const result = buildDashboardLedgerProjection([
      row({ amount: '1000', reportingClass: 'operating_revenue' }),
      row({ amount: '300', reportingClass: 'operating_purchase' }),
      row({ amount: '200', reportingClass: 'operating_recurring_expense' }),
      row({ amount: '100', reportingClass: 'operating_other_expense' }),
      row({ amount: '150', reportingClass: 'operating_payroll' }),
    ]);
    expect(result.sales).toBe('1000.0000');
    expect(result.operatingCosts).toBe('750.0000');
    expect(result.operatingResult).toBe('250.0000');
    expect(result.coverage.persistedClassifiedRowCount).toBe(5);
    expect(result.coverage.fallbackClassifiedRowCount).toBe(0);
  });

  it('excludes advances, loans, and transfers from operating costs by persisted class', () => {
    const result = buildDashboardLedgerProjection([
      row({ amount: '500', reportingClass: 'non_operating_advance' }),
      row({ amount: '1000', reportingClass: 'non_operating_loan' }),
      row({ amount: '700', reportingClass: 'internal_transfer' }),
      row({ amount: '125', reportingClass: 'operating_payroll' }),
    ]);
    expect(result.excludedNonOperating).toBe('2200.0000');
    expect(result.payroll).toBe('125.0000');
    expect(result.operatingCosts).toBe('125.0000');
  });

  it('uses only ledger metadata for temporary historical fallback and reports it', () => {
    const sale = row({ amount: '100', referenceType: 'sale', debitType: 'asset', debitCode: 'V-001', creditType: 'revenue', creditCode: 'REV-001' });
    const advance = row({ amount: '80', referenceType: 'advance', debitType: 'asset', debitCode: 'ADV-001' });
    const unknown = row({ amount: '20', referenceType: 'manual_adjustment', debitType: 'asset', debitCode: 'V-001', creditType: 'asset', creditCode: 'V-002' });
    expect(fallbackReportingClassForLedgerRow(sale)).toBe('operating_revenue');
    const result = buildDashboardLedgerProjection([sale, advance, unknown]);
    expect(result.sales).toBe('100.0000');
    expect(result.excludedNonOperating).toBe('80.0000');
    expect(result.unclassified).toBe('20.0000');
    expect(result.coverage.persistedClassifiedRowCount).toBe(0);
    expect(result.coverage.fallbackClassifiedRowCount).toBe(2);
    expect(result.coverage.unclassifiedRowCount).toBe(1);
    expect(result.coverage.classifiedPct).toBeCloseTo(90, 4);
  });
});
