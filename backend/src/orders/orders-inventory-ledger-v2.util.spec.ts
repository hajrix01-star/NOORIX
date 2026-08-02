import { Prisma } from '@prisma/client';
import {
  calculateInventoryLedgerEntryV2,
  type InventoryLedgerBalanceV2,
} from './orders-inventory-ledger-v2.model';

const decimal = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);

function balance(quantity: Prisma.Decimal.Value, value: Prisma.Decimal.Value): InventoryLedgerBalanceV2 {
  const quantityDecimal = decimal(quantity);
  const valueDecimal = decimal(value);
  return {
    quantity: quantityDecimal,
    value: valueDecimal,
    averageUnitCost: quantityDecimal.isZero() ? decimal(0) : valueDecimal.div(quantityDecimal),
  };
}

describe('calculateInventoryLedgerEntryV2', () => {
  it('uses weighted average costing for receipts', () => {
    const result = calculateInventoryLedgerEntryV2(balance(10, 100), {
      kind: 'receipt',
      quantity: decimal(10),
      unitCost: decimal(20),
    });

    expect(result.quantityAfter.toString()).toBe('20');
    expect(result.valueAfter.toString()).toBe('300');
    expect(result.averageUnitCostAfter.toString()).toBe('15');
  });

  it('issues inventory at the current weighted average and permits a negative balance', () => {
    const result = calculateInventoryLedgerEntryV2(balance(5, 50), {
      kind: 'issue',
      quantity: decimal(8),
    });

    expect(result.quantityDelta.toString()).toBe('-8');
    expect(result.valueDelta.toString()).toBe('-80');
    expect(result.quantityAfter.toString()).toBe('-3');
    expect(result.valueAfter.toString()).toBe('-30');
    expect(result.averageUnitCostAfter.toString()).toBe('10');
  });

  it('settles negative stock at its historic cost before costing residual receipts', () => {
    const result = calculateInventoryLedgerEntryV2(balance(-5, -50), {
      kind: 'receipt',
      quantity: decimal(8),
      unitCost: decimal(20),
    });

    expect(result.valueDelta.toString()).toBe('110');
    expect(result.quantityAfter.toString()).toBe('3');
    expect(result.valueAfter.toString()).toBe('60');
    expect(result.averageUnitCostAfter.toString()).toBe('20');
  });

  it('creates an exact opposite entry for a reversal', () => {
    const result = calculateInventoryLedgerEntryV2(balance(12, 180), {
      kind: 'reversal',
      originalQuantityDelta: decimal(2),
      originalValueDelta: decimal(40),
    });

    expect(result.quantityDelta.toString()).toBe('-2');
    expect(result.valueDelta.toString()).toBe('-40');
    expect(result.quantityAfter.toString()).toBe('10');
    expect(result.valueAfter.toString()).toBe('140');
    expect(result.averageUnitCostAfter.toString()).toBe('14');
  });

  it('rejects zero or negative business quantities', () => {
    expect(() =>
      calculateInventoryLedgerEntryV2(balance(0, 0), {
        kind: 'receipt',
        quantity: decimal(0),
        unitCost: decimal(10),
      }),
    ).toThrow('Receipt quantity must be greater than zero');
  });
});
