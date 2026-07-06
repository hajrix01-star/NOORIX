import { useMemo } from 'react';
import Decimal from 'decimal.js';
import {
  calculatePurchaseBatchSummary,
  sumAmounts,
  TAX_RATE,
  type PurchaseBatchLineLike,
} from '@noorix/finance-core';

export function useBatchSummary(
  rows: PurchaseBatchLineLike[],
  vatRateDecimal: number = TAX_RATE,
  batchNotes = '',
) {
  return useMemo(() => {
    const summary = calculatePurchaseBatchSummary(rows, batchNotes.trim(), vatRateDecimal);
    return {
      net: new Decimal(summary.net),
      tax: new Decimal(summary.tax),
      total: new Decimal(summary.total),
      count: summary.count,
    };
  }, [rows, vatRateDecimal, batchNotes]);
}

export { sumAmounts };
