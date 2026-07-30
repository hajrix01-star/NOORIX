import { Prisma } from '@prisma/client';

export type ShishaMaterialType = 'tobacco' | 'hose' | 'charcoal';
export type ShishaMovementType = 'opening' | 'purchase' | 'stocktake_adjustment';

export type ShishaMovementInput = {
  date: string;
  movementType: ShishaMovementType;
  materialType: ShishaMaterialType;
  quantityBase: Prisma.Decimal | number | string;
  costInclVat?: Prisma.Decimal | number | string | null;
};

export type ShishaSaleEventInput = {
  date: string;
  operationKey: string;
  heads: Prisma.Decimal | number | string;
  changes: Prisma.Decimal | number | string;
  actualCharcoalBoxes?: Prisma.Decimal | number | string | null;
};

export type ShishaCharcoalDailyStatus =
  | 'legacy_expected'
  | 'missing_actual'
  | 'matched'
  | 'over'
  | 'under'
  | 'no_activity';

export type ShishaInventoryCalculationInput = {
  trackingStartDate: string;
  charcoalActualTrackingStartDate?: string | null;
  startDate: string;
  endDate: string;
  headsPerKg: Prisma.Decimal | number | string;
  charcoalPacksPerCarton: number;
  charcoalPiecesPerPack: number;
  charcoalShishaPerPack: number;
  movements: ShishaMovementInput[];
  sales: ShishaSaleEventInput[];
};

type DailyMovement = {
  openingTobacco: Prisma.Decimal;
  openingHoses: Prisma.Decimal;
  openingCharcoal: Prisma.Decimal;
  purchaseTobacco: Prisma.Decimal;
  purchaseHoses: Prisma.Decimal;
  purchaseCharcoal: Prisma.Decimal;
  correctionTobacco: Prisma.Decimal;
  correctionHoses: Prisma.Decimal;
  correctionCharcoal: Prisma.Decimal;
};

type DailySale = {
  operations: Set<string>;
  heads: Prisma.Decimal;
  changes: Prisma.Decimal;
  actualCharcoalBoxes: Prisma.Decimal;
  hasActualCharcoalEntry: boolean;
};

const ZERO = new Prisma.Decimal(0);
const CHARCOAL_MATCH_TOLERANCE_BOXES = new Prisma.Decimal(0.125);

function decimal(value: Prisma.Decimal | number | string | null | undefined): Prisma.Decimal {
  return new Prisma.Decimal(value ?? 0);
}

function round(value: Prisma.Decimal, digits = 3): number {
  return Number(value.toDecimalPlaces(digits).toString());
}

function dateKeys(startDate: string, endDate: string): string[] {
  const out: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  while (cursor <= end) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

function emptyMovement(): DailyMovement {
  return {
    openingTobacco: ZERO,
    openingHoses: ZERO,
    openingCharcoal: ZERO,
    purchaseTobacco: ZERO,
    purchaseHoses: ZERO,
    purchaseCharcoal: ZERO,
    correctionTobacco: ZERO,
    correctionHoses: ZERO,
    correctionCharcoal: ZERO,
  };
}

function emptySale(): DailySale {
  return {
    operations: new Set<string>(),
    heads: ZERO,
    changes: ZERO,
    actualCharcoalBoxes: ZERO,
    hasActualCharcoalEntry: false,
  };
}

function charcoalConsumptionForDay(
  date: string,
  sale: DailySale,
  actualTrackingStartDate: string | null | undefined,
  shishasPerBox: number,
) {
  const expectedBoxes = sale.heads.div(shishasPerBox);
  const actualTrackingActive = Boolean(actualTrackingStartDate && date >= actualTrackingStartDate);
  if (!actualTrackingActive) {
    return {
      expectedBoxes,
      actualBoxes: null,
      consumedBoxes: expectedBoxes,
      varianceBoxes: null,
      status: 'legacy_expected' as ShishaCharcoalDailyStatus,
    };
  }

  const actualBoxes = sale.hasActualCharcoalEntry ? sale.actualCharcoalBoxes : null;
  if (!sale.hasActualCharcoalEntry) {
    return {
      expectedBoxes,
      actualBoxes,
      consumedBoxes: ZERO,
      varianceBoxes: null,
      status: expectedBoxes.gt(0) ? 'missing_actual' as const : 'no_activity' as const,
    };
  }

  const varianceBoxes = sale.actualCharcoalBoxes.minus(expectedBoxes);
  const status: ShishaCharcoalDailyStatus = expectedBoxes.eq(0) && sale.actualCharcoalBoxes.eq(0)
    ? 'no_activity'
    : varianceBoxes.abs().lte(CHARCOAL_MATCH_TOLERANCE_BOXES)
      ? 'matched'
      : varianceBoxes.gt(0)
        ? 'over'
        : 'under';
  return {
    expectedBoxes,
    actualBoxes: sale.actualCharcoalBoxes,
    consumedBoxes: sale.actualCharcoalBoxes,
    varianceBoxes,
    status,
  };
}

function movementBucket(materialType: ShishaMaterialType): 'Tobacco' | 'Hoses' | 'Charcoal' {
  if (materialType === 'tobacco') return 'Tobacco';
  if (materialType === 'hose') return 'Hoses';
  return 'Charcoal';
}

export function calculateShishaInventory(input: ShishaInventoryCalculationInput) {
  const headsPerKg = decimal(input.headsPerKg);
  const gramsPerHead = new Prisma.Decimal(1000).div(headsPerKg);
  const effectiveStart = input.startDate < input.trackingStartDate
    ? input.trackingStartDate
    : input.startDate;

  const movementByDay = new Map<string, DailyMovement>();
  for (const movement of input.movements) {
    if (movement.date < input.trackingStartDate || movement.date > input.endDate) continue;
    const row = movementByDay.get(movement.date) ?? emptyMovement();
    const suffix = movementBucket(movement.materialType);
    const quantity = decimal(movement.quantityBase);
    if (movement.movementType === 'opening') row[`opening${suffix}`] = row[`opening${suffix}`].plus(quantity);
    if (movement.movementType === 'purchase') row[`purchase${suffix}`] = row[`purchase${suffix}`].plus(quantity);
    if (movement.movementType === 'stocktake_adjustment') row[`correction${suffix}`] = row[`correction${suffix}`].plus(quantity);
    movementByDay.set(movement.date, row);
  }

  const saleByDay = new Map<string, DailySale>();
  for (const sale of input.sales) {
    if (sale.date < input.trackingStartDate || sale.date > input.endDate) continue;
    const row = saleByDay.get(sale.date) ?? emptySale();
    const heads = decimal(sale.heads);
    if (heads.gt(0)) row.operations.add(sale.operationKey);
    row.heads = row.heads.plus(heads);
    row.changes = row.changes.plus(decimal(sale.changes));
    if (sale.actualCharcoalBoxes != null) {
      row.actualCharcoalBoxes = row.actualCharcoalBoxes.plus(decimal(sale.actualCharcoalBoxes));
      row.hasActualCharcoalEntry = true;
    }
    saleByDay.set(sale.date, row);
  }

  let tobacco = ZERO;
  let hoses = ZERO;
  let charcoal = ZERO;

  const applyDay = (key: string) => {
    const movement = movementByDay.get(key) ?? emptyMovement();
    const sale = saleByDay.get(key) ?? emptySale();
    const newShisha = sale.heads.minus(sale.changes);
    const charcoalDay = charcoalConsumptionForDay(
      key,
      sale,
      input.charcoalActualTrackingStartDate,
      input.charcoalShishaPerPack,
    );
    const charcoalConsumed = charcoalDay.consumedBoxes.times(input.charcoalPiecesPerPack);
    tobacco = tobacco
      .plus(movement.openingTobacco)
      .plus(movement.purchaseTobacco)
      .plus(movement.correctionTobacco)
      .minus(sale.heads.times(gramsPerHead));
    hoses = hoses
      .plus(movement.openingHoses)
      .plus(movement.purchaseHoses)
      .plus(movement.correctionHoses)
      .minus(newShisha);
    charcoal = charcoal
      .plus(movement.openingCharcoal)
      .plus(movement.purchaseCharcoal)
      .plus(movement.correctionCharcoal)
      .minus(charcoalConsumed);
  };

  if (effectiveStart > input.trackingStartDate) {
    const previousDay = new Date(`${effectiveStart}T00:00:00.000Z`);
    previousDay.setUTCDate(previousDay.getUTCDate() - 1);
    for (const key of dateKeys(input.trackingStartDate, previousDay.toISOString().slice(0, 10))) {
      applyDay(key);
    }
  }

  const daily = [];
  let periodOperations = 0;
  let periodHeads = ZERO;
  let periodChanges = ZERO;
  let periodPurchasedTobacco = ZERO;
  let periodPurchasedHoses = ZERO;
  let periodPurchasedCharcoal = ZERO;
  let periodConsumedCharcoal = ZERO;
  let periodComparableExpectedCharcoalBoxes = ZERO;
  let periodActualCharcoalBoxes = ZERO;
  let periodMissingCharcoalDays = 0;
  let periodCharcoalAlertDays = 0;
  let periodCorrectionTobacco = ZERO;

  for (const key of dateKeys(effectiveStart, input.endDate)) {
    const movement = movementByDay.get(key) ?? emptyMovement();
    const sale = saleByDay.get(key) ?? emptySale();

    const openingTobacco = tobacco.plus(movement.openingTobacco);
    const openingHoses = hoses.plus(movement.openingHoses);
    const openingCharcoal = charcoal.plus(movement.openingCharcoal);
    const newShisha = sale.heads.minus(sale.changes);
    const consumedGrams = sale.heads.times(gramsPerHead);
    const charcoalDay = charcoalConsumptionForDay(
      key,
      sale,
      input.charcoalActualTrackingStartDate,
      input.charcoalShishaPerPack,
    );
    const consumedCharcoalBoxes = charcoalDay.consumedBoxes;
    const consumedCharcoalPieces = consumedCharcoalBoxes.times(input.charcoalPiecesPerPack);

    tobacco = openingTobacco
      .plus(movement.purchaseTobacco)
      .plus(movement.correctionTobacco)
      .minus(consumedGrams);
    hoses = openingHoses
      .plus(movement.purchaseHoses)
      .plus(movement.correctionHoses)
      .minus(newShisha);
    charcoal = openingCharcoal
      .plus(movement.purchaseCharcoal)
      .plus(movement.correctionCharcoal)
      .minus(consumedCharcoalPieces);

    periodOperations += sale.operations.size;
    periodHeads = periodHeads.plus(sale.heads);
    periodChanges = periodChanges.plus(sale.changes);
    periodPurchasedTobacco = periodPurchasedTobacco.plus(movement.purchaseTobacco);
    periodPurchasedHoses = periodPurchasedHoses.plus(movement.purchaseHoses);
    periodPurchasedCharcoal = periodPurchasedCharcoal.plus(movement.purchaseCharcoal);
    periodConsumedCharcoal = periodConsumedCharcoal.plus(consumedCharcoalPieces);
    if (charcoalDay.status !== 'legacy_expected') {
      periodComparableExpectedCharcoalBoxes = periodComparableExpectedCharcoalBoxes.plus(charcoalDay.expectedBoxes);
    }
    if (charcoalDay.actualBoxes) {
      periodActualCharcoalBoxes = periodActualCharcoalBoxes.plus(charcoalDay.actualBoxes);
    }
    if (charcoalDay.status === 'missing_actual') periodMissingCharcoalDays++;
    if (['missing_actual', 'over', 'under'].includes(charcoalDay.status)) periodCharcoalAlertDays++;
    periodCorrectionTobacco = periodCorrectionTobacco.plus(movement.correctionTobacco);

    daily.push({
      date: key,
      operations: sale.operations.size,
      newShisha: round(newShisha, 3),
      changes: round(sale.changes, 3),
      tobaccoHeadsConsumed: round(sale.heads, 3),
      tobaccoConsumedKg: round(consumedGrams.div(1000), 3),
      hosesConsumed: round(newShisha, 3),
      tobaccoPurchasedKg: round(movement.purchaseTobacco.div(1000), 3),
      tobaccoCorrectionKg: round(movement.correctionTobacco.div(1000), 3),
      openingTobaccoKg: round(openingTobacco.div(1000), 3),
      closingTobaccoKg: round(tobacco.div(1000), 3),
      closingTobaccoHeads: Math.max(0, Math.floor(tobacco.div(1000).times(headsPerKg).toNumber())),
      openingHoses: round(openingHoses, 3),
      closingHoses: round(hoses, 3),
      openingCharcoalPieces: round(openingCharcoal, 3),
      closingCharcoalPieces: round(charcoal, 3),
      charcoalPurchasedBoxes: round(movement.purchaseCharcoal.div(input.charcoalPiecesPerPack), 3),
      charcoalConsumedBoxes: round(consumedCharcoalBoxes, 3),
      charcoalConsumedPieces: round(consumedCharcoalPieces, 3),
      charcoalExpectedBoxes: round(charcoalDay.expectedBoxes, 3),
      charcoalActualBoxes: charcoalDay.actualBoxes == null ? null : round(charcoalDay.actualBoxes, 3),
      charcoalVarianceBoxes: charcoalDay.varianceBoxes == null ? null : round(charcoalDay.varianceBoxes, 3),
      charcoalStatus: charcoalDay.status,
      openingCharcoalBoxes: round(openingCharcoal.div(input.charcoalPiecesPerPack), 3),
      closingCharcoalBoxes: round(charcoal.div(input.charcoalPiecesPerPack), 3),
    });
  }

  const costBearingTobacco = input.movements.filter((movement) =>
    movement.materialType === 'tobacco' &&
    movement.date <= input.endDate &&
    movement.date >= input.trackingStartDate &&
    (movement.movementType === 'opening' || movement.movementType === 'purchase') &&
    movement.costInclVat != null,
  );
  const costTobaccoGrams = costBearingTobacco.reduce((sum, movement) => sum.plus(decimal(movement.quantityBase)), ZERO);
  const costTobaccoTotal = costBearingTobacco.reduce((sum, movement) => sum.plus(decimal(movement.costInclVat)), ZERO);
  const averageCostPerGram = costTobaccoGrams.gt(0) ? costTobaccoTotal.div(costTobaccoGrams) : null;
  const charcoalPiecesPerCarton = input.charcoalPacksPerCarton * input.charcoalPiecesPerPack;
  const safeCharcoal = Prisma.Decimal.max(charcoal, 0);
  const charcoalCartons = safeCharcoal.div(charcoalPiecesPerCarton).floor();
  const charcoalRemainder = safeCharcoal.minus(charcoalCartons.times(charcoalPiecesPerCarton));
  const charcoalPacks = charcoalRemainder.div(input.charcoalPiecesPerPack).floor();
  const charcoalPieces = charcoalRemainder.minus(charcoalPacks.times(input.charcoalPiecesPerPack));

  return {
    effectiveStart,
    daily,
    current: {
      tobaccoGrams: round(tobacco, 3),
      tobaccoKg: round(tobacco.div(1000), 3),
      tobaccoHeads: Math.max(0, Math.floor(tobacco.div(1000).times(headsPerKg).toNumber())),
      hoses: round(hoses, 3),
      charcoalPiecesTotal: round(charcoal, 3),
      charcoalBoxesTotal: round(charcoal.div(input.charcoalPiecesPerPack), 3),
      charcoalCartons: round(charcoalCartons, 0),
      charcoalPacks: round(charcoalPacks, 0),
      charcoalPieces: round(charcoalPieces, 0),
      averageCostPerGram: averageCostPerGram ? round(averageCostPerGram, 4) : null,
      averageCostPerHead: averageCostPerGram ? round(averageCostPerGram.times(gramsPerHead), 4) : null,
    },
    periodTotals: {
      operations: periodOperations,
      newShisha: round(periodHeads.minus(periodChanges), 3),
      changes: round(periodChanges, 3),
      tobaccoHeadsConsumed: round(periodHeads, 3),
      tobaccoConsumedKg: round(periodHeads.times(gramsPerHead).div(1000), 3),
      hosesConsumed: round(periodHeads.minus(periodChanges), 3),
      tobaccoPurchasedKg: round(periodPurchasedTobacco.div(1000), 3),
      hosesPurchased: round(periodPurchasedHoses, 3),
      charcoalPiecesPurchased: round(periodPurchasedCharcoal, 3),
      charcoalBoxesPurchased: round(periodPurchasedCharcoal.div(input.charcoalPiecesPerPack), 3),
      charcoalPiecesConsumed: round(periodConsumedCharcoal, 3),
      charcoalBoxesConsumed: round(periodConsumedCharcoal.div(input.charcoalPiecesPerPack), 3),
      charcoalExpectedBoxes: round(periodComparableExpectedCharcoalBoxes, 3),
      charcoalActualBoxes: round(periodActualCharcoalBoxes, 3),
      charcoalVarianceBoxes: round(periodActualCharcoalBoxes.minus(periodComparableExpectedCharcoalBoxes), 3),
      charcoalMissingDays: periodMissingCharcoalDays,
      charcoalAlertDays: periodCharcoalAlertDays,
      tobaccoCorrectionKg: round(periodCorrectionTobacco.div(1000), 3),
    },
  };
}
