const QUANTITY_MULTIPLIER = /\bquantityMultiplier\b/;

function declarationBody(source, typeName) {
  const declaration = new RegExp(`(?:type|interface|class)\\s+${typeName}\\b`).exec(source);
  if (!declaration || declaration.index == null) return '';

  const declarationEnd = declaration.index + declaration[0].length;
  const openBrace = source.indexOf('{', declarationEnd);
  const terminator = source.indexOf(';', declarationEnd);
  if (openBrace < 0 || (terminator >= 0 && terminator < openBrace)) return '';
  let depth = 0;
  for (let index = openBrace; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(openBrace + 1, index);
  }
  return source.slice(openBrace + 1);
}

function countMatches(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

export function operationalQuantityMultiplierFailures(file, source) {
  const failures = [];
  const normalizedFile = file.replaceAll('\\', '/');
  const isSpec = /\.(?:spec|test)\.[cm]?[jt]sx?$/.test(normalizedFile);
  const forbidsMultiplierEntirely = !isSpec && (
    normalizedFile.startsWith('backend/src/orders/dto/')
    || normalizedFile === 'backend/src/orders/orders.controller.ts'
    || normalizedFile === 'backend/src/orders/orders-staff.types.ts'
    || normalizedFile === 'src/services/domains/apiEndpoints/orders.ts'
    || normalizedFile === 'src/hooks/useOrders.ts'
    || normalizedFile.startsWith('src/hooks/orders/')
  );

  if (forbidsMultiplierEntirely && QUANTITY_MULTIPLIER.test(source)) {
    failures.push('quantityMultiplier is historical persistence data and must not enter an operational DTO/write boundary');
  }

  if (normalizedFile === 'backend/src/orders/orders-catalog-product.types.ts') {
    const operationalVariant = declarationBody(source, 'ProductVariantInput');
    if (!operationalVariant) {
      failures.push('missing ProductVariantInput operational catalog contract');
    } else if (QUANTITY_MULTIPLIER.test(operationalVariant)) {
      failures.push('ProductVariantInput must not accept the historical quantityMultiplier field');
    }

    const persistedVariant = declarationBody(source, 'PersistedProductVariantInput');
    if (source.includes('PersistedProductVariantInput') && (
      !persistedVariant
      || !/ProductVariantInput\s*&/.test(source)
      || !QUANTITY_MULTIPLIER.test(persistedVariant)
    )) {
      failures.push('PersistedProductVariantInput must isolate historical quantityMultiplier compatibility from ProductVariantInput');
    }
  }

  if (normalizedFile === 'backend/src/orders/orders.service.ts'
    && /variants\?\s*:\s*Array<\{[^}]*\bquantityMultiplier\b/s.test(source)) {
    failures.push('orders service catalog write signatures must use ProductVariantInput without quantityMultiplier');
  }

  if (normalizedFile === 'src/types/api/domains/orders.ts') {
    const payloadNames = [...source.matchAll(/(?:type|interface)\s+(\w*Payload)\b/g)]
      .map((match) => match[1]);
    for (const payloadName of payloadNames) {
      if (QUANTITY_MULTIPLIER.test(declarationBody(source, payloadName))) {
        failures.push(`${payloadName} must not expose quantityMultiplier on a write payload`);
      }
    }
  }

  return failures;
}

export function ordersV2SnapshotConventionFailures(sources) {
  const failures = [];
  const schema = sources.schema ?? '';
  const ordersService = sources.ordersService ?? '';
  const consumptionSnapshot = sources.consumptionSnapshot ?? '';
  const snapshotSql = sources.snapshotSql ?? '';

  if (schema.includes('inventoryBaseQuantitySnapshot')) {
    if (!/inventoryBaseQuantitySnapshot\s+Decimal\?\s+@map\("inventory_base_quantity_snapshot"\)\s+@db\.Decimal\(18,\s*6\)/.test(schema)) {
      failures.push('inventoryBaseQuantitySnapshot must keep its nullable Decimal(18, 6) mapped schema convention');
    }
    if (!/inventoryBaseQuantitySnapshot:\s*item\.quantity\.times\(quantityMultiplier\)\.toDecimalPlaces\(6\)/.test(ordersService)) {
      failures.push('new order writes must capture inventoryBaseQuantitySnapshot at six decimal places');
    }
    if (countMatches(ordersService, /inventoryBaseQuantitySnapshot:\s*i\.inventoryBaseQuantitySnapshot/g) < 2) {
      failures.push('create and update order writes must persist inventoryBaseQuantitySnapshot');
    }
    if (countMatches(ordersService, /quantityMultiplier:\s*i\.quantityMultiplier/g) < 2) {
      failures.push('create and update order writes must persist the resolved historical multiplier beside the V2 snapshot');
    }
  }

  if (schema.includes('inventoryConsumptionSnapshot')) {
    if (!/inventoryConsumptionSnapshot\s+Json\?\s+@map\("inventory_consumption_snapshot"\)/.test(schema)) {
      failures.push('inventoryConsumptionSnapshot must keep its nullable mapped Json schema convention');
    }
    for (const required of [
      'export type InventoryConsumptionSnapshotV1',
      'version: 1;',
      "row.version !== 1",
      'inventoryConsumptionSnapshotJson',
    ]) {
      if (!consumptionSnapshot.includes(required)) {
        failures.push(`inventory consumption snapshots must keep the versioned parser/serializer convention: ${required}`);
      }
    }
    if (!snapshotSql.includes("->>'version' IS DISTINCT FROM '1'")) {
      failures.push('inventory snapshot SQL validation must enforce the same stored snapshot version as the parser');
    }
  }

  return failures;
}
