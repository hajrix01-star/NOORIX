import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContext } from '../common/tenant-context';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import type { OrdersV4ItemDefinitionInput } from './orders-v4.contracts';
import {
  normalizeOrdersV4ConversionEdges,
  ordersV4EdgeDefinitions,
  ordersV4UnitDefinitions,
  resolveOrdersV4ContextConversion,
} from './orders-v4-conversion.context';
import { validateOrdersV4ConversionDefinition } from './orders-v4-conversion.kernel';
import { normalizeOrdersV4ItemDefinition } from './orders-v4-item-definition.kernel';
import type { OrdersV4ConversionEdgeDefinition } from './orders-v4-kernel.types';
import { decideOrdersV4VersionPublication, ordersV4DefinitionsEqual, ordersV4StableHash } from './orders-v4-version.kernel';

function optionalPositiveDecimal(value: string | null | undefined, label: string): Prisma.Decimal | null {
  if (value == null || value === '') return null;
  let parsed: Prisma.Decimal;
  try {
    parsed = new Prisma.Decimal(value);
  } catch {
    throw new BadRequestException(`${label} غير صالح`);
  }
  if (!parsed.isFinite() || parsed.lte(0)) throw new BadRequestException(`${label} يجب أن يكون أكبر من صفر`);
  return parsed;
}

@Injectable()
export class OrdersV4ItemDefinitionService {
  constructor(private readonly prisma: TenantPrismaService) {}

  async save(companyId: string, itemId: string, input: OrdersV4ItemDefinitionInput) {
    const tenantId = TenantContext.getTenantId();
    return this.prisma.withTenant(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`orders-v4:item-definition:${itemId}`}))`;
      const item = await tx.ordersV4Item.findFirst({
        where: { id: itemId, companyId, isActive: true },
        include: {
          units: true,
          conversionVersions: {
            where: { status: 'published' }, orderBy: { version: 'desc' }, take: 1,
            include: { edges: { orderBy: { sortOrder: 'asc' } } },
          },
        },
      });
      if (!item) throw new NotFoundException('صنف V4 غير موجود');

      const companyUnits = await tx.ordersV4Unit.findMany({ where: { companyId, isActive: true } });
      const unitDefinitions = ordersV4UnitDefinitions(companyUnits);
      const definition = normalizeOrdersV4ItemDefinition(unitDefinitions, input);
      if (!definition.unitIds.includes(item.kernelUnitId)) {
        throw new BadRequestException('لا يمكن إزالة وحدة النواة الثابتة من سلسلة تحويلات الصنف');
      }
      const definitionUnitIds = [...definition.unitIds].sort();
      for (const unitId of definitionUnitIds) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`orders-v4:unit:${unitId}`}))`;
      }

      const candidateEdges: OrdersV4ConversionEdgeDefinition[] = definition.edges.map((edge, index) => ({
        id: `candidate-${index + 1}`,
        ...edge,
        factor: new Prisma.Decimal(edge.factor),
      }));
      validateOrdersV4ConversionDefinition(unitDefinitions, candidateEdges);
      for (const unitId of definition.unitIds) {
        resolveOrdersV4ContextConversion({
          fromUnitId: unitId,
          toUnitId: item.kernelUnitId,
          units: unitDefinitions,
          edges: candidateEdges,
        });
      }

      const preparedDocumentUnits = await tx.ordersV4DocumentLine.findMany({
        where: { companyId, itemId, document: { status: 'prepared' } },
        select: { inputUnitId: true, priceUnitId: true },
      });
      const publishedRecipeInputUnits = await tx.ordersV4RecipeLine.findMany({
        where: { companyId, componentItemId: itemId, recipeVersion: { status: 'published' } },
        select: { unitId: true },
      });
      const publishedRecipeOutputUnits = await tx.ordersV4RecipeVersion.findMany({
        where: { companyId, outputItemId: itemId, status: 'published' },
        select: { outputUnitId: true },
      });
      const operationalUnitIds = new Set([
        ...preparedDocumentUnits.flatMap((row) => [row.inputUnitId, row.priceUnitId]),
        ...publishedRecipeInputUnits.map((row) => row.unitId),
        ...publishedRecipeOutputUnits.map((row) => row.outputUnitId),
      ]);
      if ([...operationalUnitIds].some((unitId) => !definition.unitIds.includes(unitId))) {
        throw new BadRequestException('لا يمكن إزالة وحدة مستخدمة في طلب مفتوح أو رسبي منشور قبل تحديثه');
      }

      const normalizedEdges = normalizeOrdersV4ConversionEdges(candidateEdges);
      const currentVersion = item.conversionVersions[0];
      const currentEdges = normalizeOrdersV4ConversionEdges(ordersV4EdgeDefinitions(currentVersion?.edges));
      const currentDefinition = currentVersion
        ? { kernelUnitId: item.kernelUnitId, edges: currentEdges }
        : null;
      const candidateDefinition = { kernelUnitId: item.kernelUnitId, edges: normalizedEdges };

      let publishedVersion = currentVersion;
      if (!currentVersion || !ordersV4DefinitionsEqual(currentDefinition, candidateDefinition)) {
        const latest = await tx.ordersV4ConversionVersion.aggregate({ where: { itemId }, _max: { version: true } });
        const nextVersion = (latest._max.version ?? 0) + 1;
        const contentHash = ordersV4StableHash({ itemId, ...candidateDefinition });
        const hashCollision = await tx.ordersV4ConversionVersion.findFirst({ where: { itemId, contentHash } });
        const publication = decideOrdersV4VersionPublication({
          currentDefinition,
          candidateDefinition,
          semanticHash: contentHash,
          hashAlreadyExists: !!hashCollision,
          predecessorVersionId: currentVersion?.id ?? null,
          nextVersion,
        });
        await tx.ordersV4ConversionVersion.updateMany({
          where: { itemId, status: 'published' }, data: { status: 'retired', retiredAt: new Date() },
        });
        publishedVersion = await tx.ordersV4ConversionVersion.create({
          data: {
            tenantId,
            companyId,
            itemId,
            version: nextVersion,
            status: 'published',
            contentHash: publication.contentHash,
            publishedAt: new Date(),
            createdByUserId: TenantContext.getUserId(),
            edges: definition.edges.length ? {
              create: definition.edges.map((edge, index) => ({
                tenantId, companyId, ...edge, factor: new Prisma.Decimal(edge.factor), sortOrder: index,
              })),
            } : undefined,
          },
          include: { edges: { orderBy: { sortOrder: 'asc' } } },
        });
      }
      if (!publishedVersion) throw new BadRequestException('تعذر نشر تعريف وحدات الصنف');

      const requestedByUnit = new Map(definition.units.map((row) => [row.unitId, row]));
      await tx.ordersV4ItemUnit.updateMany({
        where: { companyId, itemId }, data: { isActive: false, isOrderEnabled: false },
      });
      for (const [sortOrder, unitId] of definition.unitIds.entries()) {
        const requested = requestedByUnit.get(unitId);
        const lastPrice = optionalPositiveDecimal(requested?.lastPrice, `سعر ${sortOrder + 1}`);
        await tx.ordersV4ItemUnit.upsert({
          where: { itemId_unitId: { itemId, unitId } },
          create: {
            tenantId,
            companyId,
            itemId,
            unitId,
            purchaseLabel: requested?.purchaseLabel?.trim() || null,
            isOrderEnabled: requested?.isOrderEnabled === true && lastPrice != null,
            lastPrice,
            isActive: true,
            sortOrder,
          },
          update: {
            purchaseLabel: requested?.purchaseLabel?.trim() || null,
            isOrderEnabled: requested?.isOrderEnabled === true && lastPrice != null,
            lastPrice,
            isActive: true,
            sortOrder,
          },
        });
      }
      await tx.ordersV4Item.update({
        where: { id: itemId }, data: { inventoryUnitId: definition.inventoryUnitId },
      });

      const savedItem = await tx.ordersV4Item.findUniqueOrThrow({
        where: { id: itemId },
        include: {
          inventoryUnit: true,
          category: true,
          units: { where: { isActive: true }, include: { unit: true }, orderBy: { sortOrder: 'asc' } },
          sections: { include: { section: true } },
        },
      });
      return { item: savedItem, conversionVersionId: publishedVersion.id };
    });
  }
}
