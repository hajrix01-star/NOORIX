import { Prisma } from '@prisma/client';

const ONE = new Prisma.Decimal(1);

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

function decimal(value: unknown): Prisma.Decimal | null {
  try {
    const parsed = new Prisma.Decimal(String(value ?? ''));
    return parsed.gt(0) ? parsed : null;
  } catch {
    return null;
  }
}

export function normalizeUnit(value: unknown, fallback = 'piece') {
  const unit = String(value ?? '').trim();
  return unit || fallback;
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

function conversionRows(value: unknown): ProductUnitConversionInput[] {
  return Array.isArray(value)
    ? value.filter((row): row is ProductUnitConversionInput => Boolean(row) && typeof row === 'object')
    : [];
}

function productConversions(product: ProductWithUnitConversions): ProductUnitConversionInput[] {
  return [
    ...conversionRows(product.inventoryConversions),
    ...conversionRows(product.conversionTemplate?.conversions),
  ];
}

export function resolveProductUnitMultiplier(
  product: ProductWithUnitConversions,
  fromUnitValue: unknown,
  toUnitValue?: unknown,
): Prisma.Decimal {
  const fromUnit = normalizeUnit(fromUnitValue);
  const toUnit = normalizeUnit(toUnitValue ?? product.unit ?? fromUnit);
  const directCommon = unitPairMultiplier(fromUnit, toUnit);
  if (directCommon) return directCommon;

  const custom = productConversions(product).find((row) =>
    normalizeUnit(row.fromUnit) === fromUnit && normalizeUnit(row.toUnit, toUnit) === toUnit,
  );
  const customMultiplier = custom ? decimal(custom.multiplier) : null;
  if (customMultiplier) return customMultiplier;

  const reverse = productConversions(product).find((row) =>
    normalizeUnit(row.fromUnit) === toUnit && normalizeUnit(row.toUnit, fromUnit) === fromUnit,
  );
  const reverseMultiplier = reverse ? decimal(reverse.multiplier) : null;
  if (reverseMultiplier) return ONE.div(reverseMultiplier);

  return ONE;
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
