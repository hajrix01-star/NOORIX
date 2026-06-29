export function mapImportedLedgerRef(
  type: string,
  refId: string,
  maps: {
    invoiceMap: Map<string, string>;
    dailySalesSummaryMap: Map<string, string>;
  },
): string {
  if (['invoice', 'salary', 'advance'].includes(type)) {
    return maps.invoiceMap.get(refId) ?? refId;
  }
  if (type === 'sale') {
    return maps.dailySalesSummaryMap.get(refId) ?? refId;
  }
  return refId;
}
