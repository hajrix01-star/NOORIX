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

  it('groups category snapshots, payroll, record counts, and timeline entirely from ledger rows', () => {
    const result = buildDashboardLedgerProjection([
      row({ amount: '60', reportingClass: 'operating_purchase', referenceId: 'inv-1', transactionDate: '2026-07-02', reportingCategoryId: 'food', reportingCategoryNameAr: 'مواد غذائية', reportingCategoryNameEn: 'Food' }),
      row({ amount: '40', reportingClass: 'operating_purchase', referenceId: 'inv-1', transactionDate: '2026-07-02', reportingCategoryId: 'food', reportingCategoryNameAr: 'مواد غذائية', reportingCategoryNameEn: 'Food' }),
      row({ amount: '200', reportingClass: 'operating_payroll', referenceType: 'salary', referenceId: 'salary-1', transactionDate: '2026-07-03' }),
      row({ amount: '15', reportingClass: 'tax_collected', referenceType: 'sale', referenceId: 'sale-1', transactionDate: '2026-07-03' }),
      row({ amount: '100', reportingClass: 'operating_revenue', referenceType: 'sale', referenceId: 'sale-1', transactionDate: '2026-07-03' }),
    ]);

    expect(result.categories.purchases).toEqual([
      expect.objectContaining({ categoryId: 'food', nameAr: 'مواد غذائية', amount: '100.0000', sharePct: 100 }),
    ]);
    expect(result.categories.payroll).toEqual([
      expect.objectContaining({ id: '__payroll__', nameAr: 'رواتب وأجور', amount: '200.0000' }),
    ]);
    expect(result.reportingClassCounts.operating_purchase).toBe(2);
    expect(result.reportingClassRecordCounts.operating_purchase).toBe(1);
    expect(result.timeline.daily).toEqual([
      { periodKey: '2026-07-02', sales: '0.0000', purchases: '100.0000', expenses: '0.0000' },
      { periodKey: '2026-07-03', sales: '115.0000', purchases: '0.0000', expenses: '200.0000' },
    ]);
  });

  it('derives application and supplier amounts only from ledger amounts, including collected VAT', () => {
    const result = buildDashboardLedgerProjection([
      row({
        amount: '100', reportingClass: 'operating_revenue', transactionDate: '2026-07-02',
        vaultId: 'app-vault', vaultNameAr: '?????', vaultNameEn: 'App', vaultType: 'app', referenceId: 'sale-1',
      }),
      row({
        amount: '15', reportingClass: 'tax_collected', transactionDate: '2026-07-02',
        vaultId: 'app-vault', vaultNameAr: '?????', vaultNameEn: 'App', vaultType: 'app', referenceId: 'sale-1',
      }),
      row({
        amount: '80', reportingClass: 'operating_purchase', transactionDate: '2026-07-03',
        supplierId: 'supplier-1', supplierNameAr: '????', supplierNameEn: 'Supplier', referenceId: 'invoice-1',
      }),
      row({
        amount: '20', reportingClass: 'non_operating_advance', transactionDate: '2026-07-03',
        supplierId: 'supplier-1', supplierNameAr: '????', supplierNameEn: 'Supplier', referenceId: 'advance-1',
      }),
    ]);

    expect(result.salesChannels).toEqual([
      expect.objectContaining({ periodKey: '2026-07', vaultId: 'app-vault', amount: '115.0000' }),
    ]);
    expect(result.topSuppliers).toEqual([
      expect.objectContaining({ supplierId: 'supplier-1', amount: '80.0000', invoiceCount: 1, sharePct: 100 }),
    ]);
  });
});
