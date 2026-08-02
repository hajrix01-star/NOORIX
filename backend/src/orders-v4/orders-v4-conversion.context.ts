import { Prisma } from '@prisma/client';
import { resolveOrdersV4Conversion } from './orders-v4-conversion.kernel';
import type {
  OrdersV4ConversionEdgeDefinition,
  OrdersV4ResolvedConversion,
  OrdersV4UnitDefinition,
} from './orders-v4-kernel.types';

type UnitRow = Readonly<{
  id: string;
  code: string;
  dimension: string;
  canonicalFactor: Prisma.Decimal | null;
}>;

type EdgeRow = Readonly<{
  id: string;
  fromUnitId: string;
  toUnitId: string;
  factor: Prisma.Decimal;
  reversible: boolean;
  allowDimensionBridge: boolean;
}>;

export type OrdersV4ConversionContext = Readonly<{
  units: readonly OrdersV4UnitDefinition[];
  edges: readonly OrdersV4ConversionEdgeDefinition[];
}>;

export function ordersV4UnitDefinitions(rows: readonly UnitRow[]): OrdersV4UnitDefinition[] {
  return rows.map((unit) => ({
    id: unit.id,
    code: unit.code,
    dimension: unit.dimension,
    canonicalFactor: unit.canonicalFactor,
  }));
}

export function ordersV4EdgeDefinitions(rows: readonly EdgeRow[] | undefined): OrdersV4ConversionEdgeDefinition[] {
  return (rows ?? []).map((edge) => ({
    id: edge.id,
    fromUnitId: edge.fromUnitId,
    toUnitId: edge.toUnitId,
    factor: edge.factor,
    reversible: edge.reversible,
    allowDimensionBridge: edge.allowDimensionBridge,
  }));
}

export function resolveOrdersV4ContextConversion(input: {
  fromUnitId: string;
  toUnitId: string;
  units: readonly UnitRow[] | readonly OrdersV4UnitDefinition[];
  edges?: readonly EdgeRow[] | readonly OrdersV4ConversionEdgeDefinition[];
}): OrdersV4ResolvedConversion {
  return resolveOrdersV4Conversion({
    fromUnitId: input.fromUnitId,
    toUnitId: input.toUnitId,
    units: ordersV4UnitDefinitions(input.units as readonly UnitRow[]),
    edges: ordersV4EdgeDefinitions(input.edges as readonly EdgeRow[] | undefined),
  });
}

export function normalizeOrdersV4ConversionEdges(edges: readonly OrdersV4ConversionEdgeDefinition[]) {
  return [...edges]
    .map((edge) => ({
      fromUnitId: edge.fromUnitId,
      toUnitId: edge.toUnitId,
      factor: edge.factor.toString(),
      reversible: edge.reversible,
      allowDimensionBridge: edge.allowDimensionBridge,
    }))
    .sort((left, right) => `${left.fromUnitId}:${left.toUnitId}`.localeCompare(`${right.fromUnitId}:${right.toUnitId}`));
}
