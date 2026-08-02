import type {
  OrderProduct,
  OrderProductUnitConversion,
  OrderProductVariant,
} from '../../../types/api';

export type ProductPricedUnitChoice = {
  key: string;
  size: string;
  packaging: string;
  unit: string;
  unitPrice: string;
  inventoryMultiplier: number;
};

export type ProductUnitSelectionModel = {
  baseUnit: string;
  conversions: OrderProductUnitConversion[];
  convertibleUnits: string[];
  pricedChoices: ProductPricedUnitChoice[];
};

type ProductConversionSource = Pick<
  OrderProduct,
  'inventoryConversions' | 'conversionTemplate'
>;

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
    return requiresConversion
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
  if (lastUnit !== baseUnit) {
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
  product: ProductConversionSource | null | undefined,
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

export function catalogConversionUnitValues(
  baseUnitValue: unknown,
  conversions: OrderProductUnitConversion[],
): string[] {
  const baseUnit = normalizeCatalogUnit(baseUnitValue, 'piece');
  const candidates = new Set<string>([baseUnit]);
  for (const conversion of conversions) {
    const fromUnit = normalizeCatalogUnit(conversion.fromUnit);
    const toUnit = normalizeCatalogUnit(conversion.toUnit);
    if (fromUnit) candidates.add(fromUnit);
    if (toUnit) candidates.add(toUnit);
  }

  return [...candidates].filter((unit) => (
    Boolean(unit) && resolveCatalogUnitMultiplier(conversions, unit, baseUnit) !== null
  ));
}

/** Legacy read compatibility only. New catalog price payloads must not persist this fallback. */
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
  return catalogConversionUnitValues(baseUnit, conversions);
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanMoneyText(value: unknown): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '';
  }
  return cleanText(value);
}

function choiceKey(choice: Omit<ProductPricedUnitChoice, 'key'>): string {
  return [choice.size, choice.packaging, choice.unit]
    .map((value) => value.trim().toLocaleLowerCase())
    .join('|');
}

/**
 * Canonical selection contract for new orders, recipes and inventory posting.
 * Explicit conversion rows are the only conversion source. Legacy size strings
 * and quantityMultiplier remain readable elsewhere for historical records only.
 */
export function buildProductUnitSelectionModel(
  product: Pick<
    OrderProduct,
    'unit' | 'inventoryConversions' | 'conversionTemplate' | 'variants' | 'lastPrice'
  > | null | undefined,
): ProductUnitSelectionModel {
  const baseUnit = normalizeCatalogUnit(product?.unit, 'piece');
  const conversions = productInventoryConversions(product);
  const convertibleUnits = catalogConversionUnitValues(baseUnit, conversions);
  const connectedUnits = new Set(convertibleUnits);
  const pricedChoices: ProductPricedUnitChoice[] = [];
  const seen = new Set<string>();

  for (const variant of Array.isArray(product?.variants) ? product.variants : []) {
    const unitPrice = cleanMoneyText(variant?.lastPrice);
    const numericPrice = Number(unitPrice);
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) continue;

    const unit = normalizeCatalogUnit(variant?.unit, baseUnit);
    if (!connectedUnits.has(unit)) continue;

    const inventoryMultiplier = resolveCatalogUnitMultiplier(
      conversions,
      unit,
      baseUnit,
    );
    if (inventoryMultiplier === null || inventoryMultiplier <= 0) continue;

    const choiceWithoutKey = {
      size: cleanText(variant?.size),
      packaging: cleanText(variant?.packaging),
      unit,
      unitPrice,
      inventoryMultiplier,
    };
    const key = choiceKey(choiceWithoutKey);
    if (seen.has(key)) continue;
    seen.add(key);
    pricedChoices.push({ key, ...choiceWithoutKey });
  }

  const fallbackPrice = cleanMoneyText(product?.lastPrice);
  const fallbackNumericPrice = Number(fallbackPrice);
  if (
    pricedChoices.length === 0 &&
    Number.isFinite(fallbackNumericPrice) &&
    fallbackNumericPrice > 0
  ) {
    const fallback = {
      size: '',
      packaging: '',
      unit: baseUnit,
      unitPrice: fallbackPrice,
      inventoryMultiplier: 1,
    };
    pricedChoices.push({ key: choiceKey(fallback), ...fallback });
  }

  return {
    baseUnit,
    conversions,
    convertibleUnits,
    pricedChoices,
  };
}
