import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
import { OrdersV4LedgerPostingService } from './orders-v4-ledger-posting.service';
import { calculateOrdersV4CashAvailable } from './orders-v4-funds.kernel';
import { OrdersV4FundsPostingService } from './orders-v4-funds-posting.service';
import { ordersV4DocumentListQuery, type OrdersV4DocumentListFilters } from './orders-v4-document-list-query.util';
import { loadOrdersV4UserIdentities, ordersV4UserIdentity } from './orders-v4-user-identity.util';
import { resolveOrdersV4RegistrationEntry } from './orders-v4-registration-cancellation.policy';
import {
  ordersV4OperationKeyHash,
  ordersV4RequestHash,
  persistOrdersV4OperationReplay,
  readOrdersV4OperationReplay,
} from './orders-v4-operation-idempotency.util';
import { OrdersV4DocumentReversalService } from './orders-v4-document-reversal.service';
import { ordersV4PurchaseWindowLockKey } from './orders-v4-document-effect.policy';
import { OrdersV4PurchaseCorrectionService, type OrdersV4CorrectionPreparation } from './orders-v4-purchase-correction.service';
import {
  ordersV4ConversionSnapshot,
  ordersV4DocumentNumber,
  ordersV4DocumentRequestHash,
} from './orders-v4-document-format.util';
import {
  isOrdersV4CashierEditEligible,
  isOrdersV4OwnerEditEligible,
  ORDERS_V4_CASHIER_EDIT_LIMIT,
  ORDERS_V4_REOPEN_WINDOW_DAYS,
  ordersV4CashierRecentEditablePurchasesQuery,
  isOrdersV4ReopenDateEligible,
  type OrdersV4ReopenAccess,
} from './orders-v4-reopen.policy';

@Injectable()
export class OrdersV4DocumentsService {
  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly posting: OrdersV4LedgerPostingService,
    private readonly fundsPosting: OrdersV4FundsPostingService,
    private readonly reversal: OrdersV4DocumentReversalService,
    private readonly purchaseCorrection: OrdersV4PurchaseCorrectionService,
  ) {}

  async list(
    companyId: string,
    documentType?: OrdersV4DocumentType,
    startDate?: string,
    endDate?: string,
    createdByUserId?: string,
    limit = 250,
    filters: OrdersV4DocumentListFilters = {},
    reopenAccess: OrdersV4ReopenAccess | 'none' = 'owner',
  ) {
    const [documents, cashierRecentPurchases] = await Promise.all([
      this.prisma.ordersV4Document.findMany(
        ordersV4DocumentListQuery(companyId, documentType, startDate, endDate, createdByUserId, limit, filters),
      ),
      documentType === 'purchase' && reopenAccess !== 'none'
        ? this.prisma.ordersV4Document.findMany(ordersV4CashierRecentEditablePurchasesQuery(companyId))
        : Promise.resolve([]),
    ]);
    const cashierRecentPurchaseIds = cashierRecentPurchases.map((document) => document.id);
    const identities = await loadOrdersV4UserIdentities(this.prisma, documents.map((document) => document.createdByUserId));
    return documents.map((document) => ({
      ...document,
      canReceive: document.documentType === 'purchase'
        && document.reversalOfId == null
        && document.status === 'prepared'
        && (reopenAccess === 'owner'
          ? isOrdersV4OwnerEditEligible(document.id, document.documentDate, cashierRecentPurchaseIds)
          : reopenAccess === 'cashier' && isOrdersV4CashierEditEligible(document.id, cashierRecentPurchaseIds)),
      canReopen: document.documentType === 'purchase'
        && document.reversalOfId == null
        && document.status === 'received'
        && (reopenAccess === 'owner'
          ? isOrdersV4OwnerEditEligible(document.id, document.documentDate, cashierRecentPurchaseIds)
          : reopenAccess === 'cashier'
            ? isOrdersV4CashierEditEligible(document.id, cashierRecentPurchaseIds)
            : false),
      createdByUser: ordersV4UserIdentity(identities, document.createdByUserId),
    }));
  }

  /**
   * Read-only purchase total preview. It deliberately uses the same conversion
   * resolver and calculation kernel as document creation, without creating a
   * document, ledger entry, price history row, or funds movement.
   */
  async previewPurchase(companyId: string, lines: OrdersV4DocumentInput['lines']) {
    if (!lines?.length) throw new BadRequestException('يجب إدخال صنف واحد على الأقل');
    if (new Set(lines.map((line) => line.itemId)).size !== lines.length) {
      throw new BadRequestException('لا يمكن تكرار الصنف نفسه في الطلب؛ عدّل الكمية في السطر الموجود');
    }

    const itemIds = lines.map((line) => line.itemId);
    const [items, units] = await Promise.all([
      this.prisma.ordersV4Item.findMany({
        where: { companyId, id: { in: itemIds }, isActive: true },
        include: {
          units: true,
          conversionVersions: {
            where: { status: 'published' },
            include: { edges: true },
            orderBy: { version: 'desc' },
            take: 1,
          },
        },
      }),
      this.prisma.ordersV4Unit.findMany({ where: { companyId, isActive: true } }),
    ]);
    if (items.length !== itemIds.length) throw new BadRequestException('أحد أصناف الطلب غير موجود أو غير فعال');

    const itemById = new Map(items.map((item) => [item.id, item]));
    const unitDefinitions = ordersV4UnitDefinitions(units);
    const calculatedLines = lines.map((line, index) => {
      const item = itemById.get(line.itemId);
      if (!item || item.itemType === 'sale') throw new BadRequestException('صنف بيع لا يقبل طلب شراء');
      if (!item.units.some((row) => row.unitId === line.unitId && row.isActive)) {
        throw new BadRequestException(`${item.nameAr}: وحدة الكمية غير مضافة إلى بطاقة الصنف`);
      }
      const priceUnitId = line.priceUnitId || line.unitId;
      if (!item.units.some((row) => row.unitId === priceUnitId && row.isActive)) {
        throw new BadRequestException(`${item.nameAr}: وحدة السعر غير مضافة إلى بطاقة الصنف`);
      }
      const edges = ordersV4EdgeDefinitions(item.conversionVersions[0]?.edges);
      const calculation = calculateOrdersV4Line({
        inputQuantity: line.quantity,
        unitPrice: line.unitPrice ?? 0,
        inputConversion: resolveOrdersV4ContextConversion({
          fromUnitId: line.unitId,
          toUnitId: item.kernelUnitId,
          units: unitDefinitions,
          edges,
        }),
        priceConversion: resolveOrdersV4ContextConversion({
          fromUnitId: priceUnitId,
          toUnitId: item.kernelUnitId,
          units: unitDefinitions,
          edges,
        }),
      });
      return {
        lineNumber: index + 1,
        itemId: item.id,
        itemName: item.nameAr,
        lineTotal: calculation.lineTotal.toString(),
      };
    });
    const totalAmount = calculatedLines
      .reduce((sum, line) => sum.plus(line.lineTotal), new Prisma.Decimal(0))
      .toDecimalPlaces(6);

    return {
      kernelVersion: 4 as const,
      calculationVersion: 1,
      lineCount: calculatedLines.length,
      totalAmount: totalAmount.toString(),
      lines: calculatedLines,
    };
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
    const registrationEntry = resolveOrdersV4RegistrationEntry(input);
    const isRegistrationCancellation = registrationEntry.entryType === 'cancellation';
    if (input.documentType === 'purchase' && !['custody', 'cash', 'transfer'].includes(input.paymentMethod || 'custody')) {
      throw new BadRequestException('طريقة الدفع غير صالحة');
    }
    if (input.documentType === 'registration' && input.paymentMethod) throw new BadRequestException('التسجيل الداخلي لا يقبل طريقة دفع');
    const documentDate = ordersV4DateOnly(input.documentDate, 'تاريخ المستند');
    const inputRequestHash = ordersV4DocumentRequestHash(input);
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
      if (input.documentType === 'purchase') {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ordersV4PurchaseWindowLockKey(companyId)}))`;
      }
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
          sections: true,
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
        if (input.sectionId && !item.sections.some((entry) => entry.sectionId === input.sectionId)) {
          throw new BadRequestException(`${item.nameAr}: الصنف غير مرتبط بالقسم المختار`);
        }
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
      // A cancellation is an independent waste/control record, not a reversal of an earlier
      // registration. Its quantities and cost therefore stay positive while inventory posting
      // consumes the affected stock through the central issue kernel.
      const signedSubtotal = subtotal;
      const initialOperationalCost = input.documentType === 'purchase' ? signedSubtotal : new Prisma.Decimal(0);
      const inventoryKeys = prepared.flatMap((row) => {
        if (input.documentType === 'purchase') return row.item.trackInventory ? [{ itemId: row.item.id, locationId: location.id }] : [];
        if (row.recipe) return row.recipe.lines.filter((line) => line.componentItem.trackInventory).map((line) => ({ itemId: line.componentItem.id, locationId: location.id }));
        return row.item.trackInventory ? [{ itemId: row.item.id, locationId: location.id }] : [];
      });
      if (isRegistrationCancellation) {
        if (!input.sectionId) throw new BadRequestException('يجب اختيار القسم عند تسجيل الإلغاء');
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`orders-v4:registration-cancellation:${companyId}:${documentDate.toISOString()}:${input.sectionId}:${location.id}`}))`;
      }
      if (input.documentType === 'registration') await this.posting.lockKeys(tx, companyId, inventoryKeys);
      const document = await tx.ordersV4Document.create({
        data: {
          tenantId,
          companyId,
          documentNumber: ordersV4DocumentNumber(input.documentType, documentDate, registrationEntry.entryType),
          documentType: input.documentType,
          registrationEntryType: registrationEntry.entryType,
          paymentMethod: input.documentType === 'purchase' ? input.paymentMethod || 'custody' : null,
          documentDate,
          status: input.documentType === 'purchase' ? 'prepared' : 'received',
          sectionId: input.sectionId || null,
          locationId: location.id,
          pettyCashAmount,
          subtotal: signedSubtotal,
          totalAmount: signedSubtotal,
          operationalCost: initialOperationalCost,
          notes: input.notes?.trim() || null,
          idempotencyKey: input.idempotencyKey.trim(),
          requestHash: inputRequestHash,
          calculationVersion: 1,
          calculationSnapshot: {
            kernelVersion: 4,
            owner: 'orders-v4-calculation-kernel',
            lineCount: prepared.length,
            subtotal: signedSubtotal.toString(),
            totalAmount: signedSubtotal.toString(),
            operationalCost: initialOperationalCost.toString(),
          },
          createdByUserId: userId,
        },
      });

      let registrationOperationalCost = new Prisma.Decimal(0);
      for (const row of prepared) {
        const lineDirection = new Prisma.Decimal(1);
        const createdLine = await tx.ordersV4DocumentLine.create({
          data: {
            tenantId,
            companyId,
            documentId: document.id,
            itemId: row.item.id,
            lineNumber: row.index + 1,
            itemNameSnapshot: row.item.nameAr,
            inputQuantity: row.calculation.inputQuantity.times(lineDirection),
            inputUnitId: row.line.unitId,
            baseQuantity: row.calculation.baseQuantity.times(lineDirection),
            baseUnitId: row.item.kernelUnitId,
            unitPrice: row.calculation.unitPrice,
            priceUnitId: row.priceUnitId,
            priceQuantity: row.calculation.priceQuantity.times(lineDirection),
            lineTotal: row.calculation.lineTotal.times(lineDirection),
            operationalCost: input.documentType === 'purchase' ? row.calculation.lineTotal : new Prisma.Decimal(0),
            conversionVersionId: row.definition?.id || null,
            recipeVersionId: row.recipe?.id || null,
            cancellationReasons: isRegistrationCancellation ? row.line.cancellationReasons ?? [] : undefined,
            cancellationNote: isRegistrationCancellation ? row.line.cancellationNote?.trim() || null : null,
            conversionSnapshot: {
              input: ordersV4ConversionSnapshot(row.calculation.inputConversion),
              price: ordersV4ConversionSnapshot(row.calculation.priceConversion),
            },
            calculationSnapshot: {
              kernelVersion: 4,
              inputQuantity: row.calculation.inputQuantity.toString(),
              baseQuantity: row.calculation.baseQuantity.toString(),
              priceQuantity: row.calculation.priceQuantity.toString(),
              unitPrice: row.calculation.unitPrice.toString(),
              lineTotal: row.calculation.lineTotal.toString(),
              registrationEntryType: registrationEntry.entryType,
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
              if (isRegistrationCancellation) {
                await this.posting.postRegistrationCancellation(tx, {
                  tenantId, companyId, itemId: component.componentItem.id, inventoryUnitId: component.componentItem.kernelUnitId, locationId: location.id,
                  documentLineId: createdLine.id, sourceId: document.id,
                  sourceKey: `document:${document.id}:line:${createdLine.id}:recipe:${component.id}:cancellation`,
                  effectiveAt: documentDate, quantity: issueQuantity, unitCost: averageLastFive,
                  conversionVersionId: componentDefinition?.id || null, recipeVersionId: row.recipe.id,
                  sourceSnapshot: {
                    documentNumber: document.documentNumber, lineNumber: row.index + 1,
                    recipeVersion: row.recipe.version, componentLineId: component.id, kernelVersion: 4,
                    cancellationReasons: row.line.cancellationReasons ?? [],
                  },
                });
              } else await this.posting.postIssue(tx, {
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
            const lineOperationalCost = recipeCost.times(lineDirection).toDecimalPlaces(6);
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
            const currentBalance = isRegistrationCancellation
              ? await this.posting.currentBalance(tx, companyId, row.item.id, location.id, row.item.kernelUnitId)
              : null;
            const issueEntry = isRegistrationCancellation
              ? await this.posting.postRegistrationCancellation(tx, {
                tenantId, companyId, itemId: row.item.id, inventoryUnitId: row.item.kernelUnitId, locationId: location.id,
                documentLineId: createdLine.id, sourceId: document.id,
                sourceKey: `document:${document.id}:line:${createdLine.id}:cancellation`,
                effectiveAt: documentDate, quantity: row.calculation.baseQuantity,
                unitCost: currentBalance?.averageUnitCost ?? new Prisma.Decimal(0),
                conversionVersionId: row.definition?.id || null, recipeVersionId: null,
                sourceSnapshot: { documentNumber: document.documentNumber, lineNumber: row.index + 1, kernelVersion: 4, cancellationReasons: row.line.cancellationReasons ?? [] },
              })
              : await this.posting.postIssue(tx, {
              tenantId, companyId, itemId: row.item.id, inventoryUnitId: row.item.kernelUnitId, locationId: location.id,
              documentLineId: createdLine.id, sourceId: document.id,
              sourceKey: `document:${document.id}:line:${createdLine.id}:issue`,
              effectiveAt: documentDate, quantity: row.calculation.baseQuantity,
              conversionVersionId: row.definition?.id || null,
              recipeVersionId: null,
              sourceSnapshot: { documentNumber: document.documentNumber, lineNumber: row.index + 1, kernelVersion: 4 },
            });
            const lineOperationalCost = issueEntry.valueDelta.abs().times(lineDirection).toDecimalPlaces(6);
            registrationOperationalCost = registrationOperationalCost.plus(lineOperationalCost);
            await tx.ordersV4DocumentLine.update({
              where: { id: createdLine.id },
              data: {
                operationalCost: lineOperationalCost,
                costSnapshot: {
                  policy: 'moving-average-inventory-cost',
                  totalCost: lineOperationalCost.toString(),
                  costPerRegisteredUnit: calculateOrdersV4AverageUnitCost(lineOperationalCost.abs(), row.calculation.inputQuantity).toString(),
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
              subtotal: signedSubtotal.toString(),
              totalAmount: signedSubtotal.toString(),
              operationalCost: operationalCost.toString(),
              costPolicy: 'line-cost-snapshots',
              registrationEntryType: registrationEntry.entryType,
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

  async receivePurchase(companyId: string, id: string, input: OrdersV4ReceiveInput, access: OrdersV4ReopenAccess = 'owner') {
    if (!input.idempotencyKey?.trim()) throw new BadRequestException('مفتاح منع التكرار مطلوب');
    if (!input.lines?.length) throw new BadRequestException('يجب تسجيل صنف مستلم واحد على الأقل');
    if (new Set(input.lines.map((line) => line.itemId)).size !== input.lines.length) {
      throw new BadRequestException('لا يمكن تكرار الصنف نفسه في الاستلام؛ عدّل الكمية في السطر الموجود');
    }
    if (!Number.isInteger(input.revision) || input.revision < 1) throw new BadRequestException('رقم مراجعة الطلب غير صالح');
    const tenantId = TenantContext.getTenantId();
    const userId = TenantContext.getUserId();
    const receivedDate = ordersV4DateOnly(input.documentDate, 'تاريخ الاستلام');
    const receiveRequestHash = ordersV4RequestHash({
      documentId: id,
      editMode: input.editMode === 'correction' ? 'correction' : 'standard',
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
    const correctionMode = input.editMode === 'correction';
    const correctionRequestHash = ordersV4RequestHash({ operation: 'correct-received-purchase', documentId: id, receiveRequestHash });
    const receiveOperationKeyHash = ordersV4OperationKeyHash('receive-purchase', input.idempotencyKey);

    return this.prisma.withTenant(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ordersV4PurchaseWindowLockKey(companyId)}))`;
      const replay = await readOrdersV4OperationReplay(tx, tenantId, companyId, receiveOperationKeyHash);
      if (replay) {
        if (replay.requestHash !== receiveRequestHash) {
          throw new BadRequestException('مفتاح منع تكرار الاستلام مستخدم لطلب أو محتوى مختلف');
        }
        return replay.response;
      }
      const persistReceiveReplay = (response: unknown) => persistOrdersV4OperationReplay(
        tx, tenantId, companyId, receiveOperationKeyHash, receiveRequestHash, response,
      );
      let targetId = id;
      let receivedFromRevision = input.revision;
      let correctionSnapshot: Prisma.InputJsonObject = {};
      let inheritedPaymentMethod: 'custody' | 'cash' | 'transfer' | null = null;
      let inheritedPettyCashAmount: Prisma.Decimal | null = null;
      let correctionOriginal: OrdersV4CorrectionPreparation['original'] = null;

      if (correctionMode) {
        const correction = await this.purchaseCorrection.prepareInTransaction(tx, input, {
          tenantId,
          companyId,
          userId,
          documentId: id,
          receivedDate,
          correctionRequestHash,
          access,
        });
        if (correction.duplicate) return correction.duplicate;
        targetId = correction.targetId;
        receivedFromRevision = correction.receivedFromRevision;
        correctionSnapshot = correction.correctionSnapshot;
        inheritedPaymentMethod = correction.inheritedPaymentMethod;
        inheritedPettyCashAmount = correction.inheritedPettyCashAmount;
        correctionOriginal = correction.original;
      } else {
        const purchase = await tx.ordersV4Document.findFirst({
          where: { id, companyId, documentType: 'purchase', reversalOfId: null },
        });
        if (!purchase) throw new BadRequestException('طلب الشراء غير موجود');
        const previousSnapshot = purchase.calculationSnapshot as Record<string, unknown>;
        if (purchase.status === 'received' && previousSnapshot.receiveIdempotencyKey === input.idempotencyKey.trim()) {
          if (previousSnapshot.receiveRequestHash !== receiveRequestHash) {
            throw new BadRequestException('مفتاح منع تكرار الاستلام مستخدم لمحتوى مختلف');
          }
          const result = await tx.ordersV4Document.findUniqueOrThrow({
            where: { id },
            include: { section: true, location: true, lines: { include: { item: true, inputUnit: true, baseUnit: true, priceUnit: true }, orderBy: { lineNumber: 'asc' } } },
          });
          await persistReceiveReplay(result);
          return result;
        }
        if (access === 'cashier') {
          const recentPurchases = await tx.ordersV4Document.findMany(ordersV4CashierRecentEditablePurchasesQuery(companyId));
          if (!isOrdersV4CashierEditEligible(purchase.id, recentPurchases.map((document) => document.id))) {
            throw new BadRequestException(`يمكن للكاشير تعديل أو استلام آخر ${ORDERS_V4_CASHIER_EDIT_LIMIT} طلبات فقط`);
          }
        } else if (!isOrdersV4ReopenDateEligible(purchase.documentDate)) {
          const recentPurchases = await tx.ordersV4Document.findMany(ordersV4CashierRecentEditablePurchasesQuery(companyId));
          if (!isOrdersV4OwnerEditEligible(purchase.id, purchase.documentDate, recentPurchases.map((document) => document.id))) {
            throw new BadRequestException(`الاستلام متاح خلال آخر ${ORDERS_V4_REOPEN_WINDOW_DAYS} أيام أو ضمن آخر ${ORDERS_V4_CASHIER_EDIT_LIMIT} طلبات`);
          }
        }
        if (purchase.status !== 'prepared') throw new BadRequestException('الطلب ليس في حالة انتظار الاستلام');
        if (purchase.revision !== input.revision) throw new BadRequestException('تم تعديل الطلب؛ أعد تحميله قبل الاستلام');
        receivedFromRevision = purchase.revision;
      }
      const correctionEffect = await this.purchaseCorrection.loadEffectInTransaction(tx, companyId, correctionOriginal);
      const correctionInventoryEntries = correctionEffect.inventoryEntries;
      const correctionCustodyEntries = correctionEffect.custodyEntries;
      const location = await tx.ordersV4Location.findFirst({ where: { id: input.locationId, companyId, isActive: true } });
      if (!location) throw new BadRequestException('موقع المخزون غير موجود');
      const requestedItemIds = [...new Set(input.lines.map((line) => line.itemId))];
      const itemIds = [...new Set([...requestedItemIds, ...correctionInventoryEntries.map((entry) => entry.itemId)])];
      const items = await tx.ordersV4Item.findMany({
        where: { companyId, id: { in: itemIds }, itemType: 'purchased' },
        include: { units: true, sections: true, conversionVersions: {
          where: { status: 'published' }, include: { edges: true }, orderBy: { version: 'desc' }, take: 1,
        } },
      });
      if (items.length !== itemIds.length) throw new BadRequestException('أحد أصناف الاستلام أو نسخته السابقة غير صالح');
      const activeRequestedIds = new Set(items.filter((item) => item.isActive).map((item) => item.id));
      if (requestedItemIds.some((itemId) => !activeRequestedIds.has(itemId))) throw new BadRequestException('أحد أصناف الاستلام غير موجود أو غير فعال');
      const units = await tx.ordersV4Unit.findMany({ where: correctionMode ? { companyId } : { companyId, isActive: true } });
      const unitDefinitions = ordersV4UnitDefinitions(units);
      const itemById = new Map(items.map((item) => [item.id, item]));
      const prepared = input.lines.map((line, index) => {
        const item = itemById.get(line.itemId);
        if (!item) throw new BadRequestException('صنف الاستلام غير موجود');
        if (input.sectionId && !item.sections.some((entry) => entry.sectionId === input.sectionId)) {
          throw new BadRequestException(`${item.nameAr}: الصنف غير مرتبط بالقسم المختار`);
        }
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
      const paymentMethod = input.paymentMethod || inheritedPaymentMethod || 'custody';
      if (!['custody', 'cash', 'transfer'].includes(paymentMethod)) throw new BadRequestException('طريقة الدفع غير صالحة');
      let pettyCashAmount: Prisma.Decimal | null = null;
      if (paymentMethod === 'custody' && input.pettyCashAmount != null && input.pettyCashAmount !== '') {
        try {
          pettyCashAmount = new Prisma.Decimal(input.pettyCashAmount);
        } catch {
          throw new BadRequestException('مبلغ العهدة غير صالح');
        }
      } else if (paymentMethod === 'custody') {
        pettyCashAmount = inheritedPettyCashAmount;
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

      const inventoryLocks = prepared.filter((row) => row.item.trackInventory)
        .map((row) => ({ itemId: row.item.id, locationId: location.id }));
      inventoryLocks.push(...correctionInventoryEntries
        .map((entry) => ({ itemId: entry.itemId, locationId: entry.locationId })));
      await this.posting.lockKeys(tx, companyId, inventoryLocks);
      await tx.ordersV4DocumentLine.deleteMany({ where: { documentId: targetId } });
      const calculationSnapshot: Prisma.InputJsonObject = {
        kernelVersion: 4,
        owner: 'orders-v4-calculation-kernel',
        receivedFromRevision,
        receiveIdempotencyKey: input.idempotencyKey.trim(),
        receiveRequestHash,
        lineCount: prepared.length,
        subtotal: subtotal.toString(),
        operationalCost: subtotal.toString(),
        ...correctionSnapshot,
      };
      await tx.ordersV4Document.update({
        where: { id: targetId },
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

      await this.purchaseCorrection.reverseInventoryInTransaction(tx, {
        tenantId, companyId, targetId, effectiveAt: receivedDate, entries: correctionInventoryEntries, items, units,
      });

      for (const row of prepared) {
        const line = await tx.ordersV4DocumentLine.create({
          data: {
            tenantId, companyId, documentId: targetId, itemId: row.item.id, lineNumber: row.index + 1,
            itemNameSnapshot: row.item.nameAr,
            inputQuantity: row.calculation.inputQuantity, inputUnitId: row.line.unitId,
            baseQuantity: row.calculation.baseQuantity, baseUnitId: row.item.kernelUnitId, unitPrice: row.calculation.unitPrice,
            priceUnitId: row.priceUnitId, priceQuantity: row.calculation.priceQuantity,
            lineTotal: row.calculation.lineTotal, conversionVersionId: row.definition?.id || null,
            operationalCost: row.calculation.lineTotal,
            conversionSnapshot: {
              input: ordersV4ConversionSnapshot(row.calculation.inputConversion),
              price: ordersV4ConversionSnapshot(row.calculation.priceConversion),
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
            documentId: targetId, documentLineId: line.id, unitPrice: row.calculation.unitPrice,
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
            sourceId: targetId, sourceKey: `document:${targetId}:line:${line.id}:receipt`, effectiveAt: receivedDate,
            quantity: row.calculation.baseQuantity, totalValue: row.calculation.lineTotal,
            conversionVersionId: row.definition?.id || null,
            sourceSnapshot: {
              kernelVersion: 4,
              lineNumber: row.index + 1,
              receivedByUserId: userId,
              ...(correctionOriginal ? {
                policy: 'atomic-reverse-and-repost-on-save',
                correctedFromDocumentId: correctionOriginal.id,
              } : {}),
            },
          });
        }
      }

      await this.purchaseCorrection.reverseCustodyInTransaction(tx, {
        tenantId, companyId, targetId, effectiveAt: receivedDate, entries: correctionCustodyEntries,
      });
      if (paymentMethod === 'custody') {
        await this.fundsPosting.postPurchase(tx, {
          tenantId, companyId, documentId: targetId, effectiveAt: receivedDate,
          purchaseAmount: subtotal, fundingAmount: pettyCashAmount,
        });
      }

      await this.purchaseCorrection.refreshHistoricalPricesInTransaction(tx, companyId, correctionOriginal);

      const result = await tx.ordersV4Document.findUniqueOrThrow({
        where: { id: targetId },
        include: { section: true, location: true, lines: { include: { item: true, inputUnit: true, baseUnit: true, priceUnit: true }, orderBy: { lineNumber: 'asc' } } },
      });
      await persistReceiveReplay(result);
      return result;
    });
  }

  reverse(companyId: string, id: string, idempotencyKey: string) {
    return this.reversal.reverse(companyId, id, idempotencyKey);
  }

  undoReverse(companyId: string, id: string, idempotencyKey: string) {
    return this.reversal.undoReverse(companyId, id, idempotencyKey);
  }

  reopenPurchase(companyId: string, id: string, idempotencyKey: string, access: OrdersV4ReopenAccess = 'owner') {
    return this.reversal.reopenPurchase(companyId, id, idempotencyKey, access);
  }
}
