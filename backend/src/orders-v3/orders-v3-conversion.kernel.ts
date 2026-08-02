import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  OrdersV3ConversionEdgeDefinition,
  OrdersV3ResolvedConversion,
  OrdersV3UnitDefinition,
} from './orders-v3-kernel.types';

const FACTOR_SCALE = 12;
const FACTOR_TOLERANCE = new Prisma.Decimal('0.000000000001');

type TraversalEdge = Readonly<{
  edgeId: string;
  fromUnitId: string;
  toUnitId: string;
  factor: Prisma.Decimal;
  reversed: boolean;
}>;

function positiveFactor(value: Prisma.Decimal.Value, label: string): Prisma.Decimal {
  let factor: Prisma.Decimal;
  try {
    factor = new Prisma.Decimal(value);
  } catch {
    throw new BadRequestException(`${label}: معامل التحويل غير صالح`);
  }
  if (!factor.isFinite() || factor.lte(0)) {
    throw new BadRequestException(`${label}: معامل التحويل يجب أن يكون أكبر من صفر`);
  }
  return factor.toDecimalPlaces(FACTOR_SCALE);
}

function assertUniqueUnits(units: readonly OrdersV3UnitDefinition[]): Map<string, OrdersV3UnitDefinition> {
  const byId = new Map<string, OrdersV3UnitDefinition>();
  for (const unit of units) {
    if (byId.has(unit.id)) throw new BadRequestException(`الوحدة مكررة: ${unit.code}`);
    byId.set(unit.id, unit);
  }
  return byId;
}

function authoredAdjacency(edges: readonly OrdersV3ConversionEdgeDefinition[]): Map<string, string[]> {
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    adjacency.set(edge.fromUnitId, [...(adjacency.get(edge.fromUnitId) ?? []), edge.toUnitId]);
  }
  return adjacency;
}

function assertNoAuthoredCycle(edges: readonly OrdersV3ConversionEdgeDefinition[]): void {
  const adjacency = authoredAdjacency(edges);
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(unitId: string): void {
    if (visiting.has(unitId)) throw new BadRequestException('تعريف التحويل يحتوي على دورة مغلقة');
    if (visited.has(unitId)) return;
    visiting.add(unitId);
    for (const next of adjacency.get(unitId) ?? []) visit(next);
    visiting.delete(unitId);
    visited.add(unitId);
  }

  for (const unitId of adjacency.keys()) visit(unitId);
}

function buildTraversalEdges(
  unitsById: ReadonlyMap<string, OrdersV3UnitDefinition>,
  edges: readonly OrdersV3ConversionEdgeDefinition[],
): TraversalEdge[] {
  const seen = new Set<string>();
  const result: TraversalEdge[] = [];
  for (const edge of edges) {
    const from = unitsById.get(edge.fromUnitId);
    const to = unitsById.get(edge.toUnitId);
    if (!from || !to) throw new BadRequestException('تعريف التحويل يشير إلى وحدة غير موجودة');
    if (from.id === to.id) throw new BadRequestException('لا يمكن تعريف تحويل من الوحدة إلى نفسها');
    if (from.dimension !== to.dimension && !edge.allowDimensionBridge) {
      throw new BadRequestException(`التحويل ${from.code} ← ${to.code} يعبر بين أبعاد مختلفة دون سماح صريح`);
    }
    const key = `${from.id}:${to.id}`;
    if (seen.has(key)) throw new BadRequestException(`مسار تحويل مكرر: ${from.code} ← ${to.code}`);
    seen.add(key);
    const factor = positiveFactor(edge.factor, `${from.code} ← ${to.code}`);
    result.push({ edgeId: edge.id, fromUnitId: from.id, toUnitId: to.id, factor, reversed: false });
    if (edge.reversible) {
      result.push({
        edgeId: edge.id,
        fromUnitId: to.id,
        toUnitId: from.id,
        factor: new Prisma.Decimal(1).div(factor).toDecimalPlaces(FACTOR_SCALE),
        reversed: true,
      });
    }
  }
  return result;
}

function explicitSolutions(
  fromUnitId: string,
  toUnitId: string,
  traversalEdges: readonly TraversalEdge[],
  maximumDepth: number,
): Array<{ factor: Prisma.Decimal; path: TraversalEdge[] }> {
  const adjacency = new Map<string, TraversalEdge[]>();
  for (const edge of traversalEdges) {
    adjacency.set(edge.fromUnitId, [...(adjacency.get(edge.fromUnitId) ?? []), edge]);
  }
  const solutions: Array<{ factor: Prisma.Decimal; path: TraversalEdge[] }> = [];

  function visit(unitId: string, factor: Prisma.Decimal, path: TraversalEdge[], visited: Set<string>): void {
    if (path.length > maximumDepth) return;
    if (unitId === toUnitId) {
      solutions.push({ factor: factor.toDecimalPlaces(FACTOR_SCALE), path });
      return;
    }
    for (const edge of adjacency.get(unitId) ?? []) {
      if (visited.has(edge.toUnitId)) continue;
      const nextVisited = new Set(visited);
      nextVisited.add(edge.toUnitId);
      visit(edge.toUnitId, factor.times(edge.factor), [...path, edge], nextVisited);
    }
  }

  visit(fromUnitId, new Prisma.Decimal(1), [], new Set([fromUnitId]));
  return solutions;
}

export function validateOrdersV3ConversionDefinition(
  units: readonly OrdersV3UnitDefinition[],
  edges: readonly OrdersV3ConversionEdgeDefinition[],
): void {
  const unitsById = assertUniqueUnits(units);
  assertNoAuthoredCycle(edges);
  const traversal = buildTraversalEdges(unitsById, edges);
  const unitIds = [...unitsById.keys()];
  for (const from of unitIds) {
    for (const to of unitIds) {
      if (from === to) continue;
      const solutions = explicitSolutions(from, to, traversal, unitIds.length);
      if (solutions.length <= 1) continue;
      const first = solutions[0].factor;
      const conflict = solutions.some((solution) => solution.factor.minus(first).abs().gt(FACTOR_TOLERANCE));
      const fromCode = unitsById.get(from)?.code ?? from;
      const toCode = unitsById.get(to)?.code ?? to;
      throw new BadRequestException(
        conflict
          ? `مسارات تحويل متعارضة بين ${fromCode} و${toCode}`
          : `مسارات تحويل غامضة بين ${fromCode} و${toCode}`,
      );
    }
  }
}

export function resolveOrdersV3Conversion(input: {
  fromUnitId: string;
  toUnitId: string;
  units: readonly OrdersV3UnitDefinition[];
  edges: readonly OrdersV3ConversionEdgeDefinition[];
}): OrdersV3ResolvedConversion {
  const unitsById = assertUniqueUnits(input.units);
  const from = unitsById.get(input.fromUnitId);
  const to = unitsById.get(input.toUnitId);
  if (!from || !to) throw new BadRequestException('الوحدة المطلوبة غير موجودة في كتالوج V3');
  if (from.id === to.id) {
    return { fromUnitId: from.id, toUnitId: to.id, factor: new Prisma.Decimal(1), source: 'identity', path: [] };
  }

  validateOrdersV3ConversionDefinition(input.units, input.edges);
  const traversal = buildTraversalEdges(unitsById, input.edges);
  const solutions = explicitSolutions(from.id, to.id, traversal, unitsById.size);
  if (solutions.length === 1) {
    const solution = solutions[0];
    return {
      fromUnitId: from.id,
      toUnitId: to.id,
      factor: solution.factor,
      source: 'item-definition',
      path: solution.path.map((edge) => ({
        edgeId: edge.edgeId,
        fromUnitId: edge.fromUnitId,
        toUnitId: edge.toUnitId,
        factor: edge.factor.toString(),
        reversed: edge.reversed,
      })),
    };
  }

  if (from.dimension === to.dimension && from.canonicalFactor && to.canonicalFactor) {
    const fromFactor = positiveFactor(from.canonicalFactor, from.code);
    const toFactor = positiveFactor(to.canonicalFactor, to.code);
    return {
      fromUnitId: from.id,
      toUnitId: to.id,
      factor: fromFactor.div(toFactor).toDecimalPlaces(FACTOR_SCALE),
      source: 'canonical',
      path: [],
    };
  }

  throw new BadRequestException(`لا يوجد مسار تحويل منشور من ${from.code} إلى ${to.code}`);
}
