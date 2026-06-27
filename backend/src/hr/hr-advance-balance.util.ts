export type HrAdvanceBalanceInput = {
  status?: unknown;
  totalAmount?: unknown;
  settledAmount?: unknown;
};

export type HrAdvanceBalanceParts = {
  totalAmount: number;
  settledAmount: number;
  remainingAmount: number;
  settlementStatus: 'cancelled' | 'settled' | 'partial' | 'outstanding';
};

export type HrAdvanceTotals = {
  count: number;
  totalAmount: number;
  settledAmount: number;
  remainingAmount: number;
  remainingCount: number;
  outstandingCount: number;
  partialCount: number;
};

function toMoneyNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function getHrAdvanceBalanceParts(advance: HrAdvanceBalanceInput): HrAdvanceBalanceParts {
  const totalAmount = toMoneyNumber(advance?.totalAmount);
  const settledAmount = Math.max(0, toMoneyNumber(advance?.settledAmount));
  const remainingAmount = Math.max(0, totalAmount - settledAmount);
  const settlementStatus =
    advance?.status === 'cancelled'
      ? 'cancelled'
      : remainingAmount <= 0 && totalAmount > 0
        ? 'settled'
        : settledAmount > 0
          ? 'partial'
          : 'outstanding';

  return {
    totalAmount,
    settledAmount,
    remainingAmount,
    settlementStatus,
  };
}

export function getHrAdvanceTotals(advances: HrAdvanceBalanceInput[] | null | undefined): HrAdvanceTotals {
  const totals: HrAdvanceTotals = {
    count: advances?.length ?? 0,
    totalAmount: 0,
    settledAmount: 0,
    remainingAmount: 0,
    remainingCount: 0,
    outstandingCount: 0,
    partialCount: 0,
  };

  for (const advance of advances ?? []) {
    if (advance?.status === 'cancelled') continue;
    const balance = getHrAdvanceBalanceParts(advance);
    totals.totalAmount += balance.totalAmount;
    totals.settledAmount += balance.settledAmount;
    totals.remainingAmount += balance.remainingAmount;
    if (balance.remainingAmount > 0) totals.remainingCount += 1;
    if (balance.settlementStatus === 'outstanding') totals.outstandingCount += 1;
    if (balance.settlementStatus === 'partial') totals.partialCount += 1;
  }

  return totals;
}
