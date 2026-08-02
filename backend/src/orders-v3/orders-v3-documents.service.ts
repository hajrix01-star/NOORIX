import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { TenantContext } from '../common/tenant-context';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { calculateOrdersV3Line } from './orders-v3-calculation.kernel';
import type { OrdersV3DocumentInput, OrdersV3DocumentType } from './orders-v3.contracts';
import { resolveOrdersV3Conversion } from './orders-v3-conversion.kernel';
import type { OrdersV3ResolvedConversion, OrdersV3UnitDefinition } from './orders-v3-kernel.types';
import { OrdersV3LedgerPostingService } from './orders-v3-ledger-posting.service';

function dateOnly(value: string, label: string): Date {
  const text = String(value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new BadRequestException(`${label} غير صالح`);
  const date = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) throw new BadRequestException(`${label} غير صالح`);
  return date;
}

function rangeBounds(startDate?: string, endDate?: string): { gte?: Date; lte?: Date } {
  const bounds: { gte?: Date; lte?: Date } = {};
  if (startDate) bounds.gte = dateOnly(startDate, 'تاريخ البداية');
  if (endDate) bounds.lte = dateOnly(endDate, 'تاريخ النهاية');
  if (bounds.gte && bounds.lte && bounds.gte > bounds.lte) throw new BadRequestException('نطاق التاريخ معكوس');
  return bounds;
}

function conversionSnapshot(resolved: OrdersV3ResolvedConversion) {
  return {
    fromUnitId: resolved.fromUnitId,
    toUnitId: resolved.toUnitId,
    factor: resolved.factor.toString(),
    source: resolved.source,
    path: resolved.path,
  };
}

function toUnitDefinition(unit: {
  id: string;
  code: string;
  dimension: string;
  canonicalFactor: Prisma.Decimal | null;
}): OrdersV3UnitDefinition {
  return { id: unit.id, code: unit.code, dimension: unit.dimension, canonicalFactor: unit.canonicalFactor };
}

function documentNumber(documentType: OrdersV3DocumentType, date: Date): string {
  const datePart = date.toISOString().slice(0, 10).replaceAll('-', '');
  const prefix = documentType === 'purchase' ? 'REQ3' : 'REG3';
  return `${prefix}-${datePart}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function requestHash(value: object): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function documentRequestHash(input: OrdersV3DocumentInput): string {
  return requestHash({
    documentType: input.documentType,
    documentDate: input.documentDate,
    paymentMethod: input.paymentMethod ?? null,
    sectionId: input.sectionId ?? null,
    locationId: input.locationId,
    pettyCashAmount: input.pettyCashAmount ?? null,
    notes: input.notes?.trim() || null,
    lines: input.lines.map((line) => ({
      itemId: line.itemId,
      quantity: String(line.quantity),
      unitId: line.unitId,
      unitPrice: String(line.unitPrice ?? 0),
      priceUnitId: line.priceUnitId || line.unitId,
    })),
  });
}

@Injectable()
export class OrdersV3DocumentsService {
  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly posting: OrdersV3LedgerPostingService,
  ) {}

  async list(companyId: string, documentType?: OrdersV3DocumentType, startDate?: string, endDate?: string, createdByUserId?: string) {
    return this.prisma.ordersV3Document.findMany({
      where: {
        companyId,
        createdByUserId: createdByUserId || undefined,
        documentType: documentType || undefined,
        documentDate: rangeBounds(startDate, endDate),
      },
      include: {
        section: true,
        location: true,
        lines: { include: { item: true, inputUnit: true, priceUnit: true }, orderBy: { lineNumber: 'asc' } },
      },
      orderBy: [{ documentDate: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async create(companyId: string, input: OrdersV3DocumentInput) {
    const tenantId = TenantContext.getTenantId();
    const userId = TenantContext.getUserId();
    if (!['purchase', 'registration'].includes(input.documentType)) throw new BadRequestException('نوع مستند V3 غير صالح');
    if (!input.idempotencyKey?.trim()) throw new BadRequestException('مفتاح منع التكرار مطلوب');
    if (!input.lines?.length) throw new BadRequestException('يجب إدخال صنف واحد على الأقل');
    if (input.documentType === 'purchase' && !['external', 'internal', 'transfer'].includes(input.paymentMethod || 'internal')) {
      throw new BadRequestException('طريقة الدفع غير صالحة');
    }
    if (input.documentType === 'registration' && input.paymentMethod) throw new BadRequestException('التسجيل الداخلي لا يقبل طريقة دفع');
    const documentDate = dateOnly(input.documentDate, 'تاريخ المستند');
    const inputRequestHash = documentRequestHash(input);
    let pettyCashAmount: Prisma.Decimal | null = null;
    if (input.documentType === 'purchase' && input.paymentMethod === 'external' && input.pettyCashAmount != null && input.pettyCashAmount !== '') {
      try {
        pettyCashAmount = new Prisma.Decimal(input.pettyCashAmount);
      } catch {
        throw new BadRequestException('مبلغ العهدة غير صالح');
      }
      if (!pettyCashAmount.isFinite() || pettyCashAmount.lt(0)) throw new BadRequestException('مبلغ العهدة لا يمكن أن يكون سالباً');
    }

    return this.prisma.withTenant(async (tx) => {
      const duplicate = await tx.ordersV3Document.findFirst({
        where: { companyId, idempotencyKey: input.idempotencyKey.trim() },
        include: { section: true, location: true, lines: { include: { item: true, inputUnit: true, priceUnit: true } } },
      });
      if (duplicate) {
        if (duplicate.requestHash !== inputRequestHash) throw new BadRequestException('مفتاح منع التكرار مستخدم لمحتوى مختلف');
        return duplicate;
      }

      const location = await tx.ordersV3Location.findFirst({ where: { id: input.locationId, companyId, isActive: true } });
      if (!location) throw new BadRequestException('موقع مخزون V3 غير موجود');
      if (input.sectionId) {
        const section = await tx.ordersV3Section.findFirst({ where: { id: input.sectionId, companyId, isActive: true } });
        if (!section) throw new BadRequestException('قسم V3 غير موجود');
      }

      const itemIds = [...new Set(input.lines.map((line) => line.itemId))];
      const items = await tx.ordersV3Item.findMany({
        where: { companyId, id: { in: itemIds }, isActive: true },
        include: {
          baseUnit: true,
          conversionVersions: {
            where: { status: 'published' },
            include: { edges: true },
            orderBy: { version: 'desc' },
            take: 1,
          },
          recipeVersions: {
            where: { status: 'published' },
            include: {
              outputUnit: true,
              lines: {
                include: {
                  componentItem: {
                    include: {
                      baseUnit: true,
                      conversionVersions: {
                        where: { status: 'published' }, include: { edges: true }, orderBy: { version: 'desc' }, take: 1,
                      },
                    },
                  },
                  unit: true,
                },
                orderBy: { sortOrder: 'asc' },
              },
            },
            orderBy: { version: 'desc' },
            take: 1,
          },
        },
      });
      if (items.length !== itemIds.length) throw new BadRequestException('أحد أصناف V3 غير موجود أو غير فعال');
      const itemById = new Map(items.map((item) => [item.id, item]));
      const units = await tx.ordersV3Unit.findMany({ where: { companyId, isActive: true } });
      const unitDefinitions = units.map(toUnitDefinition);

      const prepared = input.lines.map((line, index) => {
        const item = itemById.get(line.itemId);
        if (!item) throw new BadRequestException('صنف V3 غير موجود');
        if (input.documentType === 'purchase' && item.itemType === 'sale') throw new BadRequestException(`${item.nameAr}: صنف بيع لا يقبل مستند شراء`);
        if (input.documentType === 'registration' && item.itemType === 'purchased') throw new BadRequestException(`${item.nameAr}: مادة مشتراة لا تقبل التسجيل الداخلي المباشر`);
        const definition = item.conversionVersions[0];
        const definitionEdges = definition?.edges.map((edge) => ({
          id: edge.id,
          fromUnitId: edge.fromUnitId,
          toUnitId: edge.toUnitId,
          factor: edge.factor,
          reversible: edge.reversible,
          allowDimensionBridge: edge.allowDimensionBridge,
        })) ?? [];
        const inputConversion = resolveOrdersV3Conversion({
          fromUnitId: line.unitId,
          toUnitId: item.baseUnitId,
          units: unitDefinitions,
          edges: definitionEdges,
        });
        const priceUnitId = line.priceUnitId || line.unitId;
        const priceConversion = resolveOrdersV3Conversion({
          fromUnitId: priceUnitId,
          toUnitId: item.baseUnitId,
          units: unitDefinitions,
          edges: definitionEdges,
        });
        const calculation = calculateOrdersV3Line({
          inputQuantity: line.quantity,
          unitPrice: line.unitPrice ?? 0,
          inputConversion,
          priceConversion,
        });
        const recipe = input.documentType === 'registration' ? item.recipeVersions[0] : undefined;
        return { index, item, definition, recipe, line, priceUnitId, calculation };
      });

      const subtotal = prepared.reduce((sum, row) => sum.plus(row.calculation.lineTotal), new Prisma.Decimal(0)).toDecimalPlaces(6);
      const inventoryKeys = prepared.flatMap((row) => {
        if (input.documentType === 'purchase') return row.item.trackInventory ? [{ itemId: row.item.id, locationId: location.id }] : [];
        if (row.recipe) return row.recipe.lines.filter((line) => line.componentItem.trackInventory).map((line) => ({ itemId: line.componentItem.id, locationId: location.id }));
        return row.item.trackInventory ? [{ itemId: row.item.id, locationId: location.id }] : [];
      });
      await this.posting.lockKeys(tx, companyId, inventoryKeys);
      const document = await tx.ordersV3Document.create({
        data: {
          tenantId,
          companyId,
          documentNumber: documentNumber(input.documentType, documentDate),
          documentType: input.documentType,
          paymentMethod: input.documentType === 'purchase' ? input.paymentMethod || 'internal' : null,
          documentDate,
          status: 'posted',
          sectionId: input.sectionId || null,
          locationId: location.id,
          pettyCashAmount,
          subtotal,
          totalAmount: subtotal,
          notes: input.notes?.trim() || null,
          idempotencyKey: input.idempotencyKey.trim(),
          requestHash: inputRequestHash,
          calculationVersion: 1,
          calculationSnapshot: {
            kernelVersion: 3,
            owner: 'orders-v3-calculation-kernel',
            lineCount: prepared.length,
            subtotal: subtotal.toString(),
            totalAmount: subtotal.toString(),
          },
          createdByUserId: userId,
        },
      });

      for (const row of prepared) {
        const createdLine = await tx.ordersV3DocumentLine.create({
          data: {
            tenantId,
            companyId,
            documentId: document.id,
            itemId: row.item.id,
            lineNumber: row.index + 1,
            itemNameSnapshot: row.item.nameAr,
            inputQuantity: row.calculation.inputQuantity,
            inputUnitId: row.line.unitId,
            baseQuantity: row.calculation.baseQuantity,
            unitPrice: row.calculation.unitPrice,
            priceUnitId: row.priceUnitId,
            priceQuantity: row.calculation.priceQuantity,
            lineTotal: row.calculation.lineTotal,
            conversionVersionId: row.definition?.id || null,
            recipeVersionId: row.recipe?.id || null,
            conversionSnapshot: {
              input: conversionSnapshot(row.calculation.inputConversion),
              price: conversionSnapshot(row.calculation.priceConversion),
            },
            calculationSnapshot: {
              kernelVersion: 3,
              inputQuantity: row.calculation.inputQuantity.toString(),
              baseQuantity: row.calculation.baseQuantity.toString(),
              priceQuantity: row.calculation.priceQuantity.toString(),
              unitPrice: row.calculation.unitPrice.toString(),
              lineTotal: row.calculation.lineTotal.toString(),
            },
          },
        });

        if (input.documentType === 'purchase' && row.item.trackInventory) {
          await this.posting.postReceipt(tx, {
            tenantId, companyId, itemId: row.item.id, locationId: location.id,
            documentLineId: createdLine.id, sourceId: document.id,
            sourceKey: `document:${document.id}:line:${createdLine.id}:receipt`,
            effectiveAt: documentDate, quantity: row.calculation.baseQuantity,
            totalValue: row.calculation.lineTotal,
            conversionVersionId: row.definition?.id || null,
            sourceSnapshot: { documentNumber: document.documentNumber, lineNumber: row.index + 1, kernelVersion: 3 },
          });
        }

        if (input.documentType === 'registration') {
          if (row.recipe) {
            const outputDefinitionEdges = row.definition?.edges.map((edge) => ({
              id: edge.id, fromUnitId: edge.fromUnitId, toUnitId: edge.toUnitId, factor: edge.factor,
              reversible: edge.reversible, allowDimensionBridge: edge.allowDimensionBridge,
            })) ?? [];
            const outputConversion = resolveOrdersV3Conversion({
              fromUnitId: row.recipe.outputUnitId,
              toUnitId: row.item.baseUnitId,
              units: unitDefinitions,
              edges: outputDefinitionEdges,
            });
            const recipeOutputBase = row.recipe.outputQuantity.times(outputConversion.factor);
            const batches = row.calculation.baseQuantity.div(recipeOutputBase);
            for (const component of row.recipe.lines) {
              if (!component.componentItem.trackInventory) continue;
              const componentDefinition = component.componentItem.conversionVersions[0];
              const componentEdges = componentDefinition?.edges.map((edge) => ({
                id: edge.id, fromUnitId: edge.fromUnitId, toUnitId: edge.toUnitId, factor: edge.factor,
                reversible: edge.reversible, allowDimensionBridge: edge.allowDimensionBridge,
              })) ?? [];
              const componentConversion = resolveOrdersV3Conversion({
                fromUnitId: component.unitId,
                toUnitId: component.componentItem.baseUnitId,
                units: unitDefinitions,
                edges: componentEdges,
              });
              const wasteFactor = new Prisma.Decimal(1).plus(component.wastePercent.div(100));
              const issueQuantity = component.quantity.times(componentConversion.factor).times(batches).times(wasteFactor).toDecimalPlaces(8);
              await this.posting.postIssue(tx, {
                tenantId, companyId, itemId: component.componentItem.id, locationId: location.id,
                documentLineId: createdLine.id, sourceId: document.id,
                sourceKey: `document:${document.id}:line:${createdLine.id}:recipe:${component.id}:issue`,
                effectiveAt: documentDate, quantity: issueQuantity,
                conversionVersionId: componentDefinition?.id || null,
                recipeVersionId: row.recipe.id,
                sourceSnapshot: {
                  documentNumber: document.documentNumber,
                  lineNumber: row.index + 1,
                  recipeVersion: row.recipe.version,
                  componentLineId: component.id,
                  kernelVersion: 3,
                },
              });
            }
          } else if (row.item.trackInventory) {
            await this.posting.postIssue(tx, {
              tenantId, companyId, itemId: row.item.id, locationId: location.id,
              documentLineId: createdLine.id, sourceId: document.id,
              sourceKey: `document:${document.id}:line:${createdLine.id}:issue`,
              effectiveAt: documentDate, quantity: row.calculation.baseQuantity,
              conversionVersionId: row.definition?.id || null,
              recipeVersionId: null,
              sourceSnapshot: { documentNumber: document.documentNumber, lineNumber: row.index + 1, kernelVersion: 3 },
            });
          }
        }
      }

      return tx.ordersV3Document.findUniqueOrThrow({
        where: { id: document.id },
        include: { section: true, location: true, lines: { include: { item: true, inputUnit: true, priceUnit: true }, orderBy: { lineNumber: 'asc' } } },
      });
    });
  }

  async reverse(companyId: string, id: string, idempotencyKey: string) {
    if (!idempotencyKey?.trim()) throw new BadRequestException('مفتاح منع التكرار مطلوب');
    const tenantId = TenantContext.getTenantId();
    const reversalRequestHash = requestHash({ operation: 'reverse', documentId: id });
    return this.prisma.withTenant(async (tx) => {
      const duplicate = await tx.ordersV3Document.findFirst({ where: { companyId, idempotencyKey: idempotencyKey.trim() } });
      if (duplicate) {
        if (duplicate.requestHash !== reversalRequestHash) throw new BadRequestException('مفتاح منع التكرار مستخدم لعملية مختلفة');
        return duplicate;
      }
      const original = await tx.ordersV3Document.findFirst({
        where: { id, companyId, status: 'posted' }, include: { lines: true },
      });
      if (!original) throw new NotFoundException('المستند غير موجود أو سبق عكسه');
      const originalLedger = await tx.ordersV3LedgerEntry.findMany({
        where: { companyId, sourceId: original.id }, orderBy: { sequence: 'desc' },
      });
      await this.posting.lockKeys(tx, companyId, originalLedger.map((entry) => ({ itemId: entry.itemId, locationId: entry.locationId })));
      const reversal = await tx.ordersV3Document.create({
        data: {
          tenantId, companyId,
          documentNumber: `${original.documentNumber}-R`,
          documentType: original.documentType,
          paymentMethod: original.paymentMethod,
          documentDate: new Date(), status: 'reversed', sectionId: original.sectionId,
          locationId: original.locationId, pettyCashAmount: original.pettyCashAmount?.negated() ?? null,
          subtotal: original.subtotal.negated(), totalAmount: original.totalAmount.negated(),
          notes: `عكس ${original.documentNumber}`, idempotencyKey: idempotencyKey.trim(),
          requestHash: reversalRequestHash,
          calculationVersion: 1,
          calculationSnapshot: { kernelVersion: 3, reversalOfId: original.id },
          reversalOfId: original.id, createdByUserId: TenantContext.getUserId(),
        },
      });
      for (const entry of originalLedger) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`orders-v3:ledger:${companyId}:${entry.itemId}:${entry.locationId}`}))`;
        const latest = await tx.ordersV3LedgerEntry.findFirst({
          where: { companyId, itemId: entry.itemId, locationId: entry.locationId }, orderBy: { sequence: 'desc' },
        });
        const quantityAfter = (latest?.quantityAfter ?? new Prisma.Decimal(0)).minus(entry.quantityDelta).toDecimalPlaces(8);
        const valueAfter = (latest?.valueAfter ?? new Prisma.Decimal(0)).minus(entry.valueDelta).toDecimalPlaces(6);
        if (quantityAfter.lt(0) || valueAfter.lt(0)) throw new BadRequestException('لا يمكن عكس المستند بعد استهلاك رصيده');
        const averageAfter = quantityAfter.isZero()
          ? new Prisma.Decimal(0)
          : valueAfter.div(quantityAfter).toDecimalPlaces(8);
        await tx.ordersV3LedgerEntry.create({
          data: {
            tenantId, companyId, itemId: entry.itemId, locationId: entry.locationId,
            effectiveAt: new Date(), entryType: 'reversal',
            quantityDelta: entry.quantityDelta.negated(), unitCost: entry.unitCost,
            valueDelta: entry.valueDelta.negated(), quantityAfter, valueAfter,
            averageUnitCostAfter: averageAfter, sourceType: 'document_reversal', sourceId: reversal.id,
            sourceKey: `reversal:${entry.id}`, sourceSnapshot: { kernelVersion: 3, originalEntryId: entry.id },
            conversionVersionId: entry.conversionVersionId, recipeVersionId: entry.recipeVersionId,
            reversalOfId: entry.id, createdByUserId: TenantContext.getUserId(),
          },
        });
      }
      await tx.ordersV3Document.update({ where: { id: original.id }, data: { status: 'reversed' } });
      return reversal;
    });
  }

}
