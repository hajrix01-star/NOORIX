import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { OrdersV4ItemDefinitionInput } from './orders-v4.contracts';
import type { OrdersV4UnitDefinition } from './orders-v4-kernel.types';

export type OrdersV4NormalizedItemDefinition = {
  inventoryUnitId: string;
  unitIds: string[];
  edges: Array<{
    fromUnitId: string;
    toUnitId: string;
    factor: string;
    reversible: boolean;
    allowDimensionBridge: boolean;
  }>;
  units: OrdersV4ItemDefinitionInput['units'];
};

function normalizedFactor(value: string, index: number): string {
  let factor: Prisma.Decimal;
  try {
    factor = new Prisma.Decimal(value);
  } catch {
    throw new BadRequestException(`معامل التحويل رقم ${index + 1} غير صالح`);
  }
  if (!factor.isFinite() || factor.lte(0)) {
    throw new BadRequestException(`معامل التحويل رقم ${index + 1} يجب أن يكون أكبر من صفر`);
  }
  return factor.toDecimalPlaces(12).toString();
}

function dimensionBridgeAllowed(from: OrdersV4UnitDefinition, to: OrdersV4UnitDefinition): boolean {
  return from.dimension === to.dimension || from.dimension === 'package' || to.dimension === 'package';
}

export function normalizeOrdersV4ItemDefinition(
  definitions: readonly OrdersV4UnitDefinition[],
  input: OrdersV4ItemDefinitionInput,
): OrdersV4NormalizedItemDefinition {
  const byId = new Map(definitions.map((unit) => [unit.id, unit]));
  const inventoryUnit = byId.get(input.inventoryUnitId);
  if (!inventoryUnit) throw new BadRequestException('وحدة أساس المخزون غير موجودة أو معطلة');

  const edges = (input.edges ?? []).map((edge, index) => {
    const from = byId.get(edge.fromUnitId);
    const to = byId.get(edge.toUnitId);
    if (!from || !to) throw new BadRequestException(`السطر رقم ${index + 1} يحتوي على وحدة غير موجودة أو معطلة`);
    if (from.id === to.id) throw new BadRequestException(`السطر رقم ${index + 1}: لا يمكن التحويل إلى الوحدة نفسها`);
    if (index > 0 && input.edges[index - 1].toUnitId !== edge.fromUnitId) {
      throw new BadRequestException(`السطر رقم ${index + 1} غير متصل بنهاية السطر السابق`);
    }
    if (!dimensionBridgeAllowed(from, to)) {
      throw new BadRequestException(`لا يمكن ربط ${from.code} مع ${to.code} دون وحدة تغليف وسيطة`);
    }
    return {
      fromUnitId: from.id,
      toUnitId: to.id,
      factor: normalizedFactor(edge.factor, index),
      reversible: edge.reversible !== false,
      allowDimensionBridge: from.dimension !== to.dimension,
    };
  });

  const orderedUnitIds = edges.length
    ? [edges[0].fromUnitId, ...edges.map((edge) => edge.toUnitId)]
    : [inventoryUnit.id];
  if (new Set(orderedUnitIds).size !== orderedUnitIds.length) {
    throw new BadRequestException('سلسلة التحويل تحتوي على وحدة مكررة أو دورة مغلقة');
  }
  if (!orderedUnitIds.includes(inventoryUnit.id)) {
    throw new BadRequestException('وحدة أساس المخزون يجب أن تكون إحدى وحدات السلسلة');
  }

  const requestedUnits = input.units ?? [];
  if (new Set(requestedUnits.map((row) => row.unitId)).size !== requestedUnits.length) {
    throw new BadRequestException('لا يمكن تكرار تغليف السعر');
  }
  if (requestedUnits.some((row) => !orderedUnitIds.includes(row.unitId))) {
    throw new BadRequestException('تغليف السعر يجب أن يكون من سلسلة وحدات الصنف');
  }

  return {
    inventoryUnitId: inventoryUnit.id,
    unitIds: orderedUnitIds,
    edges,
    units: requestedUnits,
  };
}
