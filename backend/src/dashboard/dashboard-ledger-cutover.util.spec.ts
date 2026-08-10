import { selectDashboardLedgerSource } from './dashboard-ledger-cutover.util';

describe('selectDashboardLedgerSource', () => {
  it('uses the classified ledger only after the reconciliation gate passes', () => {
    expect(selectDashboardLedgerSource({ readyForCutover: true, ledger: { sales: '100' } }))
      .toEqual({ source: 'classified_ledger_v1', ledger: { sales: '100' } });
  });

  it('keeps the established dashboard contract when a mismatch or unclassified row remains', () => {
    expect(selectDashboardLedgerSource({ readyForCutover: false, ledger: { sales: '100' } }))
      .toEqual({ source: 'legacy_fallback_v1', ledger: undefined });
  });
});