import type { OrdersV4ConversionVersion, OrdersV4Item, OrdersV4Unit } from '../../../types/api';

export type OrdersV4DefinitionRow = {
  key: string;
  fromUnitId: string;
  toUnitId: string;
  factor: string;
};

export function ordersV4DefinitionUnitIds(rows: OrdersV4DefinitionRow[], fallbackUnitId = ''): string[] {
  const firstFrom = rows.find((row) => row.fromUnitId)?.fromUnitId || fallbackUnitId;
  if (!firstFrom) return [];
  const result = [firstFrom];
  for (const row of rows) {
    if (!row.toUnitId) continue;
    if (!result.includes(row.toUnitId)) result.push(row.toUnitId);
  }
  return result;
}

export function ordersV4OrderDefinitionRows(rows: OrdersV4DefinitionRow[]): OrdersV4DefinitionRow[] {
  if (rows.length < 2) return rows;
  const targets = new Set(rows.map((row) => row.toUnitId));
  const first = rows.find((row) => !targets.has(row.fromUnitId));
  if (!first) return rows;
  const ordered = [first];
  const used = new Set([first.key]);
  while (ordered.length < rows.length) {
    const next = rows.find((row) => !used.has(row.key) && row.fromUnitId === ordered.at(-1)?.toUnitId);
    if (!next) return rows;
    ordered.push(next);
    used.add(next.key);
  }
  return ordered;
}

export function ordersV4NextDefinitionRow(rows: OrdersV4DefinitionRow[]): OrdersV4DefinitionRow {
  const last = rows.at(-1);
  return {
    key: crypto.randomUUID(),
    fromUnitId: last?.toUnitId || last?.fromUnitId || '',
    toUnitId: '',
    factor: '1',
  };
}

export function ordersV4CompatibleTargets(
  units: OrdersV4Unit[],
  rows: OrdersV4DefinitionRow[],
  rowIndex: number,
): OrdersV4Unit[] {
  const row = rows[rowIndex];
  const from = units.find((unit) => unit.id === row?.fromUnitId);
  if (!from) return [];
  const usedBefore = new Set(rows.slice(0, rowIndex + 1).flatMap((entry) => [entry.fromUnitId, entry.toUnitId]).filter(Boolean));
  return units.filter((unit) => unit.isActive
    && unit.id !== from.id
    && (!usedBefore.has(unit.id) || unit.id === row.toUnitId)
    && (unit.dimension === from.dimension || unit.dimension === 'package' || from.dimension === 'package'));
}

export function ordersV4CompleteDefinitionRows(rows: OrdersV4DefinitionRow[]) {
  return rows.filter((row) => row.fromUnitId && row.toUnitId && Number(row.factor) > 0);
}

export function ordersV4UnitFactorToBase(
  unitId: string,
  baseUnitId: string,
  conversion: OrdersV4ConversionVersion | undefined,
): number | null {
  if (unitId === baseUnitId) return 1;
  const adjacency = new Map<string, Array<{ to: string; factor: number }>>();
  for (const edge of conversion?.edges ?? []) {
    const factor = Number(edge.factor);
    if (!Number.isFinite(factor) || factor <= 0) continue;
    adjacency.set(edge.fromUnitId, [...(adjacency.get(edge.fromUnitId) ?? []), { to: edge.toUnitId, factor }]);
    if (edge.reversible) adjacency.set(edge.toUnitId, [...(adjacency.get(edge.toUnitId) ?? []), { to: edge.fromUnitId, factor: 1 / factor }]);
  }
  const queue: Array<{ id: string; factor: number; visited: Set<string> }> = [{ id: unitId, factor: 1, visited: new Set([unitId]) }];
  while (queue.length) {
    const current = queue.shift();
    if (!current) break;
    for (const edge of adjacency.get(current.id) ?? []) {
      if (current.visited.has(edge.to)) continue;
      const factor = current.factor * edge.factor;
      if (edge.to === baseUnitId) return factor;
      queue.push({ id: edge.to, factor, visited: new Set([...current.visited, edge.to]) });
    }
  }
  return null;
}

export function ordersV4CompositeQuantity(
  quantity: string | number,
  item: OrdersV4Item | undefined,
  conversion: OrdersV4ConversionVersion | undefined,
): { primary: string; base: string } | null {
  const numeric = Number(quantity);
  if (!item || !Number.isFinite(numeric)) return null;
  const sign = numeric < 0 ? '-' : '';
  let remaining = Math.abs(numeric);
  const candidates = item.units
    .filter((row) => row.isActive)
    .map((row) => ({ unit: row.unit, factor: ordersV4UnitFactorToBase(row.unitId, item.inventoryUnitId, conversion) }))
    .filter((row): row is { unit: OrdersV4Unit; factor: number } => row.factor != null && row.factor >= 1)
    .sort((left, right) => right.factor - left.factor);
  if (!candidates.some((row) => row.unit.id === item.inventoryUnitId)) {
    candidates.push({ unit: item.inventoryUnit, factor: 1 });
  }
  const parts: string[] = [];
  for (const candidate of candidates) {
    if (candidate.factor === 1) continue;
    const count = Math.floor((remaining + 1e-9) / candidate.factor);
    if (count <= 0) continue;
    parts.push(`${count.toLocaleString('en-US')} ${candidate.unit.nameAr}`);
    remaining -= count * candidate.factor;
  }
  if (remaining > 1e-8 || !parts.length) {
    const precision = item.inventoryUnit.decimalScale ?? 6;
    const rounded = Number(remaining.toFixed(precision));
    parts.push(`${rounded.toLocaleString('en-US', { maximumFractionDigits: precision })} ${item.inventoryUnit.nameAr}`);
  }
  return {
    primary: `${sign}${parts.join(' + ')}`,
    base: `${numeric.toLocaleString('en-US', { maximumFractionDigits: item.inventoryUnit.decimalScale ?? 6 })} ${item.inventoryUnit.nameAr}`,
  };
}
