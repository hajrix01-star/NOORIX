import Decimal from 'decimal.js';
import { formatReportMoneyInteger, formatReportPercentNumber } from '../common/utils/report-display-format.util';
import { plDec, plPercentOfSales } from './reports-pl-math.util';

export type PlDetailAmountItem = {
  reportAmount: string;
};

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
