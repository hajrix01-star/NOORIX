import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { TenantContext } from '../common/tenant-context';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import {
  calculateOrdersV4AverageUnitCost,
  calculateOrdersV4ConvertedUnitPrice,
  calculateOrdersV4InventoryUnitPrice,
  calculateOrdersV4LastFiveAverage,
  calculateOrdersV4Line,
  calculateOrdersV4RecipeComponentCost,
  calculateOrdersV4RecipeUsage,
} from './orders-v4-calculation.kernel';
import type { OrdersV4DocumentInput, OrdersV4DocumentType, OrdersV4ReceiveInput } from './orders-v4.contracts';
import {
  ordersV4EdgeDefinitions,
  ordersV4UnitDefinitions,
  resolveOrdersV4ContextConversion,
} from './orders-v4-conversion.context';
import { ordersV4DateOnly, ordersV4RangeBounds } from './orders-v4-date.util';
import type { OrdersV4ResolvedConversion } from './orders-v4-kernel.types';
import { OrdersV4LedgerPostingService } from './orders-v4-ledger-posting.service';
import { calculateOrdersV4CashAvailable } from './orders-v4-funds.kernel';
import { OrdersV4FundsPostingService } from './orders-v4-funds-posting.service';
import { loadOrdersV4UserIdentities, ordersV4UserIdentity } from './orders-v4-user-identity.util';

function conversionSnapshot(resolved: OrdersV4ResolvedConversion) {
  return {
    fromUnitId: resolved.fromUnitId,
    toUnitId: resolved.toUnitId,
    factor: resolved.factor.toString(),
    source: resolved.source,
    path: resolved.path,
  };
}

function documentNumber(documentType: OrdersV4DocumentType, date: Date): string {
  const datePart = date.toISOString().slice(0, 10).replaceAll('-', '');
  const prefix = documentType === 'purchase' ? 'REQ4' : 'REG4';
  return `${prefix}-${datePart}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function requestHash(value: object): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function documentRequestHash(input: OrdersV4DocumentInput): string {
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
export class OrdersV4DocumentsService {
  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly posting: OrdersV4LedgerPostingService,
    private readonly fundsPosting: OrdersV4FundsPostingService,
  ) {}

  async list(companyId: string, documentType?: OrdersV4DocumentType, startDate?: string, endDate?: string, createdByUserId?: string) {
    const documents = await this.prisma.ordersV4Document.findMany({
      where: {
        companyId,
        createdByUserId: createdByUserId || undefined,
        documentType: documentType || undefined,
        reversalOfId: null,
        documentDate: ordersV4RangeBounds(startDate, endDate),
      },
      include: {
        section: true,
        location: true,
        lines: { include: { item: true, inputUnit: true, baseUnit: true, priceUnit: true }, orderBy: { lineNumber: 'asc' } },
      },
      orderBy: [{ documentDate: 'desc' }, { createdAt: 'desc' }],
    });
    const identities = await loadOrdersV4UserIdentities(this.prisma, documents.map((document) => document.createdByUserId));
    return documents.map((document) => ({
      ...document,
      createdByUser: ordersV4UserIdentity(identities, document.createdByUserId),
    }));
  }

  async create(companyId: string, input: OrdersV4DocumentInput) {
    const tenantId = TenantContext.getTenantId();
    const userId = TenantContext.getUserId();
    if (!['purchase', 'registration'].includes(input.documentType)) throw new BadRequestException('نوع مستند V4 غير صالح');
    if (!input.idempotencyKey?.trim()) throw new BadRequestException('مفتاح منع التكرار مطلوب');
    if (!input.lines?.length) throw new BadRequestException('يجب إدخال صنف واحد على الأقل');
    if (new Set(input.lines.map((line) => line.itemId)).size !== input.lines.length) {
      throw new BadRequestException('لا يمكن تكرار الصنف نفسه في المستند؛ عدّل الكمية في السطر الموجود');
    }
    if (input.documentType === 'purchase' && !['custody', 'cash', 'transfer'].includes(input.paymentMethod || 'custody')) {
      throw new BadRequestException('طريقة الدفع غير صالحة');
    }
    if (input.documentType === 'registration' && input.paymentMethod) throw new BadRequestException('التسجيل الداخلي لا يقبل طريقة دفع');
    const documentDate = ordersV4DateOnly(input.documentDate, 'تاريخ المستند');
    const inputRequestHash = documentRequestHash(input);
    let pettyCashAmount: Prisma.Decimal | null = null;
    if (input.documentType === 'purchase' && input.paymentMethod === 'custody' && input.pettyCashAmount != null && input.pettyCashAmount !== '') {
      try {
        pettyCashAmount = new Prisma.Decimal(input.pettyCashAmount);
      } catch {
        throw new BadRequestException('مبلغ العهدة غير صالح');
      }
      if (!pettyCashAmount.isFinite() || pettyCashAmount.lt(0)) throw new BadRequestException('مبلغ العهدة لا يمكن أن يكون سالباً');
    }

    return this.prisma.withTenant(async (tx) => {
      const duplicate = await tx.ordersV4Document.findFirst({
        where: { companyId, idempotencyKey: input.idempotencyKey.trim() },
        include: { section: true, location: true, lines: { include: { item: true, inputUnit: true, baseUnit: true, priceUnit: true } } },
      });
      if (duplicate) {
        if (duplicate.requestHash !== inputRequestHash) throw new BadRequestException('مفتاح منع التكرار مستخدم لمحتوى مختلف');
        return duplicate;
      }

      const location = await tx.ordersV4Location.findFirst({ where: { id: input.locationId, companyId, isActive: true } });
      if (!location) throw new BadRequestException('موقع مخزون V4 غير موجود');
      if (input.sectionId) {
        const section = await tx.ordersV4Section.findFirst({ where: { id: input.sectionId, companyId, isActive: true } });
        if (!section) throw new BadRequestException('قسم V4 غير موجود');
      }

      const itemIds = [...new Set(input.lines.map((line) => line.itemId))];
      const items = await tx.ordersV4Item.findMany({
        where: { companyId, id: { in: itemIds }, isActive: true },
        include: {
          inventoryUnit: true,
          units: true,
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
                      inventoryUnit: true,
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
      if (items.length !== itemIds.length) throw new BadRequestException('أحد أصناف V4 غير موجود أو غير فعال');
      const itemById = new Map(items.map((item) => [item.id, item]));
      const units = await tx.ordersV4Unit.findMany({ where: { companyId, isActive: true } });
      const unitDefinitions = ordersV4UnitDefinitions(units);

      const prepared = input.lines.map((line, index) => {
        const item = itemById.get(line.itemId);
        if (!item) throw new BadRequestException('صنف V4 غير موجود');
        if (input.documentType === 'purchase' && item.itemType === 'sale') throw new BadRequestException(`${item.nameAr}: صنف بيع لا يقبل مستند شراء`);
        if (input.documentType === 'registration' && item.itemType === 'purchased') throw new BadRequestException(`${item.nameAr}: مادة مشتراة لا تقبل التسجيل الداخلي المباشر`);
        const definition = item.conversionVersions[0];
        if (!item.units.some((row) => row.unitId === line.unitId && row.isActive)) {
          throw new BadRequestException(`${item.nameAr}: وحدة الكمية غير مضافة إلى بطاقة الصنف`);
        }
        const definitionEdges = ordersV4EdgeDefinitions(definition?.edges);
        const inputConversion = resolveOrdersV4ContextConversion({
          fromUnitId: line.unitId,
          toUnitId: item.kernelUnitId,
          units: unitDefinitions,
          edges: definitionEdges,
        });
        const priceUnitId = line.priceUnitId || line.unitId;
        const priceUnit = item.units.find((row) => row.unitId === priceUnitId && row.isActive);
        if (!priceUnit) {
          throw new BadRequestException(`${item.nameAr}: وحدة السعر غير مضافة إلى بطاقة الصنف`);
        }
        if (input.documentType === 'purchase' && (!priceUnit.isOrderEnabled || priceUnit.lastPrice == null)) {
          throw new BadRequestException(`${item.nameAr}: تغليف السعر غير مفعل للطلبات أو لا يحتوي على سعر`);
        }
        const priceConversion = resolveOrdersV4ContextConversion({
          fromUnitId: priceUnitId,
          toUnitId: item.kernelUnitId,
          units: unitDefinitions,
          edges: definitionEdges,
        });
        const calculation = calculateOrdersV4Line({
          inputQuantity: line.quantity,
          unitPrice: line.unitPrice ?? 0,
          inputConversion,
          priceConversion,
        });
        const recipe = input.documentType === 'registration' ? item.recipeVersions[0] : undefined;
        return { index, item, definition, recipe, line, priceUnitId, calculation };
      });

      const subtotal = prepared.reduce((sum, row) => sum.plus(row.calculation.lineTotal), new Prisma.Decimal(0)).toDecimalPlaces(6);
      const initialOperationalCost = input.documentType === 'purchase' ? subtotal : new Prisma.Decimal(0);
      const inventoryKeys = prepared.flatMap((row) => {
        if (input.documentType === 'purchase') return row.item.trackInventory ? [{ itemId: row.item.id, locationId: location.id }] : [];
        if (row.recipe) return row.recipe.lines.filter((line) => line.componentItem.trackInventory).map((line) => ({ itemId: line.componentItem.id, locationId: location.id }));
        return row.item.trackInventory ? [{ itemId: row.item.id, locationId: location.id }] : [];
      });
      if (input.documentType === 'registration') await this.posting.lockKeys(tx, companyId, inventoryKeys);
      const document = await tx.ordersV4Document.create({
        data: {
          tenantId,
          companyId,
          documentNumber: documentNumber(input.documentType, documentDate),
          documentType: input.documentType,
          paymentMethod: input.documentType === 'purchase' ? input.paymentMethod || 'custody' : null,
          documentDate,
          status: input.documentType === 'purchase' ? 'prepared' : 'received',
          sectionId: input.sectionId || null,
          locationId: location.id,
          pettyCashAmount,
          subtotal,
          totalAmount: subtotal,
          operationalCost: initialOperationalCost,
          notes: input.notes?.trim() || null,
          idempotencyKey: input.idempotencyKey.trim(),
          requestHash: inputRequestHash,
          calculationVersion: 1,
          calculationSnapshot: {
            kernelVersion: 4,
            owner: 'orders-v4-calculation-kernel',
            lineCount: prepared.length,
            subtotal: subtotal.toString(),
            totalAmount: subtotal.toString(),
            operationalCost: initialOperationalCost.toString(),
          },
          createdByUserId: userId,
        },
      });

      let registrationOperationalCost = new Prisma.Decimal(0);
      for (const row of prepared) {
        const createdLine = await tx.ordersV4DocumentLine.create({
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
            baseUnitId: row.item.kernelUnitId,
            unitPrice: row.calculation.unitPrice,
            priceUnitId: row.priceUnitId,
            priceQuantity: row.calculation.priceQuantity,
            lineTotal: row.calculation.lineTotal,
            operationalCost: input.documentType === 'purchase' ? row.calculation.lineTotal : new Prisma.Decimal(0),
            conversionVersionId: row.definition?.id || null,
            recipeVersionId: row.recipe?.id || null,
            conversionSnapshot: {
              input: conversionSnapshot(row.calculation.inputConversion),
              price: conversionSnapshot(row.calculation.priceConversion),
            },
            calculationSnapshot: {
              kernelVersion: 4,
              inputQuantity: row.calculation.inputQuantity.toString(),
              baseQuantity: row.calculation.baseQuantity.toString(),
              priceQuantity: row.calculation.priceQuantity.toString(),
              unitPrice: row.calculation.unitPrice.toString(),
              lineTotal: row.calculation.lineTotal.toString(),
            },
          },
        });

        if (input.documentType === 'registration') {
          if (row.recipe) {
            let recipeCost = new Prisma.Decimal(0);
            const recipeCostLines: Prisma.InputJsonObject[] = [];
            const outputDefinitionEdges = ordersV4EdgeDefinitions(row.definition?.edges);
            const outputConversion = resolveOrdersV4ContextConversion({
              fromUnitId: row.recipe.outputUnitId,
              toUnitId: row.item.kernelUnitId,
              units: unitDefinitions,
              edges: outputDefinitionEdges,
            });
            for (const component of row.recipe.lines) {
              if (!component.componentItem.trackInventory) continue;
              const componentDefinition = component.componentItem.conversionVersions[0];
              const componentEdges = ordersV4EdgeDefinitions(componentDefinition?.edges);
              const componentConversion = resolveOrdersV4ContextConversion({
                fromUnitId: component.unitId,
                toUnitId: component.componentItem.kernelUnitId,
                units: unitDefinitions,
                edges: componentEdges,
              });
              const { issueQuantity } = calculateOrdersV4RecipeUsage({
                registeredBaseQuantity: row.calculation.baseQuantity,
                recipeOutputQuantity: row.recipe.outputQuantity,
                outputConversion,
                componentQuantity: component.quantity,
                componentConversion,
              });
              const recentPrices = await tx.$queryRaw<Array<{
                documentId: string;
                inventoryUnitPrice: Prisma.Decimal;
                inventoryUnitId: string;
              }>>(Prisma.sql`
                SELECT sample.document_id AS "documentId",
                       sample.inventory_unit_price AS "inventoryUnitPrice",
                       sample.inventory_unit_id AS "inventoryUnitId"
                FROM (
                  SELECT DISTINCT ON (history.document_id)
                         history.document_id, history.inventory_unit_price,
                         history.inventory_unit_id, history.effective_at, history.created_at
                  FROM orders_v4_price_history AS history
                  INNER JOIN orders_v4_documents AS document ON document.id = history.document_id
                  WHERE history.company_id = ${companyId}
                    AND history.item_id = ${component.componentItem.id}
                    AND document.status = 'received'
                  ORDER BY history.document_id, history.effective_at DESC, history.created_at DESC
                ) AS sample
                ORDER BY sample.effective_at DESC, sample.created_at DESC
                LIMIT 5
              `);
              if (!recentPrices.length) {
                throw new BadRequestException(`${component.componentItem.nameAr}: لا توجد طلبات شراء مستلمة لحساب تكلفة الرسبي`);
              }
              const normalizedPrices = recentPrices.map((price) => calculateOrdersV4ConvertedUnitPrice(
                price.inventoryUnitPrice,
                resolveOrdersV4ContextConversion({
                  fromUnitId: price.inventoryUnitId,
                  toUnitId: component.componentItem.kernelUnitId,
                  units: unitDefinitions,
                  edges: componentEdges,
                }),
              ));
              const averageLastFive = calculateOrdersV4LastFiveAverage(normalizedPrices);
              const componentCost = calculateOrdersV4RecipeComponentCost(issueQuantity, averageLastFive);
              recipeCost = recipeCost.plus(componentCost);
              recipeCostLines.push({
                componentItemId: component.componentItem.id,
                componentName: component.componentItem.nameAr,
                issueQuantity: issueQuantity.toString(),
                averageLastFive: averageLastFive.toString(),
                sampleCount: recentPrices.length,
                componentCost: componentCost.toString(),
              });
              await this.posting.postIssue(tx, {
                  tenantId, companyId, itemId: component.componentItem.id, inventoryUnitId: component.componentItem.kernelUnitId, locationId: location.id,
                documentLineId: createdLine.id, sourceId: document.id,
                sourceKey: `document:${document.id}:line:${createdLine.id}:recipe:${component.id}:issue`,
                effectiveAt: documentDate, quantity: issueQuantity,
                provisionalUnitCost: averageLastFive,
                conversionVersionId: componentDefinition?.id || null,
                recipeVersionId: row.recipe.id,
                sourceSnapshot: {
                  documentNumber: document.documentNumber,
                  lineNumber: row.index + 1,
                  recipeVersion: row.recipe.version,
                  componentLineId: component.id,
                  kernelVersion: 4,
                },
              });
            }
            const lineOperationalCost = recipeCost.toDecimalPlaces(6);
            registrationOperationalCost = registrationOperationalCost.plus(lineOperationalCost);
            await tx.ordersV4DocumentLine.update({
              where: { id: createdLine.id },
              data: {
                operationalCost: lineOperationalCost,
                recipeSnapshot: {
                  recipeVersionId: row.recipe.id,
                  recipeVersion: row.recipe.version,
                  outputQuantity: row.recipe.outputQuantity.toString(),
                  outputUnitId: row.recipe.outputUnitId,
                },
                costSnapshot: {
                  policy: 'simple-average-last-5-received-purchase-orders',
                  totalCost: lineOperationalCost.toString(),
                  costPerRegisteredUnit: calculateOrdersV4AverageUnitCost(recipeCost, row.calculation.inputQuantity).toString(),
                  components: recipeCostLines,
                },
              },
            });
          } else if (row.item.trackInventory) {
            const issueEntry = await this.posting.postIssue(tx, {
              tenantId, companyId, itemId: row.item.id, inventoryUnitId: row.item.kernelUnitId, locationId: location.id,
              documentLineId: createdLine.id, sourceId: document.id,
              sourceKey: `document:${document.id}:line:${createdLine.id}:issue`,
              effectiveAt: documentDate, quantity: row.calculation.baseQuantity,
              conversionVersionId: row.definition?.id || null,
              recipeVersionId: null,
              sourceSnapshot: { documentNumber: document.documentNumber, lineNumber: row.index + 1, kernelVersion: 4 },
            });
            const lineOperationalCost = issueEntry.valueDelta.abs().toDecimalPlaces(6);
            registrationOperationalCost = registrationOperationalCost.plus(lineOperationalCost);
            await tx.ordersV4DocumentLine.update({
              where: { id: createdLine.id },
              data: {
                operationalCost: lineOperationalCost,
                costSnapshot: {
                  policy: 'moving-average-inventory-cost',
                  totalCost: lineOperationalCost.toString(),
                  costPerRegisteredUnit: calculateOrdersV4AverageUnitCost(lineOperationalCost, row.calculation.inputQuantity).toString(),
                },
              },
            });
          }
        }
      }

      if (input.documentType === 'registration') {
        const operationalCost = registrationOperationalCost.toDecimalPlaces(6);
        await tx.ordersV4Document.update({
          where: { id: document.id },
          data: {
            operationalCost,
            calculationSnapshot: {
              kernelVersion: 4,
              owner: 'orders-v4-calculation-kernel',
              lineCount: prepared.length,
              subtotal: subtotal.toString(),
              totalAmount: subtotal.toString(),
              operationalCost: operationalCost.toString(),
              costPolicy: 'line-cost-snapshots',
            },
          },
        });
      }

      return tx.ordersV4Document.findUniqueOrThrow({
        where: { id: document.id },
        include: { section: true, location: true, lines: { include: { item: true, inputUnit: true, baseUnit: true, priceUnit: true }, orderBy: { lineNumber: 'asc' } } },
      });
    });
  }

  async receiveLatest(companyId: string, id: string, input: OrdersV4ReceiveInput) {
    if (!input.idempotencyKey?.trim()) throw new BadRequestException('مفتاح منع التكرار مطلوب');
    if (!input.lines?.length) throw new BadRequestException('يجب تسجيل صنف مستلم واحد على الأقل');
    if (new Set(input.lines.map((line) => line.itemId)).size !== input.lines.length) {
      throw new BadRequestException('لا يمكن تكرار الصنف نفسه في الاستلام؛ عدّل الكمية في السطر الموجود');
    }
    if (!Number.isInteger(input.revision) || input.revision < 1) throw new BadRequestException('رقم مراجعة الطلب غير صالح');
    const tenantId = TenantContext.getTenantId();
    const userId = TenantContext.getUserId();
    const receivedDate = ordersV4DateOnly(input.documentDate, 'تاريخ الاستلام');
    const receiveRequestHash = requestHash({
      revision: input.revision,
      documentDate: input.documentDate,
      paymentMethod: input.paymentMethod ?? 'custody',
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

    return this.prisma.withTenant(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`orders-v4:receive:${companyId}`}))`;
      const latest = await tx.ordersV4Document.findFirst({
        where: { companyId, documentType: 'purchase', reversalOfId: null },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
      if (!latest || latest.id !== id) throw new BadRequestException('الاستلام والتعديل متاحان لآخر طلب فقط');
      const previousSnapshot = latest.calculationSnapshot as Record<string, unknown>;
      if (latest.status === 'received' && previousSnapshot.receiveIdempotencyKey === input.idempotencyKey.trim()) {
        if (previousSnapshot.receiveRequestHash !== receiveRequestHash) {
          throw new BadRequestException('مفتاح منع تكرار الاستلام مستخدم لمحتوى مختلف');
        }
        return tx.ordersV4Document.findUniqueOrThrow({
          where: { id },
          include: { section: true, location: true, lines: { include: { item: true, inputUnit: true, baseUnit: true, priceUnit: true }, orderBy: { lineNumber: 'asc' } } },
        });
      }
      if (latest.status !== 'prepared') throw new BadRequestException('آخر طلب ليس في حالة انتظار الاستلام');
      if (latest.revision !== input.revision) throw new BadRequestException('تم تعديل الطلب؛ أعد تحميله قبل الاستلام');

      const location = await tx.ordersV4Location.findFirst({ where: { id: input.locationId, companyId, isActive: true } });
      if (!location) throw new BadRequestException('موقع المخزون غير موجود');
      const itemIds = [...new Set(input.lines.map((line) => line.itemId))];
      const items = await tx.ordersV4Item.findMany({
        where: { companyId, id: { in: itemIds }, itemType: 'purchased', isActive: true },
        include: {
          units: true,
          conversionVersions: { where: { status: 'published' }, include: { edges: true }, orderBy: { version: 'desc' }, take: 1 },
        },
      });
      if (items.length !== itemIds.length) throw new BadRequestException('أحد أصناف الاستلام غير صالح');
      const units = await tx.ordersV4Unit.findMany({ where: { companyId, isActive: true } });
      const unitDefinitions = ordersV4UnitDefinitions(units);
      const itemById = new Map(items.map((item) => [item.id, item]));
      const prepared = input.lines.map((line, index) => {
        const item = itemById.get(line.itemId);
        if (!item) throw new BadRequestException('صنف الاستلام غير موجود');
        if (!item.units.some((row) => row.unitId === line.unitId && row.isActive)) {
          throw new BadRequestException(`${item.nameAr}: وحدة الكمية غير مضافة إلى بطاقة الصنف`);
        }
        const priceUnitId = line.priceUnitId || line.unitId;
        if (!item.units.some((row) => row.unitId === priceUnitId && row.isActive)) {
          throw new BadRequestException(`${item.nameAr}: وحدة السعر غير مضافة إلى بطاقة الصنف`);
        }
        const definition = item.conversionVersions[0];
        const edges = ordersV4EdgeDefinitions(definition?.edges);
        const inputConversion = resolveOrdersV4ContextConversion({
          fromUnitId: line.unitId, toUnitId: item.kernelUnitId, units: unitDefinitions, edges,
        });
        const priceConversion = resolveOrdersV4ContextConversion({
          fromUnitId: priceUnitId, toUnitId: item.kernelUnitId, units: unitDefinitions, edges,
        });
        const calculation = calculateOrdersV4Line({
          inputQuantity: line.quantity,
          unitPrice: line.unitPrice ?? 0,
          inputConversion,
          priceConversion,
        });
        if (calculation.unitPrice.lt(0)) throw new BadRequestException('سعر الاستلام لا يمكن أن يكون سالبًا');
        return { index, item, line, priceUnitId, definition, calculation };
      });
      const subtotal = prepared.reduce((sum, row) => sum.plus(row.calculation.lineTotal), new Prisma.Decimal(0)).toDecimalPlaces(6);
      const paymentMethod = input.paymentMethod || 'custody';
      if (!['custody', 'cash', 'transfer'].includes(paymentMethod)) throw new BadRequestException('طريقة الدفع غير صالحة');
      let pettyCashAmount: Prisma.Decimal | null = null;
      if (paymentMethod === 'custody' && input.pettyCashAmount != null && input.pettyCashAmount !== '') {
        try {
          pettyCashAmount = new Prisma.Decimal(input.pettyCashAmount);
        } catch {
          throw new BadRequestException('مبلغ العهدة غير صالح');
        }
      }
      if (pettyCashAmount?.lt(0)) throw new BadRequestException('العهدة لا يمكن أن تكون سالبة');

      if (paymentMethod === 'cash') {
        const [cashSales] = await tx.$queryRaw<Array<{ total: Prisma.Decimal | null }>>(Prisma.sql`
          SELECT COALESCE(SUM(channel.amount), 0) AS total
          FROM daily_sales_summaries AS summary
          INNER JOIN daily_sales_channels AS channel ON channel.summary_id = summary.id
          INNER JOIN vaults AS vault ON vault.id = channel.vault_id
          WHERE summary.company_id = ${companyId}
            AND summary.status = 'active'
            AND summary.transaction_date <= ${new Date(`${input.documentDate}T23:59:59.999Z`)}
            AND vault.type = 'cash'
        `);
        const used = await tx.ordersV4Document.aggregate({
          where: { companyId, documentType: 'purchase', status: 'received', paymentMethod: 'cash', documentDate: { lte: receivedDate } },
          _sum: { totalAmount: true },
        });
        const available = calculateOrdersV4CashAvailable(cashSales?.total ?? 0, used._sum.totalAmount ?? 0);
        if (subtotal.gt(available)) throw new BadRequestException(`رصيد نقد المحل غير كافٍ. المتاح ${available.toFixed(2)}`);
      }

      await this.posting.lockKeys(tx, companyId, prepared.filter((row) => row.item.trackInventory).map((row) => ({ itemId: row.item.id, locationId: location.id })));
      await tx.ordersV4DocumentLine.deleteMany({ where: { documentId: id } });
      const calculationSnapshot: Prisma.InputJsonObject = {
        kernelVersion: 4,
        owner: 'orders-v4-calculation-kernel',
        receivedFromRevision: latest.revision,
        receiveIdempotencyKey: input.idempotencyKey.trim(),
        receiveRequestHash,
        lineCount: prepared.length,
        subtotal: subtotal.toString(),
        operationalCost: subtotal.toString(),
      };
      await tx.ordersV4Document.update({
        where: { id },
        data: {
          documentDate: receivedDate,
          paymentMethod,
          sectionId: input.sectionId || null,
          locationId: location.id,
          pettyCashAmount,
          subtotal,
          totalAmount: subtotal,
          operationalCost: subtotal,
          notes: input.notes?.trim() || null,
          status: 'received',
          revision: { increment: 1 },
          receivedAt: new Date(),
          receivedByUserId: userId,
          updatedByUserId: userId,
          calculationSnapshot,
        },
      });

      for (const row of prepared) {
        const line = await tx.ordersV4DocumentLine.create({
          data: {
            tenantId, companyId, documentId: id, itemId: row.item.id, lineNumber: row.index + 1,
            itemNameSnapshot: row.item.nameAr,
            inputQuantity: row.calculation.inputQuantity, inputUnitId: row.line.unitId,
            baseQuantity: row.calculation.baseQuantity, baseUnitId: row.item.kernelUnitId, unitPrice: row.calculation.unitPrice,
            priceUnitId: row.priceUnitId, priceQuantity: row.calculation.priceQuantity,
            lineTotal: row.calculation.lineTotal, conversionVersionId: row.definition?.id || null,
            operationalCost: row.calculation.lineTotal,
            conversionSnapshot: {
              input: conversionSnapshot(row.calculation.inputConversion),
              price: conversionSnapshot(row.calculation.priceConversion),
            },
            calculationSnapshot: {
              kernelVersion: 4,
              inputQuantity: row.calculation.inputQuantity.toString(),
              baseQuantity: row.calculation.baseQuantity.toString(),
              inventoryUnitPrice: calculateOrdersV4InventoryUnitPrice(row.calculation.lineTotal, row.calculation.baseQuantity).toString(),
            },
          },
        });
        const inventoryUnitPrice = calculateOrdersV4InventoryUnitPrice(row.calculation.lineTotal, row.calculation.baseQuantity);
        await tx.ordersV4PriceHistory.create({
          data: {
            tenantId, companyId, itemId: row.item.id, unitId: row.priceUnitId, inventoryUnitId: row.item.kernelUnitId,
            documentId: id, documentLineId: line.id, unitPrice: row.calculation.unitPrice,
            inventoryUnitPrice, conversionVersionId: row.definition?.id || null, effectiveAt: receivedDate,
          },
        });
        await tx.ordersV4ItemUnit.updateMany({
          where: { companyId, itemId: row.item.id, unitId: row.priceUnitId },
          data: { lastPrice: row.calculation.unitPrice, lastPriceAt: receivedDate },
        });
        if (row.item.trackInventory) {
          await this.posting.postReceipt(tx, {
            tenantId, companyId, itemId: row.item.id, inventoryUnitId: row.item.kernelUnitId, locationId: location.id, documentLineId: line.id,
            sourceId: id, sourceKey: `document:${id}:line:${line.id}:receipt`, effectiveAt: receivedDate,
            quantity: row.calculation.baseQuantity, totalValue: row.calculation.lineTotal,
            conversionVersionId: row.definition?.id || null,
            sourceSnapshot: { kernelVersion: 4, lineNumber: row.index + 1, receivedByUserId: userId },
          });
        }
      }

      if (paymentMethod === 'custody') {
        await this.fundsPosting.postPurchase(tx, {
          tenantId, companyId, documentId: id, effectiveAt: receivedDate,
          purchaseAmount: subtotal, fundingAmount: pettyCashAmount,
        });
      }

      return tx.ordersV4Document.findUniqueOrThrow({
        where: { id },
        include: { section: true, location: true, lines: { include: { item: true, inputUnit: true, baseUnit: true, priceUnit: true }, orderBy: { lineNumber: 'asc' } } },
      });
    });
  }

  reverse(companyId: string, id: string, idempotencyKey: string) {
    return this.toggleReversal(companyId, id, idempotencyKey, false);
  }

  undoReverse(companyId: string, id: string, idempotencyKey: string) {
    return this.toggleReversal(companyId, id, idempotencyKey, true);
  }

  private async toggleReversal(companyId: string, id: string, idempotencyKey: string, undo: boolean) {
    if (!idempotencyKey?.trim()) throw new BadRequestException('مفتاح منع التكرار مطلوب');
    const tenantId = TenantContext.getTenantId();
    const operation = undo ? 'undo-reverse' : 'reverse';
    const reversalRequestHash = requestHash({ operation, documentId: id });
    return this.prisma.withTenant(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`orders-v4:reverse:${companyId}:${id}`}))`;
      const duplicate = await tx.ordersV4Document.findFirst({ where: { companyId, idempotencyKey: idempotencyKey.trim() } });
      if (duplicate) {
        if (duplicate.requestHash !== reversalRequestHash) throw new BadRequestException('مفتاح منع التكرار مستخدم لعملية مختلفة');
        return duplicate;
      }
      const original = await tx.ordersV4Document.findFirst({
        where: { id, companyId, status: undo ? 'reversed' : 'received', reversalOfId: null }, include: { lines: true },
      });
      if (!original) throw new NotFoundException(undo ? 'المستند غير موجود أو لم يتم عكسه' : 'المستند غير موجود أو سبق عكسه');
      let chainHead = original;
      const visited = new Set<string>([original.id]);
      while (true) {
        const next = await tx.ordersV4Document.findFirst({ where: { companyId, reversalOfId: chainHead.id }, include: { lines: true } });
        if (!next) break;
        if (visited.has(next.id)) throw new BadRequestException('تم اكتشاف دورة غير صالحة في سلسلة العكس');
        visited.add(next.id);
        chainHead = next;
      }
      const originalLedger = await tx.ordersV4InventoryLedgerEntry.findMany({
        where: { companyId, sourceId: chainHead.id }, orderBy: { sequence: 'desc' },
      });
      const ledgerItemIds = [...new Set(originalLedger.map((entry) => entry.itemId))];
      const historicalConversionIds = [...new Set(originalLedger.map((entry) => entry.conversionVersionId).filter(Boolean) as string[])];
      const [ledgerItems, companyUnits, historicalConversions] = await Promise.all([
        tx.ordersV4Item.findMany({
          where: { companyId, id: { in: ledgerItemIds } },
          include: {
            conversionVersions: {
              where: { status: 'published' },
              orderBy: { version: 'desc' },
              take: 1,
              include: { edges: true },
            },
          },
        }),
        tx.ordersV4Unit.findMany({ where: { companyId } }),
        tx.ordersV4ConversionVersion.findMany({
          where: { companyId, id: { in: historicalConversionIds } },
          include: { edges: true },
        }),
      ]);
      const unitDefinitions = ordersV4UnitDefinitions(companyUnits);
      const originalCustody = await tx.ordersV4CustodyLedgerEntry.findMany({
        where: { companyId, documentId: chainHead.id }, orderBy: { sequence: 'asc' },
      });
      await this.posting.lockKeys(tx, companyId, originalLedger.map((entry) => ({ itemId: entry.itemId, locationId: entry.locationId })));
      const reversal = await tx.ordersV4Document.create({
        data: {
          tenantId, companyId,
          documentNumber: `${original.documentNumber}-${undo ? 'UNDO' : 'R'}-${randomUUID().slice(0, 8).toUpperCase()}`,
          documentType: original.documentType,
          paymentMethod: original.paymentMethod,
          documentDate: new Date(), status: 'reversed', sectionId: original.sectionId,
          locationId: original.locationId, pettyCashAmount: chainHead.pettyCashAmount?.negated() ?? null,
          subtotal: chainHead.subtotal.negated(), totalAmount: chainHead.totalAmount.negated(),
          operationalCost: chainHead.operationalCost.negated(),
          notes: undo ? `إلغاء عكس ${original.documentNumber}` : `عكس ${original.documentNumber}`,
          idempotencyKey: idempotencyKey.trim(),
          requestHash: reversalRequestHash,
          calculationVersion: 1,
          calculationSnapshot: {
            kernelVersion: 4,
            operation,
            rootDocumentId: original.id,
            reversalOfId: chainHead.id,
            operationalCost: chainHead.operationalCost.negated().toString(),
          },
          reversalOfId: chainHead.id, createdByUserId: TenantContext.getUserId(),
        },
      });
      const reversedAt = new Date();
      for (const entry of originalLedger) {
        const item = ledgerItems.find((row) => row.id === entry.itemId);
        if (!item) throw new BadRequestException('تعذر العثور على صنف قيد المخزون المراد عكسه');
        const definition = item.conversionVersions[0];
        const historicalDefinition = historicalConversions.find((row) => row.id === entry.conversionVersionId);
        const currentConversion = resolveOrdersV4ContextConversion({
          fromUnitId: entry.inventoryUnitId,
          toUnitId: item.kernelUnitId,
          units: unitDefinitions,
          edges: ordersV4EdgeDefinitions(historicalDefinition?.edges ?? definition?.edges),
        });
        await this.posting.postReversal(tx, {
          tenantId,
          companyId,
          sourceId: reversal.id,
          effectiveAt: reversedAt,
          currentInventoryUnitId: item.kernelUnitId,
          currentConversionVersionId: historicalDefinition?.id ?? definition?.id ?? null,
          currentConversion,
          original: entry,
        });
      }
      if (originalCustody.length) {
        await this.fundsPosting.postReversals(tx, {
          tenantId, companyId, reversalDocumentId: reversal.id,
          effectiveAt: reversedAt, originals: originalCustody,
        });
      }
      await tx.ordersV4Document.update({
        where: { id: original.id },
        data: { status: undo ? 'received' : 'reversed', updatedByUserId: TenantContext.getUserId() },
      });
      for (const line of original.lines) {
        const latestPrice = await tx.ordersV4PriceHistory.findFirst({
          where: { companyId, itemId: line.itemId, unitId: line.priceUnitId, document: { status: 'received' } },
          orderBy: [{ effectiveAt: 'desc' }, { createdAt: 'desc' }],
        });
        await tx.ordersV4ItemUnit.updateMany({
          where: { companyId, itemId: line.itemId, unitId: line.priceUnitId },
          data: { lastPrice: latestPrice?.unitPrice ?? null, lastPriceAt: latestPrice?.effectiveAt ?? null },
        });
      }
      return reversal;
    });
  }

}
