import { Prisma } from '@prisma/client';

const ZERO = new Prisma.Decimal(0);

export type InventoryLedgerBalanceV2 = Readonly<{
  quantity: Prisma.Decimal;
  value: Prisma.Decimal;
  averageUnitCost: Prisma.Decimal;
}>;

export type InventoryLedgerCalculationV2 = Readonly<{
  quantityDelta: Prisma.Decimal;
  unitCost: Prisma.Decimal;
  valueDelta: Prisma.Decimal;
  quantityAfter: Prisma.Decimal;
  valueAfter: Prisma.Decimal;
  averageUnitCostAfter: Prisma.Decimal;
}>;

export type InventoryLedgerChangeV2 =
  | Readonly<{
      kind: 'receipt';
      quantity: Prisma.Decimal;
      unitCost: Prisma.Decimal;
    }>
  | Readonly<{
      kind: 'issue';
      quantity: Prisma.Decimal;
    }>
  | Readonly<{
      kind: 'adjustment';
      quantityDelta: Prisma.Decimal;
      unitCost?: Prisma.Decimal;
    }>
  | Readonly<{
      kind: 'reversal';
      originalQuantityDelta: Prisma.Decimal;
      originalValueDelta: Prisma.Decimal;
    }>;

function requirePositive(value: Prisma.Decimal, label: string): void {
  if (value.lessThanOrEqualTo(ZERO)) {
    throw new Error(`${label} must be greater than zero`);
  }
}

function requireNonNegative(value: Prisma.Decimal, label: string): void {
  if (value.isNegative()) {
    throw new Error(`${label} cannot be negative`);
  }
}

function normalizedAverage(quantity: Prisma.Decimal, value: Prisma.Decimal, fallback: Prisma.Decimal): Prisma.Decimal {
  if (quantity.isZero()) return ZERO;
  if (quantity.isPositive()) return value.div(quantity);
  return fallback;
}

function calculateReceipt(
  balance: InventoryLedgerBalanceV2,
  quantity: Prisma.Decimal,
  unitCost: Prisma.Decimal,
): InventoryLedgerCalculationV2 {
  requirePositive(quantity, 'Receipt quantity');
  requireNonNegative(unitCost, 'Receipt unit cost');

  const quantityAfter = balance.quantity.plus(quantity);
  let valueDelta: Prisma.Decimal;

  if (balance.quantity.isNegative()) {
    const debtQuantity = Prisma.Decimal.min(quantity, balance.quantity.abs());
    const residualQuantity = quantity.minus(debtQuantity);
    valueDelta = debtQuantity.mul(balance.averageUnitCost).plus(residualQuantity.mul(unitCost));
  } else {
    valueDelta = quantity.mul(unitCost);
  }

  const valueAfter = balance.value.plus(valueDelta);
  return {
    quantityDelta: quantity,
    unitCost,
    valueDelta,
    quantityAfter,
    valueAfter,
    averageUnitCostAfter: normalizedAverage(quantityAfter, valueAfter, unitCost),
  };
}

function calculateIssue(
  balance: InventoryLedgerBalanceV2,
  quantity: Prisma.Decimal,
): InventoryLedgerCalculationV2 {
  requirePositive(quantity, 'Issue quantity');
  const quantityDelta = quantity.negated();
  const valueDelta = quantity.mul(balance.averageUnitCost).negated();
  const quantityAfter = balance.quantity.plus(quantityDelta);
  const valueAfter = balance.value.plus(valueDelta);

  return {
    quantityDelta,
    unitCost: balance.averageUnitCost,
    valueDelta,
    quantityAfter,
    valueAfter,
    averageUnitCostAfter: normalizedAverage(quantityAfter, valueAfter, balance.averageUnitCost),
  };
}

export function calculateInventoryLedgerEntryV2(
  balance: InventoryLedgerBalanceV2,
  change: InventoryLedgerChangeV2,
): InventoryLedgerCalculationV2 {
  if (change.kind === 'receipt') {
    return calculateReceipt(balance, change.quantity, change.unitCost);
  }
  if (change.kind === 'issue') {
    return calculateIssue(balance, change.quantity);
  }
  if (change.kind === 'reversal') {
    const quantityDelta = change.originalQuantityDelta.negated();
    const valueDelta = change.originalValueDelta.negated();
    const quantityAfter = balance.quantity.plus(quantityDelta);
    const valueAfter = balance.value.plus(valueDelta);
    const unitCost = change.originalQuantityDelta.isZero()
      ? ZERO
      : change.originalValueDelta.div(change.originalQuantityDelta);

    return {
      quantityDelta,
      unitCost,
      valueDelta,
      quantityAfter,
      valueAfter,
      averageUnitCostAfter: normalizedAverage(quantityAfter, valueAfter, balance.averageUnitCost),
    };
  }

  if (change.quantityDelta.isZero()) {
    throw new Error('Adjustment quantity cannot be zero');
  }
  if (change.quantityDelta.isPositive()) {
    return calculateReceipt(
      balance,
      change.quantityDelta,
      change.unitCost ?? balance.averageUnitCost,
    );
  }
  return calculateIssue(balance, change.quantityDelta.abs());
}
