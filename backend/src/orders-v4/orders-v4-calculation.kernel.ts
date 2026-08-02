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
  const incomingUnitCost = calculateOrdersV4InventoryUnitPrice(totalValue, quantity);
  const averageUnitCostAfter = calculateOrdersV4AverageUnitCost(valueAfter, quantityAfter, incomingUnitCost);
  return {
    quantityDelta: quantity.toDecimalPlaces(QUANTITY_SCALE),
    unitCost: incomingUnitCost,
    valueDelta: totalValue.toDecimalPlaces(MONEY_SCALE),
    quantityAfter,
    valueAfter,
    averageUnitCostAfter,
  };
}

export function calculateOrdersV4Issue(
  balance: OrdersV4InventoryBalance,
  input: { quantity: Prisma.Decimal.Value; provisionalUnitCost?: Prisma.Decimal.Value },
): OrdersV4InventoryCalculation {
  const quantity = decimal(input.quantity, 'كمية الصرف');
  if (quantity.lte(0)) throw new BadRequestException('كمية الصرف يجب أن تكون أكبر من صفر');
  const quantityAfter = balance.quantity.minus(quantity).toDecimalPlaces(QUANTITY_SCALE);
  // سياسة V4 المركزية: التسجيل التشغيلي لا يتوقف بسبب نقص المخزون.
  // العجز يبقى ظاهراً كرصيد سالب في دفتر الحركات إلى أن يغطيه استلام أو جرد.
  const provisionalUnitCost = decimal(input.provisionalUnitCost ?? 0, 'تكلفة الصرف المؤقتة');
  if (provisionalUnitCost.lt(0)) throw new BadRequestException('تكلفة الصرف المؤقتة لا يمكن أن تكون سالبة');
  const issueUnitCost = balance.averageUnitCost.gt(0) ? balance.averageUnitCost : provisionalUnitCost;
  const issueValue = quantity.times(issueUnitCost).toDecimalPlaces(MONEY_SCALE);
  const valueAfter = balance.value.minus(issueValue).toDecimalPlaces(MONEY_SCALE);
  const averageUnitCostAfter = calculateOrdersV4AverageUnitCost(valueAfter, quantityAfter, issueUnitCost);
  return {
    quantityDelta: quantity.negated().toDecimalPlaces(QUANTITY_SCALE),
    unitCost: issueUnitCost.toDecimalPlaces(COST_SCALE),
    valueDelta: issueValue.negated(),
    quantityAfter,
    valueAfter,
    averageUnitCostAfter,
  };
}

/**
 * Revalues an existing negative balance at the next real receipt cost before
 * posting that receipt. This keeps quantity and value on the same cost basis.
 */
export function calculateOrdersV4NegativeStockRevaluation(
  balance: OrdersV4InventoryBalance,
  incomingUnitCostInput: Prisma.Decimal.Value,
): OrdersV4InventoryCalculation | null {
  if (balance.quantity.gte(0)) return null;
  const incomingUnitCost = decimal(incomingUnitCostInput, 'تكلفة الوارد لمعالجة العجز');
  if (incomingUnitCost.lt(0)) throw new BadRequestException('تكلفة الوارد لمعالجة العجز لا يمكن أن تكون سالبة');
  const valueAfter = balance.quantity.times(incomingUnitCost).toDecimalPlaces(MONEY_SCALE);
  const valueDelta = valueAfter.minus(balance.value).toDecimalPlaces(MONEY_SCALE);
  if (valueDelta.isZero() && balance.averageUnitCost.eq(incomingUnitCost)) return null;
  return {
    quantityDelta: new Prisma.Decimal(0),
    unitCost: incomingUnitCost.toDecimalPlaces(COST_SCALE),
    valueDelta,
    quantityAfter: balance.quantity.toDecimalPlaces(QUANTITY_SCALE),
    valueAfter,
    averageUnitCostAfter: incomingUnitCost.toDecimalPlaces(COST_SCALE),
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

export function calculateOrdersV4InventoryUnitPrice(
  totalValueInput: Prisma.Decimal.Value,
  inventoryQuantityInput: Prisma.Decimal.Value,
): Prisma.Decimal {
  const totalValue = decimal(totalValueInput, 'القيمة الإجمالية');
  const inventoryQuantity = decimal(inventoryQuantityInput, 'كمية المخزون');
  if (inventoryQuantity.lte(0)) throw new BadRequestException('كمية المخزون لحساب السعر يجب أن تكون أكبر من صفر');
  return totalValue.div(inventoryQuantity).toDecimalPlaces(COST_SCALE);
}

export function calculateOrdersV4AverageUnitCost(
  totalValueInput: Prisma.Decimal.Value,
  quantityInput: Prisma.Decimal.Value,
  zeroQuantityFallback: Prisma.Decimal.Value = 0,
): Prisma.Decimal {
  const totalValue = decimal(totalValueInput, 'القيمة الإجمالية');
  const quantity = decimal(quantityInput, 'كمية حساب متوسط التكلفة');
  if (quantity.isZero()) return decimal(zeroQuantityFallback, 'متوسط التكلفة عند نفاد الكمية').toDecimalPlaces(COST_SCALE);
  const calculated = totalValue.div(quantity);
  // عند تشغيل المخزون بالسالب قد تكون القيمة والكمية مؤقتاً بعلامتين مختلفتين
  // (مثلاً صرف بلا تكلفة سابقة ثم استلام جزئي). لا ننشئ متوسط تكلفة سالباً؛
  // نستخدم آخر/تكلفة الوارد الممررة من العملية صاحبة القرار.
  if (calculated.lt(0)) {
    return decimal(zeroQuantityFallback, 'متوسط التكلفة البديل').toDecimalPlaces(COST_SCALE);
  }
  return calculated.toDecimalPlaces(COST_SCALE);
}

export function calculateOrdersV4ConvertedUnitPrice(
  sourceUnitPriceInput: Prisma.Decimal.Value,
  sourceToTargetConversion: OrdersV4ResolvedConversion,
): Prisma.Decimal {
  const sourceUnitPrice = decimal(sourceUnitPriceInput, 'سعر الوحدة التاريخي');
  if (sourceToTargetConversion.factor.lte(0)) throw new BadRequestException('معامل تحويل السعر التاريخي غير صالح');
  return sourceUnitPrice.div(sourceToTargetConversion.factor).toDecimalPlaces(COST_SCALE);
}

export function calculateOrdersV4ConvertedQuantity(
  sourceQuantityInput: Prisma.Decimal.Value,
  sourceToTargetConversion: OrdersV4ResolvedConversion,
): Prisma.Decimal {
  const sourceQuantity = decimal(sourceQuantityInput, 'الكمية المراد تحويلها');
  if (sourceQuantity.lt(0)) throw new BadRequestException('الكمية المراد تحويلها لا يمكن أن تكون سالبة');
  if (sourceToTargetConversion.factor.lte(0)) throw new BadRequestException('معامل تحويل الكمية غير صالح');
  return sourceQuantity.times(sourceToTargetConversion.factor).toDecimalPlaces(QUANTITY_SCALE);
}

export function calculateOrdersV4RecipeUsage(input: {
  registeredBaseQuantity: Prisma.Decimal.Value;
  recipeOutputQuantity: Prisma.Decimal.Value;
  outputConversion: OrdersV4ResolvedConversion;
  componentQuantity: Prisma.Decimal.Value;
  componentConversion: OrdersV4ResolvedConversion;
}): { batches: Prisma.Decimal; issueQuantity: Prisma.Decimal } {
  const registeredBaseQuantity = decimal(input.registeredBaseQuantity, 'كمية التسجيل الأساسية');
  const recipeOutputQuantity = decimal(input.recipeOutputQuantity, 'كمية مخرج الرسبي');
  const componentQuantity = decimal(input.componentQuantity, 'كمية مكوّن الرسبي');
  const recipeOutputBase = recipeOutputQuantity.times(input.outputConversion.factor).toDecimalPlaces(QUANTITY_SCALE);
  if (recipeOutputBase.lte(0)) throw new BadRequestException('كمية مخرج الرسبي بعد التحويل غير صالحة');
  const batches = registeredBaseQuantity.div(recipeOutputBase).toDecimalPlaces(QUANTITY_SCALE);
  const issueQuantity = componentQuantity
    .times(input.componentConversion.factor)
    .times(batches)
    .toDecimalPlaces(QUANTITY_SCALE);
  if (issueQuantity.lte(0)) throw new BadRequestException('كمية صرف مكوّن الرسبي غير صالحة');
  return { batches, issueQuantity };
}

export function calculateOrdersV4RecipeComponentCost(
  issueQuantityInput: Prisma.Decimal.Value,
  averageInventoryUnitPriceInput: Prisma.Decimal.Value,
): Prisma.Decimal {
  const issueQuantity = decimal(issueQuantityInput, 'كمية صرف المكوّن');
  const averageInventoryUnitPrice = decimal(averageInventoryUnitPriceInput, 'متوسط سعر المكوّن');
  if (issueQuantity.lt(0) || averageInventoryUnitPrice.lt(0)) throw new BadRequestException('مدخلات تكلفة الرسبي لا يمكن أن تكون سالبة');
  return issueQuantity.times(averageInventoryUnitPrice).toDecimalPlaces(MONEY_SCALE);
}

export function calculateOrdersV4Reversal(
  balance: OrdersV4InventoryBalance,
  original: { quantityDelta: Prisma.Decimal.Value; valueDelta: Prisma.Decimal.Value; unitCost: Prisma.Decimal.Value },
  originalToCurrentUnitFactor: Prisma.Decimal.Value = 1,
): OrdersV4InventoryCalculation {
  const factor = decimal(originalToCurrentUnitFactor, 'معامل وحدة العكس');
  if (factor.lte(0)) throw new BadRequestException('معامل وحدة العكس غير صالح');
  const quantityDelta = decimal(original.quantityDelta, 'كمية القيد الأصلي').times(factor).negated().toDecimalPlaces(QUANTITY_SCALE);
  const valueDelta = decimal(original.valueDelta, 'قيمة القيد الأصلي').negated().toDecimalPlaces(MONEY_SCALE);
  const quantityAfter = balance.quantity.plus(quantityDelta).toDecimalPlaces(QUANTITY_SCALE);
  const valueAfter = balance.value.plus(valueDelta).toDecimalPlaces(MONEY_SCALE);
  const averageUnitCostAfter = calculateOrdersV4AverageUnitCost(valueAfter, quantityAfter);
  return {
    quantityDelta,
    unitCost: decimal(original.unitCost, 'تكلفة القيد الأصلي').div(factor).toDecimalPlaces(COST_SCALE),
    valueDelta,
    quantityAfter,
    valueAfter,
    averageUnitCostAfter,
  };
}

export function calculateOrdersV4UnitRebase(
  balance: OrdersV4InventoryBalance,
  oldToNewConversion: OrdersV4ResolvedConversion,
): OrdersV4InventoryCalculation {
  if (oldToNewConversion.factor.lte(0)) throw new BadRequestException('معامل تغيير وحدة المخزون غير صالح');
  const quantityAfter = balance.quantity.times(oldToNewConversion.factor).toDecimalPlaces(QUANTITY_SCALE);
  const averageUnitCostAfter = calculateOrdersV4AverageUnitCost(balance.value, quantityAfter);
  return {
    quantityDelta: new Prisma.Decimal(0),
    unitCost: averageUnitCostAfter,
    valueDelta: new Prisma.Decimal(0),
    quantityAfter,
    valueAfter: balance.value.toDecimalPlaces(MONEY_SCALE),
    averageUnitCostAfter,
  };
}

