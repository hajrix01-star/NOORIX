export type DashboardLedgerCutoverCandidate<TLedger> = {
  readyForCutover: boolean;
  ledger: TLedger;
};

/**
 * Monetary dashboard values are always sourced from the classified ledger.
 * Reconciliation is returned as a quality flag, never as permission to fall
 * back silently to invoice aggregates.
 */
export function selectDashboardLedgerSource<TLedger>(candidate: DashboardLedgerCutoverCandidate<TLedger>) {
  return {
    source: 'classified_ledger_v2' as const,
    ledger: candidate.ledger,
    reconciliationReady: candidate.readyForCutover,
  };
}
