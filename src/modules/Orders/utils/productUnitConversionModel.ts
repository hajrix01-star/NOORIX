import type {
  OrderProduct,
  OrderProductUnitConversion,
  OrderProductVariant,
} from '../../../types/api';

const UNIT_ALIASES = new Map<string, string>([
  ['piece', 'piece'],
  ['pc', 'piece'],
  ['pcs', 'piece'],
  ['unit', 'piece'],
  ['حبة', 'piece'],
  ['حبه', 'piece'],
  ['وحدة', 'piece'],
  ['وحده', 'piece'],
  ['g', 'g'],
  ['gram', 'g'],
  ['grams', 'g'],
  ['جرام', 'g'],
  ['غرام', 'g'],
  ['kg', 'kg'],
  ['kilogram', 'kg'],
  ['كيلو', 'kg'],
  ['كجم', 'kg'],
  ['ml', 'ml'],
  ['milliliter', 'ml'],
  ['مل', 'ml'],
  ['l', 'l'],
  ['liter', 'l'],
  ['litre', 'l'],
  ['لتر', 'l'],
  ['pack', 'pack'],
  ['packet', 'pack'],
  ['package', 'pack'],
  ['علبة', 'pack'],
  ['علبه', 'pack'],
  ['عبوة', 'pack'],
  ['عبوه', 'pack'],
  ['باكيت', 'pack'],
  ['box', 'box'],
  ['صندوق', 'box'],
  ['carton', 'carton'],
  ['كرتون', 'carton'],
  ['dozen', 'dozen'],
  ['درزن', 'dozen'],
  ['bottle', 'bottle'],
  ['قارورة', 'bottle'],
  ['قاروره', 'bottle'],
]);

const STANDARD_UNIT_PAIRS = new Map<string, number>([
  ['kg:g', 1000],
  ['g:kg', 0.001],
  ['l:ml', 1000],
  ['ml:l', 0.001],
]);

type ConversionGraphEdge = {
  unit: string;
  multiplier: number;
};

export type CatalogConversionSequenceIssue = {
  kind: 'disconnected' | 'incomplete';
  index: number;
  expectedFromUnit: string;
  actualFromUnit: string;
};

export function normalizeCatalogUnit(value: unknown, fallback = ''): string {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return fallback;
  return UNIT_ALIASES.get(normalized) ?? normalized;
}

function positiveNumber(value: unknown): number | null {
  const parsed = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function isConversionRow(value: unknown): value is OrderProductUnitConversion {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return Boolean(
    normalizeCatalogUnit(row.fromUnit)
    && normalizeCatalogUnit(row.toUnit)
    && positiveNumber(row.multiplier),
  );
}

export function conversionRowsFromUnknown(value: unknown): OrderProductUnitConversion[] {
  return Array.isArray(value) ? value.filter(isConversionRow) : [];
}

export function findCatalogConversionSequenceIssue(input: {
  conversions: OrderProductUnitConversion[];
  purchaseUnit?: unknown;
  baseUnit?: unknown;
}): CatalogConversionSequenceIssue | null {
  const conversions = input.conversions.map((row) => ({
    fromUnit: normalizeCatalogUnit(row.fromUnit),
    toUnit: normalizeCatalogUnit(row.toUnit),
  }));
  const purchaseUnit = normalizeCatalogUnit(input.purchaseUnit);
  const baseUnit = normalizeCatalogUnit(input.baseUnit, 'piece');
  const requiresConversion = Boolean(purchaseUnit && purchaseUnit !== baseUnit);

  if (conversions.length === 0) {
    return requiresConversion && !hasStandardUnitPath(purchaseUnit, baseUnit)
      ? {
        kind: 'incomplete',
        index: 0,
        expectedFromUnit: baseUnit,
        actualFromUnit: purchaseUnit,
      }
      : null;
  }

  const firstExpectedUnit = purchaseUnit && purchaseUnit !== baseUnit ? purchaseUnit : '';

  for (let index = 0; index < conversions.length; index += 1) {
    const current = conversions[index];
    const previous = conversions[index - 1];
    const expectedFromUnit = previous?.toUnit || firstExpectedUnit;
    if (
      expectedFromUnit
      && current?.fromUnit !== expectedFromUnit
      && !hasStandardUnitPath(expectedFromUnit, current?.fromUnit || '')
    ) {
      return {
        kind: 'disconnected',
        index,
        expectedFromUnit,
        actualFromUnit: current?.fromUnit || '',
      };
    }
  }

  const lastUnit = conversions.at(-1)?.toUnit || '';
  if (requiresConversion && lastUnit !== baseUnit && !hasStandardUnitPath(lastUnit, baseUnit)) {
    return {
      kind: 'incomplete',
      index: conversions.length,
      expectedFromUnit: baseUnit,
      actualFromUnit: lastUnit,
    };
  }

  return null;
}

export function productInventoryConversions(
  product: OrderProduct | null | undefined,
): OrderProductUnitConversion[] {
  const rows = [
    ...conversionRowsFromUnknown(product?.inventoryConversions),
    ...conversionRowsFromUnknown(product?.conversionTemplate?.conversions),
  ];
  const seen = new Set<string>();

  return rows.filter((row) => {
    const key = [
      normalizeCatalogUnit(row.fromUnit),
      normalizeCatalogUnit(row.toUnit),
      String(positiveNumber(row.multiplier)),
    ].join(':');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildConversionGraph(conversions: OrderProductUnitConversion[]): Map<string, ConversionGraphEdge[]> {
  const graph = new Map<string, ConversionGraphEdge[]>();

  function addEdge(fromUnit: string, toUnit: string, multiplier: number) {
    const edges = graph.get(fromUnit) ?? [];
    if (!edges.some((edge) => edge.unit === toUnit && edge.multiplier === multiplier)) {
      edges.push({ unit: toUnit, multiplier });
      graph.set(fromUnit, edges);
    }
  }

  for (const [pair, multiplier] of STANDARD_UNIT_PAIRS) {
    const [fromUnit, toUnit] = pair.split(':');
    if (fromUnit && toUnit) addEdge(fromUnit, toUnit, multiplier);
  }

  for (const conversion of conversions) {
    const fromUnit = normalizeCatalogUnit(conversion.fromUnit);
    const toUnit = normalizeCatalogUnit(conversion.toUnit);
    const multiplier = positiveNumber(conversion.multiplier);
    if (!fromUnit || !toUnit || fromUnit === toUnit || !multiplier) continue;
    addEdge(fromUnit, toUnit, multiplier);
    addEdge(toUnit, fromUnit, 1 / multiplier);
  }

  return graph;
}

export function resolveCatalogUnitMultiplier(
  conversions: OrderProductUnitConversion[],
  fromValue: unknown,
  toValue: unknown,
): number | null {
  const fromUnit = normalizeCatalogUnit(fromValue);
  const toUnit = normalizeCatalogUnit(toValue);
  if (!fromUnit || !toUnit) return null;
  if (fromUnit === toUnit) return 1;

  const graph = buildConversionGraph(conversions);
  const queue: ConversionGraphEdge[] = [{ unit: fromUnit, multiplier: 1 }];
  const visited = new Set<string>([fromUnit]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    for (const edge of graph.get(current.unit) ?? []) {
      if (visited.has(edge.unit)) continue;
      const multiplier = current.multiplier * edge.multiplier;
      if (edge.unit === toUnit) return multiplier;
      visited.add(edge.unit);
      queue.push({ unit: edge.unit, multiplier });
    }
  }

  return null;
}

function hasStandardUnitPath(fromUnit: string, toUnit: string): boolean {
  if (!fromUnit || !toUnit) return false;
  return resolveCatalogUnitMultiplier([], fromUnit, toUnit) !== null;
}

export function resolveVariantInventoryMultiplier(
  variant: OrderProductVariant,
  baseUnitValue: unknown,
  conversions: OrderProductUnitConversion[],
): number {
  const baseUnit = normalizeCatalogUnit(baseUnitValue, 'piece');
  const candidates = [variant.packaging, variant.unit]
    .map((value) => normalizeCatalogUnit(value))
    .filter((value): value is string => Boolean(value));

  for (const candidate of [...new Set(candidates)]) {
    const multiplier = resolveCatalogUnitMultiplier(conversions, candidate, baseUnit);
    if (multiplier) return multiplier;
  }

  return positiveNumber(variant.quantityMultiplier) ?? 1;
}

export function productConvertibleUnitValues(product: OrderProduct | null | undefined): string[] {
  const baseUnit = normalizeCatalogUnit(product?.unit, 'piece');
  const conversions = productInventoryConversions(product);
  const candidates = new Set<string>([baseUnit]);

  for (const conversion of conversions) {
    candidates.add(normalizeCatalogUnit(conversion.fromUnit));
    candidates.add(normalizeCatalogUnit(conversion.toUnit));
  }
  for (const pair of STANDARD_UNIT_PAIRS.keys()) {
    const [fromUnit, toUnit] = pair.split(':');
    if (fromUnit) candidates.add(fromUnit);
    if (toUnit) candidates.add(toUnit);
  }

  return [...candidates].filter((unit) => (
    Boolean(unit) && resolveCatalogUnitMultiplier(conversions, unit, baseUnit) !== null
  ));
}
