import { selectDashboardLedgerSource } from './dashboard-ledger-cutover.util';

describe('selectDashboardLedgerSource', () => {
  it('uses the classified ledger after reconciliation passes', () => {
    expect(selectDashboardLedgerSource({ readyForCutover: true, ledger: { sales: '100' } }))
      .toEqual({ source: 'classified_ledger_v2', ledger: { sales: '100' }, reconciliationReady: true });
  });

  it('keeps ledger amounts and exposes a failed quality flag instead of falling back to invoices', () => {
    expect(selectDashboardLedgerSource({ readyForCutover: false, ledger: { sales: '100' } }))
      .toEqual({ source: 'classified_ledger_v2', ledger: { sales: '100' }, reconciliationReady: false });
  });
});
