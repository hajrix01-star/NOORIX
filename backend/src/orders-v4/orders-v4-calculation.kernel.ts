import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  OrdersV4InventoryBalance,
  OrdersV4InventoryCalculation,
  OrdersV4LineCalculation,
  OrdersV4ResolvedConversion,
} from './orders-v4-kernel.types';

const QUANTITY_SCALE = 8;
const MONEY_SCALE = 6;
const COST_SCALE = 8;

function decimal(value: Prisma.Decimal.Value, label: string): Prisma.Decimal {
  try {
    const parsed = new Prisma.Decimal(value);
    if (!parsed.isFinite()) throw new Error('not finite');
    return parsed;
  } catch {
    throw new BadRequestException(`${label} غير صالح`);
  }
}

export function calculateOrdersV4Line(input: {
  inputQuantity: Prisma.Decimal.Value;
  unitPrice: Prisma.Decimal.Value;
  inputConversion: OrdersV4ResolvedConversion;
  priceConversion: OrdersV4ResolvedConversion;
}): OrdersV4LineCalculation {
  const inputQuantity = decimal(input.inputQuantity, 'الكمية');
  const unitPrice = decimal(input.unitPrice, 'سعر الوحدة');
  if (inputQuantity.lte(0)) throw new BadRequestException('الكمية يجب أن تكون أكبر من صفر');
  if (unitPrice.lt(0)) throw new BadRequestException('سعر الوحدة لا يمكن أن يكون سالباً');
  if (input.inputConversion.factor.lte(0) || input.priceConversion.factor.lte(0)) {
    throw new BadRequestException('معامل التحويل المركزي غير صالح');
  }

  const baseQuantity = inputQuantity
    .times(input.inputConversion.factor)
    .toDecimalPlaces(QUANTITY_SCALE);
  const priceQuantity = baseQuantity
    .div(input.priceConversion.factor)
    .toDecimalPlaces(QUANTITY_SCALE);
  const lineTotal = priceQuantity.times(unitPrice).toDecimalPlaces(MONEY_SCALE);

  return {
    inputQuantity: inputQuantity.toDecimalPlaces(QUANTITY_SCALE),
    baseQuantity,
    priceQuantity,
    unitPrice: unitPrice.toDecimalPlaces(MONEY_SCALE),
    lineTotal,
    inputConversion: input.inputConversion,
    priceConversion: input.priceConversion,
  };
}

export function calculateOrdersV4Receipt(
  balance: OrdersV4InventoryBalance,
  input: { quantity: Prisma.Decimal.Value; totalValue: Prisma.Decimal.Value },
): OrdersV4InventoryCalculation {
  const quantity = decimal(input.quantity, 'كمية الوارد');
  const totalValue = decimal(input.totalValue, 'قيمة الوارد');
  if (quantity.lte(0)) throw new BadRequestException('كمية الوارد يجب أن تكون أكبر من صفر');
  if (totalValue.lt(0)) throw new BadRequestException('قيمة الوارد لا يمكن أن تكون سالبة');
  const quantityAfter = balance.quantity.plus(quantity).toDecimalPlaces(QUANTITY_SCALE);
  const valueAfter = balance.value.plus(totalValue).toDecimalPlaces(MONEY_SCALE);
  const averageUnitCostAfter = quantityAfter.isZero()
    ? new Prisma.Decimal(0)
    : valueAfter.div(quantityAfter).toDecimalPlaces(COST_SCALE);
  return {
    quantityDelta: quantity.toDecimalPlaces(QUANTITY_SCALE),
    unitCost: quantity.isZero() ? new Prisma.Decimal(0) : totalValue.div(quantity).toDecimalPlaces(COST_SCALE),
    valueDelta: totalValue.toDecimalPlaces(MONEY_SCALE),
    quantityAfter,
    valueAfter,
    averageUnitCostAfter,
  };
}

export function calculateOrdersV4Issue(
  balance: OrdersV4InventoryBalance,
  input: { quantity: Prisma.Decimal.Value; allowNegativeStock?: boolean },
): OrdersV4InventoryCalculation {
  const quantity = decimal(input.quantity, 'كمية الصرف');
  if (quantity.lte(0)) throw new BadRequestException('كمية الصرف يجب أن تكون أكبر من صفر');
  const quantityAfter = balance.quantity.minus(quantity).toDecimalPlaces(QUANTITY_SCALE);
  if (!input.allowNegativeStock && quantityAfter.lt(0)) {
    throw new BadRequestException('الرصيد غير كافٍ لإتمام الصرف');
  }
  const issueValue = quantity.times(balance.averageUnitCost).toDecimalPlaces(MONEY_SCALE);
  const valueAfter = balance.value.minus(issueValue).toDecimalPlaces(MONEY_SCALE);
  const averageUnitCostAfter = quantityAfter.isZero()
    ? balance.averageUnitCost.toDecimalPlaces(COST_SCALE)
    : valueAfter.div(quantityAfter).toDecimalPlaces(COST_SCALE);
  return {
    quantityDelta: quantity.negated().toDecimalPlaces(QUANTITY_SCALE),
    unitCost: balance.averageUnitCost.toDecimalPlaces(COST_SCALE),
    valueDelta: issueValue.negated(),
    quantityAfter,
    valueAfter,
    averageUnitCostAfter,
  };
}

export function calculateOrdersV4StocktakeAdjustment(
  balance: OrdersV4InventoryBalance,
  physicalQuantityInput: Prisma.Decimal.Value,
): OrdersV4InventoryCalculation {
  const physicalQuantity = decimal(physicalQuantityInput, 'الكمية الفعلية').toDecimalPlaces(QUANTITY_SCALE);
  if (physicalQuantity.lt(0)) throw new BadRequestException('الكمية الفعلية لا يمكن أن تكون سالبة');
  const quantityDelta = physicalQuantity.minus(balance.quantity).toDecimalPlaces(QUANTITY_SCALE);
  const valueDelta = quantityDelta.times(balance.averageUnitCost).toDecimalPlaces(MONEY_SCALE);
  const valueAfter = balance.value.plus(valueDelta).toDecimalPlaces(MONEY_SCALE);
  return {
    quantityDelta,
    unitCost: balance.averageUnitCost.toDecimalPlaces(COST_SCALE),
    valueDelta,
    quantityAfter: physicalQuantity,
    valueAfter,
    averageUnitCostAfter: balance.averageUnitCost.toDecimalPlaces(COST_SCALE),
  };
}

/** Central V4 policy for recipe costing from normalized received prices. */
export function calculateOrdersV4LastFiveAverage(
  inventoryUnitPrices: readonly Prisma.Decimal.Value[],
): Prisma.Decimal {
  const samples = inventoryUnitPrices.slice(0, 5).map((value) => decimal(value, 'سعر الشراء'));
  if (!samples.length) return new Prisma.Decimal(0);
  return samples.reduce((sum, value) => sum.plus(value), new Prisma.Decimal(0)).div(samples.length).toDecimalPlaces(8);
}

