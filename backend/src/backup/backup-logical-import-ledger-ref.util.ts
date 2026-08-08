export function mapImportedLedgerRef(
  type: string,
  refId: string,
  maps: {
    invoiceMap: Map<string, string>;
    dailySalesSummaryMap: Map<string, string>;
    transferMap?: Map<string, string>;
    transferByLedgerEntryId?: Map<string, string>;
    loanMap?: Map<string, string>;
    loanPaymentMap?: Map<string, string>;
    ledgerEntryId?: string;
  },
): string {
  if (['invoice', 'salary', 'advance'].includes(type)) {
    return maps.invoiceMap.get(refId) ?? refId;
  }
  if (type === 'sale') {
    return maps.dailySalesSummaryMap.get(refId) ?? refId;
  }
  if (type === 'transfer') {
    // Migration-created legacy vouchers retained the old transfer number in the
    // ledger reference; their ledger-entry link is the authoritative lookup.
    return (maps.ledgerEntryId
      ? maps.transferByLedgerEntryId?.get(maps.ledgerEntryId)
      : undefined)
      ?? maps.transferMap?.get(refId)
      ?? refId;
  }
  if (type === 'loan_opening') return maps.loanMap?.get(refId) ?? refId;
  if (type === 'loan_payment' || type === 'loan_payment_reversal') return maps.loanPaymentMap?.get(refId) ?? refId;
  return refId;
}
