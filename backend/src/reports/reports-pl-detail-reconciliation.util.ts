import Decimal from 'decimal.js';
import { formatReportMoneyInteger, formatReportPercentNumber } from '../common/utils/report-display-format.util';
import { plDec, plPercentOfSales } from './reports-pl-math.util';

export type PlDetailAmountItem = {
  reportAmount: string;
};

export type PlDetailSourceItem = PlDetailAmountItem & {
  id: string;
  sourceReferenceId?: string | null;
  sourceItemKey?: string | null;
};

/**
 * Category rows are composite: their invoice documents plus direct ledger postings
 * on any linked category account.  A posted invoice must appear once, as the richer
 * invoice document, even when its ledger entry is also returned by an account query.
 */
export function mergePlCategoryDetailItems<TItem extends PlDetailSourceItem>(
  invoiceItems: TItem[],
  ledgerItems: TItem[],
  acceptedItemKeys?: ReadonlySet<string>,
): TItem[] {
  const invoiceIds = new Set(invoiceItems.map((item) => item.id));
  const seenLedgerEntries = new Set<string>();
  const supplementalLedgerItems = ledgerItems.filter((item) => {
    if (item.sourceReferenceId && invoiceIds.has(item.sourceReferenceId)) return false;
    if (acceptedItemKeys && item.sourceItemKey && !acceptedItemKeys.has(item.sourceItemKey)) return false;
    if (seenLedgerEntries.has(item.id)) return false;
    seenLedgerEntries.add(item.id);
    return true;
  });
  return [...invoiceItems, ...supplementalLedgerItems].sort((left, right) => {
    const leftDate = String((left as TItem & { transactionDate?: string }).transactionDate ?? '');
    const rightDate = String((right as TItem & { transactionDate?: string }).transactionDate ?? '');
    return rightDate.localeCompare(leftDate);
  });
}

export function reconcilePlDetailItems<TItem extends PlDetailAmountItem>(
  detailItems: TItem[],
  salesAmount: Decimal.Value,
  contextAmount: Decimal.Value,
  limit = 500,
) {
  const salesAmountValue = plDec(salesAmount);
  const items = detailItems.map((item) => ({
    ...item,
    percentOfSales: formatReportPercentNumber(
      plPercentOfSales(plDec(item.reportAmount), salesAmountValue),
    ),
  }));
  const documentsAmountValue = items.reduce(
    (sum, item) => sum.plus(plDec(item.reportAmount)),
    new Decimal(0),
  );
  const documentsComplete = items.length < limit;

  return {
    items,
    documentsAmount: formatReportMoneyInteger(documentsAmountValue),
    documentsComplete,
    documentsMatchContext: documentsComplete
      ? documentsAmountValue.minus(plDec(contextAmount)).abs().lte(0.51)
      : null,
  };
}
