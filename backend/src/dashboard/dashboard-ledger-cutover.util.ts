export type DashboardLedgerCutoverCandidate<TLedger> = {
  readyForCutover: boolean;
  ledger: TLedger;
};

/**
 * The dashboard may use ledger amounts only after the reconciliation gate has
 * proven the classified ledger covers the entire operating period.
 */
export function selectDashboardLedgerSource<TLedger>(candidate: DashboardLedgerCutoverCandidate<TLedger>) {
  return candidate.readyForCutover
    ? { source: 'classified_ledger_v1' as const, ledger: candidate.ledger }
    : { source: 'legacy_fallback_v1' as const, ledger: undefined };
}