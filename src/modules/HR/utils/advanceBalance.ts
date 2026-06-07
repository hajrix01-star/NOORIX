import Decimal from 'decimal.js';

export type AdvanceSettlementStatus = 'cancelled' | 'settled' | 'partial' | 'outstanding';

function toDecimal(value: unknown) {
  try {
    return new Decimal((value ?? 0) as Decimal.Value);
  } catch {
    return new Decimal(0);
  }
}

export function getAdvanceBalanceParts(advance: {
  status?: unknown;
  totalAmount?: unknown;
  settledAmount?: unknown;
}) {
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

export function withAdvanceBalance<T extends Record<string, any>>(advance: T): T & ReturnType<typeof getAdvanceBalanceParts> {
  return {
    ...advance,
    ...getAdvanceBalanceParts(advance),
  };
}
