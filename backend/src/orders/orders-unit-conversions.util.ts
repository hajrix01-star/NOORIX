import { Prisma } from '@prisma/client';

const ONE = new Prisma.Decimal(1);

const UNIT_ALIASES = new Map<string, string>([
  ['piece', 'piece'],
  ['pieces', 'piece'],
  ['pc', 'piece'],
  ['pcs', 'piece'],
  ['each', 'piece'],
  ['حبة', 'piece'],
  ['قطعة', 'piece'],
  ['pack', 'pack'],
  ['علبة', 'pack'],
  ['عبوة', 'pack'],
  ['half_pack', 'half_pack'],
  ['half pack', 'half_pack'],
  ['نصف علبة', 'half_pack'],
  ['box', 'box'],
  ['صندوق', 'box'],
  ['carton', 'carton'],
  ['كرتون', 'carton'],
  ['dozen', 'dozen'],
  ['درزن', 'dozen'],
  ['bottle', 'bottle'],
  ['قارورة', 'bottle'],
  ['cup', 'cup'],
  ['كوب', 'cup'],
  ['kg', 'kg'],
  ['kilogram', 'kg'],
  ['kilograms', 'kg'],
  ['كيلو', 'kg'],
  ['كيلوجرام', 'kg'],
  ['كجم', 'kg'],
  ['كج', 'kg'],
  ['كغ', 'kg'],
  ['g', 'g'],
  ['gm', 'g'],
  ['gram', 'g'],
  ['grams', 'g'],
  ['جرام', 'g'],
  ['غرام', 'g'],
  ['جم', 'g'],
  ['l', 'l'],
  ['lt', 'l'],
  ['liter', 'l'],
  ['litre', 'l'],
  ['لتر', 'l'],
  ['ml', 'ml'],
  ['milliliter', 'ml'],
  ['millilitre', 'ml'],
  ['مل', 'ml'],
  ['مليلتر', 'ml'],
  ['ملليلتر', 'ml'],
]);

export type ProductUnitConversionInput = {
  fromUnit?: unknown;
  toUnit?: unknown;
  multiplier?: unknown;
  label?: unknown;
};

type ProductWithUnitConversions = {
  unit?: string | null;
  inventoryConversions?: unknown;
  conversionTemplate?: { conversions?: unknown } | null;
};

export type ProductUnitConversionValidationIssue = {
  code: 'duplicate' | 'same-unit' | 'invalid-row' | 'ambiguous-source' | 'cycle' | 'standard-conflict';
  fromUnit?: string;
  toUnit?: string;
  message: string;
};

export type ProductUnitConversionSequenceIssue = {
  code: 'disconnected' | 'incomplete';
  index: number;
  expectedFromUnit: string;
  actualFromUnit: string;
  message: string;
};

function decimal(value: unknown): Prisma.Decimal | null {
  try {
    const parsed = new Prisma.Decimal(String(value ?? ''));
    return parsed.gt(0) ? parsed : null;
  } catch {
    return null;
  }
}

function canonicalUnit(value: unknown): string {
  const unit = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (!unit) return '';
  return UNIT_ALIASES.get(unit.toLowerCase()) ?? unit;
}

export function normalizeUnit(value: unknown, fallback = 'piece') {
  return canonicalUnit(value) || canonicalUnit(fallback) || 'piece';
}

function unitPairMultiplier(fromUnit: string, toUnit: string): Prisma.Decimal | null {
  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);
  if (from === to) return ONE;

  const common = new Map<string, string>([
    ['kg:g', '1000'],
    ['g:kg', '0.001'],
    ['l:ml', '1000'],
    ['ml:l', '0.001'],
  ]);
  const multiplier = common.get(`${from}:${to}`);
  return multiplier ? new Prisma.Decimal(multiplier) : null;
}

function commonUnitConversions(): ProductUnitConversionInput[] {
  return [
    { fromUnit: 'kg', toUnit: 'g', multiplier: '1000' },
    { fromUnit: 'l', toUnit: 'ml', multiplier: '1000' },
  ];
}

export function productUnitConversionRowsFromUnknown(value: unknown): ProductUnitConversionInput[] {
  return Array.isArray(value)
    ? value.filter((row): row is ProductUnitConversionInput => Boolean(row) && typeof row === 'object')
    : [];
}

function productConversions(product: ProductWithUnitConversions): ProductUnitConversionInput[] {
  return [
    ...commonUnitConversions(),
    ...productUnitConversionRowsFromUnknown(product.inventoryConversions),
    ...productUnitConversionRowsFromUnknown(product.conversionTemplate?.conversions),
  ];
}

function conversionEdges(product: ProductWithUnitConversions) {
  return productConversions(product).flatMap((row) => {
    const fromUnit = normalizeUnit(row.fromUnit, '');
    const toUnit = normalizeUnit(row.toUnit, '');
    const multiplier = decimal(row.multiplier);
    if (!fromUnit || !toUnit || !multiplier) return [];
    return [
      { fromUnit, toUnit, multiplier },
      { fromUnit: toUnit, toUnit: fromUnit, multiplier: ONE.div(multiplier) },
    ];
  });
}

function resolveConversionPath(
  product: ProductWithUnitConversions,
  fromUnit: string,
  toUnit: string,
): Prisma.Decimal | null {
  if (fromUnit === toUnit) return ONE;
  const edges = conversionEdges(product);
  const queue: Array<{ unit: string; multiplier: Prisma.Decimal }> = [
    { unit: fromUnit, multiplier: ONE },
  ];
  const visited = new Set<string>([fromUnit]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    for (const edge of edges.filter((candidate) => candidate.fromUnit === current.unit)) {
      if (visited.has(edge.toUnit)) continue;
      const nextMultiplier = current.multiplier.times(edge.multiplier);
      if (edge.toUnit === toUnit) return nextMultiplier;
      visited.add(edge.toUnit);
      queue.push({ unit: edge.toUnit, multiplier: nextMultiplier });
    }
  }

  return null;
}

export function resolveProductUnitMultiplier(
  product: ProductWithUnitConversions,
  fromUnitValue: unknown,
  toUnitValue?: unknown,
): Prisma.Decimal {
  return resolveProductUnitMultiplierOrNull(product, fromUnitValue, toUnitValue) ?? ONE;
}

export function resolveProductUnitMultiplierOrNull(
  product: ProductWithUnitConversions,
  fromUnitValue: unknown,
  toUnitValue?: unknown,
): Prisma.Decimal | null {
  const fromUnit = normalizeUnit(fromUnitValue);
  const toUnit = normalizeUnit(toUnitValue ?? product.unit ?? fromUnit);
  const directCommon = unitPairMultiplier(fromUnit, toUnit);
  if (directCommon) return directCommon;

  const pathMultiplier = resolveConversionPath(product, fromUnit, toUnit);
  if (pathMultiplier) return pathMultiplier;

  return null;
}

export function validateProductUnitConversions(
  conversions?: ProductUnitConversionInput[] | null,
): ProductUnitConversionValidationIssue[] {
  if (!conversions?.length) return [];
  const issues: ProductUnitConversionValidationIssue[] = [];
  const seen = new Set<string>();
  const sourceTargets = new Map<string, string>();

  for (const conversion of conversions) {
    const fromUnit = normalizeUnit(conversion.fromUnit, '');
    const toUnit = normalizeUnit(conversion.toUnit, '');
    const multiplier = decimal(conversion.multiplier);
    if (!fromUnit || !toUnit || !multiplier) {
      issues.push({
        code: 'invalid-row',
        fromUnit,
        toUnit,
        message: 'Conversion rows must include source unit, target unit, and a positive multiplier.',
      });
      continue;
    }
    if (fromUnit === toUnit) {
      issues.push({
        code: 'same-unit',
        fromUnit,
        toUnit,
        message: 'Conversion source and target units must be different.',
      });
      continue;
    }
    const standardMultiplier = unitPairMultiplier(fromUnit, toUnit);
    if (standardMultiplier && !multiplier.eq(standardMultiplier)) {
      issues.push({
        code: 'standard-conflict',
        fromUnit,
        toUnit,
        message: `Conversion from ${fromUnit} to ${toUnit} conflicts with the standard multiplier ${standardMultiplier.toString()}.`,
      });
    }
    const key = `${fromUnit}->${toUnit}`;
    const reverseKey = `${toUnit}->${fromUnit}`;
    if (seen.has(key) || seen.has(reverseKey)) {
      issues.push({
        code: 'duplicate',
        fromUnit,
        toUnit,
        message: 'Duplicate or reversed conversion rows are not allowed for the same unit pair.',
      });
    }
    const previousTarget = sourceTargets.get(fromUnit);
    if (previousTarget && previousTarget !== toUnit) {
      issues.push({
        code: 'ambiguous-source',
        fromUnit,
        toUnit,
        message: 'Each source unit can convert to one next unit only. Add conversion steps as a single chain.',
      });
    }
    sourceTargets.set(fromUnit, toUnit);
    seen.add(key);
  }

  const reportedCycles = new Set<string>();
  for (const startUnit of sourceTargets.keys()) {
    const path: string[] = [];
    const pathIndexes = new Map<string, number>();
    let currentUnit: string | undefined = startUnit;
    while (currentUnit && sourceTargets.has(currentUnit)) {
      const cycleStart = pathIndexes.get(currentUnit);
      if (cycleStart !== undefined) {
        const cycleUnits = path.slice(cycleStart);
        const signature = [...cycleUnits].sort().join('|');
        if (!reportedCycles.has(signature)) {
          const toUnit = sourceTargets.get(currentUnit);
          issues.push({
            code: 'cycle',
            fromUnit: currentUnit,
            toUnit,
            message: `Conversion chain contains a cycle involving ${cycleUnits.join(', ')}.`,
          });
          reportedCycles.add(signature);
        }
        break;
      }
      pathIndexes.set(currentUnit, path.length);
      path.push(currentUnit);
      currentUnit = sourceTargets.get(currentUnit);
    }
  }

  return issues;
}

export function validateProductUnitConversionSequence(input: {
  conversions?: ProductUnitConversionInput[] | null;
  baseUnit?: unknown;
}): ProductUnitConversionSequenceIssue | null {
  const baseUnit = normalizeUnit(input.baseUnit);
  const rows = productUnitConversionRowsFromUnknown(input.conversions);
  if (rows.length === 0) return null;

  let expectedFromUnit = normalizeUnit(rows[0]?.fromUnit, '');
  for (const [index, row] of rows.entries()) {
    const actualFromUnit = normalizeUnit(row.fromUnit, '');
    if (actualFromUnit !== expectedFromUnit && !hasCommonUnitPath(expectedFromUnit, actualFromUnit)) {
      return {
        code: 'disconnected',
        index,
        expectedFromUnit,
        actualFromUnit,
        message: `Conversion stage ${index + 1} must start from ${expectedFromUnit}.`,
      };
    }
    expectedFromUnit = normalizeUnit(row.toUnit, '');
  }

  if (expectedFromUnit !== baseUnit && !hasCommonUnitPath(expectedFromUnit, baseUnit)) {
    return {
      code: 'incomplete',
      index: rows.length,
      expectedFromUnit: baseUnit,
      actualFromUnit: expectedFromUnit,
      message: `Conversion chain must end at inventory unit ${baseUnit}; current end unit is ${expectedFromUnit}.`,
    };
  }
  return null;
}

function hasCommonUnitPath(fromUnit: string, toUnit: string): boolean {
  if (!fromUnit || !toUnit) return false;
  return resolveConversionPath(
    { inventoryConversions: [], conversionTemplate: null },
    normalizeUnit(fromUnit),
    normalizeUnit(toUnit),
  ) !== null;
}

export function unitConversionsJson(
  conversions?: ProductUnitConversionInput[] | null,
): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (!conversions?.length) return Prisma.DbNull;
  const rows = conversions.flatMap((conversion) => {
    const fromUnit = normalizeUnit(conversion.fromUnit, '');
    const toUnit = normalizeUnit(conversion.toUnit, '');
    const multiplier = decimal(conversion.multiplier);
    if (!fromUnit || !toUnit || !multiplier) return [];
    return [{
      fromUnit,
      toUnit,
      multiplier: multiplier.toString(),
      label: String(conversion.label ?? '').trim(),
    }];
  });
  return rows.length > 0 ? rows : Prisma.DbNull;
}
