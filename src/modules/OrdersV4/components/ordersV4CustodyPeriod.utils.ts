import type { OrdersV4Document } from '../../../types/api';

type PeriodCustodyDocument = Pick<
  OrdersV4Document,
  'id' | 'status' | 'paymentMethod' | 'documentDate' | 'createdAt' | 'pettyCashAmount' | 'totalAmount'
>;

/**
 * The visible non-cumulative custody balance starts at
 * zero for the already date-filtered collection and runs only inside that period.
 * The central custody ledger remains the accounting source of truth.
 */
export function buildOrdersV4PeriodCustodyBalances(
  documents: readonly PeriodCustodyDocument[],
): Map<string, number> {
  const ordered = documents
    .filter((document) => document.status === 'received' && document.paymentMethod === 'custody')
    .sort((left, right) => {
      const dateOrder = left.documentDate.localeCompare(right.documentDate);
      if (dateOrder !== 0) return dateOrder;
      return right.createdAt.localeCompare(left.createdAt);
    });
  const result = new Map<string, number>();
  let balance = 0;
  for (const document of ordered) {
    balance += Number(document.pettyCashAmount ?? 0) - Number(document.totalAmount ?? 0);
    result.set(document.id, balance);
  }
  return result;
}
