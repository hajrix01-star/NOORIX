import { DashboardLedgerProjectionService } from './dashboard-ledger-projection.service';

describe('DashboardLedgerProjectionService reconciliation', () => {
  it('compares the current P&L contract with the classified ledger without mutating it', async () => {
    const service = new DashboardLedgerProjectionService(
      { withTenant: jest.fn() } as never,
      {
        getGeneralProfitLossPeriodTotals: jest.fn().mockResolvedValue({
          sales: '1000', purchases: '300', expenses: '300',
        }),
      } as never,
    );
    jest.spyOn(service, 'getPeriodProjection').mockResolvedValue({
      source: 'ledger_parallel_reporting_class_v1',
      sales: '1000.0000', purchases: '300.0000', recurringExpenses: '100.0000', otherExpenses: '50.0000', payroll: '150.0000',
      operatingCosts: '600.0000', operatingResult: '400.0000', excludedNonOperating: '90.0000', taxCollected: '15.0000', unclassified: '0.0000',
      coverage: { persistedClassifiedAmount: '1605.0000', fallbackClassifiedAmount: '0.0000', totalAmount: '1605.0000', classifiedPct: 100, rowCount: 7, persistedClassifiedRowCount: 7, fallbackClassifiedRowCount: 0, unclassifiedRowCount: 0 },
      reportingClassCounts: { operating_revenue: 1, operating_purchase: 1, operating_recurring_expense: 1, operating_other_expense: 1, operating_payroll: 1, non_operating_advance: 0, non_operating_loan: 0, internal_transfer: 0, tax_collected: 1, unclassified: 0, fallback_derived: 0 },
    });

    await expect(service.getPeriodReconciliation('company-1', '2026-07-01', '2026-07-31')).resolves.toMatchObject({
      readyForCutover: true,
      dimensions: expect.arrayContaining([
        expect.objectContaining({ key: 'operatingCosts', delta: '0.0000', matches: true }),
      ]),
    });
  });
});
