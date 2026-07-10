import Decimal from 'decimal.js';

export type AdvanceSettlementStatus = 'cancelled' | 'settled' | 'partial' | 'outstanding';

export type AdvanceLike = {
  status?: unknown;
  totalAmount?: unknown;
  settledAmount?: unknown;
  totalAmountNum?: unknown;
  settledAmountNum?: unknown;
};

export type AdvanceBalanceParts = {
  totalAmountNum: number;
  settledAmountNum: number;
  remainingAmount: number;
  settlementStatus: AdvanceSettlementStatus;
};

export type AdvanceTotals = {
  count: number;
  totalAmount: Decimal;
  settledAmount: Decimal;
  remainingAmount: Decimal;
  outstandingCount: number;
  partialCount: number;
};

function toDecimal(value: unknown) {
  try {
    return new Decimal((value ?? 0) as Decimal.Value);
  } catch {
    return new Decimal(0);
  }
}

export function getAdvanceBalanceParts(advance: AdvanceLike): AdvanceBalanceParts {
  const total = toDecimal(advance?.totalAmount);
  const settled = Decimal.max(toDecimal(advance?.settledAmount), 0);
  const remaining = Decimal.max(total.minus(settled), 0);
  const settlementStatus: AdvanceSettlementStatus =
    advance?.status === 'cancelled'
      ? 'cancelled'
      : remaining.lte(0) && total.gt(0)
        ? 'settled'
        : settled.gt(0)
          ? 'partial'
          : 'outstanding';

  return {
    totalAmountNum: total.toNumber(),
    settledAmountNum: settled.toNumber(),
    remainingAmount: remaining.toNumber(),
    settlementStatus,
  };
}

function getBalanceSource(advance: AdvanceLike): AdvanceLike {
  return {
    status: advance.status,
    totalAmount: advance.totalAmount ?? advance.totalAmountNum,
    settledAmount: advance.settledAmount ?? advance.settledAmountNum,
  };
}

export function normalizeAdvance<T extends Record<string, unknown>>(advance: T): T & AdvanceBalanceParts {
  return {
    ...advance,
    ...getAdvanceBalanceParts(getBalanceSource(advance)),
  };
}

export function normalizeAdvances<T extends Record<string, unknown>>(advances: T[] | null | undefined): Array<T & AdvanceBalanceParts> {
  return (advances ?? []).map((advance) => normalizeAdvance(advance));
}

export function getAdvanceTotals(advances: AdvanceLike[] | null | undefined): AdvanceTotals {
  const totals: AdvanceTotals = {
    count: advances?.length ?? 0,
    totalAmount: new Decimal(0),
    settledAmount: new Decimal(0),
    remainingAmount: new Decimal(0),
    outstandingCount: 0,
    partialCount: 0,
  };

  for (const advance of advances ?? []) {
    if (advance?.status === 'cancelled') continue;

    const balance = getAdvanceBalanceParts(getBalanceSource(advance));
    totals.totalAmount = totals.totalAmount.plus(toDecimal(balance.totalAmountNum));
    totals.settledAmount = totals.settledAmount.plus(toDecimal(balance.settledAmountNum));
    totals.remainingAmount = totals.remainingAmount.plus(toDecimal(balance.remainingAmount));
    if (balance.settlementStatus === 'outstanding') totals.outstandingCount += 1;
    if (balance.settlementStatus === 'partial') totals.partialCount += 1;
  }

  return totals;
}
