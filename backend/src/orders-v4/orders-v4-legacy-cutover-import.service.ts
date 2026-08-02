import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContext } from '../common/tenant-context';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { resolveProductUnitMultiplierOrNull } from '../orders/orders-unit-conversions.util';
import { OrdersV4FundsPostingService } from './orders-v4-funds-posting.service';
import { OrdersV4LedgerPostingService } from './orders-v4-ledger-posting.service';
import { OrdersV4LegacyCutoverService } from './orders-v4-legacy-cutover.service';
import {
  legacyConversionRows,
  legacyJsonStringArray,
  legacyPaymentMethod,
  legacyRecipeRows,
  legacyStableHash,
  legacyTargetId,
  legacyUnitDefinition,
  legacyUnitKey,
  legacyVariantRows,
} from './orders-v4-legacy-cutover.mapping';

const CUTOVER_CONFIRMATION = 'IMPORT_LEGACY_ORDERS_TO_V4';
const CUTOVER_TIMEOUT_MS = 300_000;

function sum(values: Prisma.Decimal.Value[]): Prisma.Decimal {
  return values.reduce<Prisma.Decimal>((total, value) => total.plus(value), new Prisma.Decimal(0));
}

function dateOnly(value: Date): Date {
  return new Date(`${value.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

function normalizedName(value: string): string {
  return value.trim().toLocaleLowerCase('ar');
}

function sectionCode(id: string): string {
  return `legacy-${legacyStableHash(id).slice(0, 12)}`;
}

function parseConsumptionSnapshot(value: unknown): Array<{ productId: string; quantity: Prisma.Decimal }> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const components = (value as Record<string, unknown>).components;
  if (!Array.isArray(components) || components.length === 0) return null;
  const parsed = components.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const row = entry as Record<string, unknown>;
    const productId = String(row.materialProductId ?? '').trim();
    try {
      const quantity = new Prisma.Decimal(String(row.quantityBase ?? ''));
      return productId && quantity.gte(0) ? [{ productId, quantity }] : [];
    } catch {
      return [];
    }
  });
  return parsed.length === components.length ? parsed : null;
}

@Injectable()
export class OrdersV4LegacyCutoverImportService {
  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly auditService: OrdersV4LegacyCutoverService,
    private readonly fundsPosting: OrdersV4FundsPostingService,
    private readonly ledgerPosting: OrdersV4LedgerPostingService,
  ) {}

  async execute(companyId: string, input: { confirmation?: string; sourceFingerprint?: string }) {
    if (input.confirmation !== CUTOVER_CONFIRMATION) throw new BadRequestException('رمز تأكيد ترحيل V4 غير صحيح');
    const expectedFingerprint = String(input.sourceFingerprint ?? '').trim();
    const preflight = await this.auditService.audit(companyId);
    if (!preflight.ready) throw new BadRequestException('المصدر غير جاهز للترحيل؛ عالج المشكلات المانعة أولًا');
    if (!expectedFingerprint || expectedFingerprint !== preflight.sourceFingerprint) {
      throw new BadRequestException('تغيرت بيانات المصدر بعد التدقيق؛ أعد التدقيق قبل الترحيل');
    }

    const tenantId = TenantContext.getTenantId();
    const userId = TenantContext.getUserId();
    const runId = `orders-v4-cutover-${Date.now()}-${legacyStableHash(expectedFingerprint).slice(0, 8)}`;
    const executedAt = new Date();

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`orders-v4:legacy-cutover:${companyId}`}))`;
      await tx.$executeRawUnsafe(`LOCK TABLE order_categories, order_sections, order_catalog_units, order_products, orders, order_items, staff_orders, staff_order_items, inventory_movements IN SHARE MODE`);

      const company = await tx.company.findFirst({ where: { id: companyId, tenantId }, select: { id: true } });
      if (!company) throw new BadRequestException('الشركة غير موجودة');
      const [categories, sections, catalogUnits, legacyLocations, products, orders, staffOrders, adjustments] = await Promise.all([
        tx.orderCategory.findMany({ where: { companyId }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] }),
        tx.orderSection.findMany({ where: { companyId }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] }),
        tx.orderCatalogUnit.findMany({ where: { companyId }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] }),
        tx.inventoryLocationV2.findMany({ where: { companyId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }),
        tx.orderProduct.findMany({
          where: { companyId }, include: { conversionTemplate: { select: { conversions: true } } },
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        }),
        tx.order.findMany({
          where: { companyId }, include: { items: { orderBy: { id: 'asc' } } },
          orderBy: [{ orderDate: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        }),
        tx.staffOrder.findMany({
          where: { companyId, orderType: 'sale' }, include: { items: { orderBy: { id: 'asc' } } },
          orderBy: [{ saleDate: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        }),
        tx.inventoryMovement.groupBy({ by: ['productId'], where: { companyId }, _sum: { quantityBase: true } }),
      ]);

      const activeOrders = orders.filter((order) => order.status === 'active');
      const staffIssues = staffOrders.filter((order) => order.entryType === 'issue');
      const sourceFingerprint = legacyStableHash({
        categories: categories.map((row) => [row.id, row.updatedAt]),
        sections: sections.map((row) => [row.id, row.updatedAt]),
        products: products.map((row) => [row.id, row.updatedAt]),
        activeOrders: [...activeOrders].sort((a, b) => a.id.localeCompare(b.id)).map((row) => [row.id, row.totalAmount.toString()]),
        staffIssues: [...staffIssues].sort((a, b) => a.id.localeCompare(b.id)).map((row) => row.id),
      });
      if (sourceFingerprint !== expectedFingerprint) {
        throw new BadRequestException('تغير المصدر أثناء بدء الترحيل؛ لم يتم حذف أو استيراد أي بيانات');
      }

      const productById = new Map(products.map((product) => [product.id, product]));
      const purchaseProducts = products.filter((product) => product.productType === 'order');
      const saleProducts = products.filter((product) => product.productType === 'sale');
      const averageCostByProduct = this.averageCosts(activeOrders);
      const quantityByProduct = new Map(purchaseProducts.map((product) => [product.id, new Prisma.Decimal(0)]));
      for (const order of activeOrders) {
        for (const line of order.items) {
          if (!quantityByProduct.has(line.productId)) continue;
          const base = line.inventoryBaseQuantitySnapshot ?? line.quantity.times(line.quantityMultiplier);
          quantityByProduct.set(line.productId, quantityByProduct.get(line.productId)!.plus(base));
        }
      }
      for (const staffOrder of staffOrders.filter((row) => row.status === 'sent')) {
        for (const line of staffOrder.items) {
          const snapshot = parseConsumptionSnapshot(line.inventoryConsumptionSnapshot);
          const components = snapshot ?? this.estimatedConsumption(line, productById);
          for (const component of components) {
            if (!quantityByProduct.has(component.productId)) continue;
            quantityByProduct.set(component.productId, quantityByProduct.get(component.productId)!.minus(component.quantity));
          }
        }
      }
      for (const adjustment of adjustments) {
        if (!quantityByProduct.has(adjustment.productId)) continue;
        quantityByProduct.set(adjustment.productId, quantityByProduct.get(adjustment.productId)!.plus(adjustment._sum.quantityBase ?? 0));
      }

      const unitMetadata = new Map<string, { nameAr?: string | null; nameEn?: string | null }>();
      for (const code of ['piece', 'kg', 'g', 'l', 'ml', 'pack', 'box', 'carton']) unitMetadata.set(code, {});
      for (const unit of catalogUnits) unitMetadata.set(legacyUnitKey(unit.code || unit.nameAr), { nameAr: unit.nameAr, nameEn: unit.nameEn });
      const registerUnit = (value: unknown, fallback = 'piece') => {
        const key = legacyUnitKey(value, fallback);
        if (key && !unitMetadata.has(key)) unitMetadata.set(key, { nameAr: String(value ?? key).trim() || key });
        return key;
      };
      for (const product of products) {
        registerUnit(product.unit);
        for (const variant of legacyVariantRows(product.variants)) registerUnit(variant.unitKey);
        for (const conversion of legacyConversionRows(product.inventoryConversions, product.conversionTemplate?.conversions)) {
          registerUnit(conversion.fromUnitKey); registerUnit(conversion.toUnitKey);
        }
        for (const recipe of legacyRecipeRows(product.recipe)) registerUnit(recipe.unitKey);
      }
      for (const order of orders) for (const line of order.items) registerUnit(line.unit || line.packaging);
      for (const order of staffOrders) for (const line of order.items) registerUnit(line.unit || line.packaging);

      const unitIdByKey = new Map([...unitMetadata.keys()].map((key) => [key, legacyTargetId('unit', key)]));
      const categoryIdBySource = new Map<string, string>();
      const categoryTargetByName = new Map<string, string>();
      for (const category of categories) {
        const key = normalizedName(category.nameAr);
        const targetId = categoryTargetByName.get(key) ?? legacyTargetId('category', key);
        categoryTargetByName.set(key, targetId);
        categoryIdBySource.set(category.id, targetId);
      }
      const sectionIdBySource = new Map(sections.map((section) => [section.id, legacyTargetId('section', section.id)]));
      const sectionIdByName = new Map(sections.map((section) => [normalizedName(section.nameAr), sectionIdBySource.get(section.id)!]));
      const itemIdBySource = new Map(products.map((product) => [product.id, legacyTargetId('item', product.id)]));

      await this.purgeTarget(tx, companyId);
      await tx.ordersV4Unit.createMany({ data: [...unitMetadata.entries()].map(([key, metadata], index) => ({
        id: unitIdByKey.get(key)!, tenantId, companyId, ...legacyUnitDefinition(key, metadata.nameAr, metadata.nameEn), sortOrder: index * 10,
      })) });
      await tx.ordersV4Category.createMany({ data: [...categoryTargetByName.entries()].map(([key, id]) => {
        const source = categories.find((category) => normalizedName(category.nameAr) === key)!;
        return { id, tenantId, companyId, nameAr: source.nameAr, nameEn: source.nameEn, isActive: categories.some((category) => categoryIdBySource.get(category.id) === id && category.isActive), sortOrder: source.sortOrder };
      }) });
      await tx.ordersV4Section.createMany({ data: sections.map((section) => ({
        id: sectionIdBySource.get(section.id)!, tenantId, companyId, code: sectionCode(section.id), nameAr: section.nameAr,
        nameEn: section.nameEn, sortOrder: section.sortOrder, isActive: true,
      })) });

      const mainLocationId = legacyTargetId('location', 'main');
      const locationIdBySource = new Map(legacyLocations.map((location) => [location.id, legacyTargetId('location', location.id)]));
      await tx.ordersV4Location.createMany({ data: [
        { id: mainLocationId, tenantId, companyId, code: 'main', nameAr: 'المخزون الرئيسي', nameEn: 'Main inventory', kind: 'warehouse', sectionId: null, isActive: true },
        ...legacyLocations.filter((location) => location.code !== 'main').map((location) => ({
          id: locationIdBySource.get(location.id)!, tenantId, companyId, code: `legacy-${legacyStableHash(location.id).slice(0, 12)}`,
          nameAr: location.nameAr, nameEn: location.nameEn, kind: location.kind, sectionId: location.orderSectionId ? sectionIdBySource.get(location.orderSectionId) ?? null : null,
          isActive: location.isActive,
        })),
      ] });

      const validRecipes = new Map<string, ReturnType<typeof legacyRecipeRows>>();
      for (const product of saleProducts) {
        const rows = legacyRecipeRows(product.recipe);
        const valid = rows.length > 0 && rows.every((row) => {
          const material = productById.get(row.materialProductId);
          return material?.productType === 'order' && resolveProductUnitMultiplierOrNull(material, row.unitKey, material.unit) != null;
        });
        if (valid) validRecipes.set(product.id, rows);
      }
      await tx.ordersV4Item.createMany({ data: products.map((product) => {
        const baseKey = legacyUnitKey(product.unit);
        return {
          id: itemIdBySource.get(product.id)!, tenantId, companyId, sku: null, nameAr: product.nameAr, nameEn: product.nameEn,
          itemType: product.productType === 'sale' ? 'sale' : 'purchased', categoryId: product.categoryId ? categoryIdBySource.get(product.categoryId) ?? null : null,
          inventoryUnitId: unitIdByKey.get(baseKey)!, kernelUnitId: unitIdByKey.get(baseKey)!, trackInventory: product.productType === 'order',
          isActive: product.isActive, sortOrder: product.sortOrder,
        };
      }) });

      const itemUnits: Prisma.OrdersV4ItemUnitCreateManyInput[] = [];
      for (const product of products) {
        const itemId = itemIdBySource.get(product.id)!;
        const baseKey = legacyUnitKey(product.unit);
        const definitions = new Map<string, { label: string | null; price: Prisma.Decimal | null; enabled: boolean }>();
        definitions.set(baseKey, { label: null, price: product.lastPrice, enabled: true });
        for (const variant of legacyVariantRows(product.variants)) definitions.set(variant.unitKey, { label: variant.label, price: variant.lastPrice, enabled: true });
        for (const conversion of legacyConversionRows(product.inventoryConversions, product.conversionTemplate?.conversions)) {
          if (!definitions.has(conversion.fromUnitKey)) definitions.set(conversion.fromUnitKey, { label: null, price: null, enabled: true });
          if (!definitions.has(conversion.toUnitKey)) definitions.set(conversion.toUnitKey, { label: null, price: null, enabled: true });
        }
        for (const [unitKey, definition] of definitions) itemUnits.push({
          id: legacyTargetId('item-unit', `${product.id}:${unitKey}`), tenantId, companyId, itemId, unitId: unitIdByKey.get(unitKey)!,
          purchaseLabel: definition.label, isOrderEnabled: definition.enabled, lastPrice: definition.price, isActive: true, sortOrder: itemUnits.length,
        });
      }
      await tx.ordersV4ItemUnit.createMany({ data: itemUnits });

      const itemSections: Prisma.OrdersV4ItemSectionCreateManyInput[] = [];
      for (const product of products) {
        const ids = legacyJsonStringArray(product.sectionIds);
        const names = legacyJsonStringArray(product.sections);
        const targetIds = new Set([
          ...ids.map((id) => sectionIdBySource.get(id)).filter((id): id is string => Boolean(id)),
          ...names.map((name) => sectionIdByName.get(normalizedName(name))).filter((id): id is string => Boolean(id)),
        ]);
        for (const sectionId of targetIds) itemSections.push({ id: legacyTargetId('item-section', `${product.id}:${sectionId}`), tenantId, companyId, itemId: itemIdBySource.get(product.id)!, sectionId });
      }
      if (itemSections.length) await tx.ordersV4ItemSection.createMany({ data: itemSections, skipDuplicates: true });

      const conversionVersionIdByProduct = new Map<string, string>();
      const conversionEdges: Prisma.OrdersV4ConversionEdgeCreateManyInput[] = [];
      await tx.ordersV4ConversionVersion.createMany({ data: products.map((product) => {
        const rows = legacyConversionRows(product.inventoryConversions, product.conversionTemplate?.conversions);
        const id = legacyTargetId('conversion', product.id); conversionVersionIdByProduct.set(product.id, id);
        rows.forEach((row, index) => conversionEdges.push({
          id: legacyTargetId('conversion-edge', `${product.id}:${row.fromUnitKey}:${row.toUnitKey}`), tenantId, companyId, versionId: id,
          fromUnitId: unitIdByKey.get(row.fromUnitKey)!, toUnitId: unitIdByKey.get(row.toUnitKey)!, factor: row.factor,
          reversible: true, allowDimensionBridge: legacyUnitDefinition(row.fromUnitKey).dimension !== legacyUnitDefinition(row.toUnitKey).dimension, sortOrder: index,
        }));
        return { id, tenantId, companyId, itemId: itemIdBySource.get(product.id)!, version: 1, status: 'published', contentHash: legacyStableHash(rows.map((row) => [row.fromUnitKey, row.toUnitKey, row.factor.toString()])), publishedAt: executedAt, createdByUserId: userId };
      }) });
      if (conversionEdges.length) await tx.ordersV4ConversionEdge.createMany({ data: conversionEdges });

      const recipeVersionIdByProduct = new Map<string, string>();
      const recipeLines: Prisma.OrdersV4RecipeLineCreateManyInput[] = [];
      if (validRecipes.size) {
        await tx.ordersV4RecipeVersion.createMany({ data: [...validRecipes.entries()].map(([productId, rows]) => {
          const id = legacyTargetId('recipe', productId); recipeVersionIdByProduct.set(productId, id);
          rows.forEach((row, index) => recipeLines.push({
            id: legacyTargetId('recipe-line', `${productId}:${row.materialProductId}:${index}`), tenantId, companyId, recipeVersionId: id,
            componentItemId: itemIdBySource.get(row.materialProductId)!, quantity: row.quantity, unitId: unitIdByKey.get(row.unitKey)!, sortOrder: index,
          }));
          const outputUnitId = unitIdByKey.get(legacyUnitKey(productById.get(productId)!.unit))!;
          return { id, tenantId, companyId, outputItemId: itemIdBySource.get(productId)!, outputQuantity: new Prisma.Decimal(1), outputUnitId, version: 1, status: 'published', contentHash: legacyStableHash(rows.map((row) => [row.materialProductId, row.quantity.toString(), row.unitKey])), publishedAt: executedAt, createdByUserId: userId };
        }) });
        await tx.ordersV4RecipeLine.createMany({ data: recipeLines });
      }

      const documentRows: Prisma.OrdersV4DocumentCreateManyInput[] = [];
      const documentLines: Prisma.OrdersV4DocumentLineCreateManyInput[] = [];
      const priceHistory: Prisma.OrdersV4PriceHistoryCreateManyInput[] = [];
      const documentIdByOrder = new Map<string, string>();
      for (const order of orders) {
        const documentId = legacyTargetId('purchase-document', order.id); documentIdByOrder.set(order.id, documentId);
        const paymentMethod = legacyPaymentMethod(order.orderType);
        documentRows.push({
          id: documentId, tenantId, companyId, documentNumber: `LEGACY-${order.orderNumber}`, documentType: 'purchase',
          status: order.status === 'active' ? 'received' : 'reversed', paymentMethod, documentDate: dateOnly(order.orderDate),
          locationId: mainLocationId, pettyCashAmount: paymentMethod === 'custody' ? order.pettyCashAmount : null,
          subtotal: order.totalAmount, totalAmount: order.totalAmount, operationalCost: order.totalAmount, notes: order.notes,
          revision: 1, idempotencyKey: `legacy-order:${order.id}`, requestHash: legacyStableHash(order.id),
          calculationVersion: 4, calculationSnapshot: { kernelVersion: 4, sourceSystem: 'legacy-orders', sourceId: order.id, migrationRunId: runId },
          receivedAt: order.status === 'active' ? order.updatedAt : null, createdAt: order.createdAt, updatedAt: order.updatedAt,
        });
        order.items.forEach((line, index) => {
          const product = productById.get(line.productId)!;
          const inputKey = legacyUnitKey(line.unit || line.packaging, product.unit);
          const baseKey = legacyUnitKey(product.unit);
          const baseQuantity = line.inventoryBaseQuantitySnapshot ?? line.quantity.times(line.quantityMultiplier);
          const lineId = legacyTargetId('purchase-line', line.id);
          documentLines.push({
            id: lineId, tenantId, companyId, documentId, itemId: itemIdBySource.get(line.productId)!, lineNumber: index + 1,
            itemNameSnapshot: product.nameAr, inputQuantity: line.quantity, inputUnitId: unitIdByKey.get(inputKey)!, baseQuantity,
            baseUnitId: unitIdByKey.get(baseKey)!, unitPrice: line.unitPrice, priceUnitId: unitIdByKey.get(inputKey)!, priceQuantity: line.quantity,
            lineTotal: line.amount, operationalCost: line.amount, conversionVersionId: conversionVersionIdByProduct.get(line.productId),
            conversionSnapshot: { sourceSystem: 'legacy-orders', quantityMultiplier: line.quantityMultiplier.toString(), inventoryBaseQuantitySnapshot: line.inventoryBaseQuantitySnapshot?.toString() ?? null },
            calculationSnapshot: { kernelVersion: 4, sourceLineId: line.id, migrationRunId: runId }, createdAt: order.createdAt,
          });
          if (order.status === 'active' && baseQuantity.gt(0)) priceHistory.push({
            id: legacyTargetId('price', line.id), tenantId, companyId, itemId: itemIdBySource.get(line.productId)!, unitId: unitIdByKey.get(inputKey)!,
            inventoryUnitId: unitIdByKey.get(baseKey)!, documentId, documentLineId: lineId, unitPrice: line.unitPrice,
            inventoryUnitPrice: line.amount.div(baseQuantity), conversionVersionId: conversionVersionIdByProduct.get(line.productId), effectiveAt: order.orderDate, createdAt: order.createdAt,
          });
        });
      }

      const documentIdByStaffOrder = new Map<string, string>();
      for (const staffOrder of staffOrders) {
        if (staffOrder.entryType !== 'issue') continue;
        const documentId = legacyTargetId('registration-document', staffOrder.id); documentIdByStaffOrder.set(staffOrder.id, documentId);
        const documentDate = dateOnly(staffOrder.saleDate ?? staffOrder.createdAt);
        const sectionId = sectionIdByName.get(normalizedName(staffOrder.sectionName)) ?? null;
        let totalAmount = new Prisma.Decimal(0);
        let operationalCost = new Prisma.Decimal(0);
        staffOrder.items.forEach((line, index) => {
          const product = productById.get(line.productId)!;
          const inputKey = legacyUnitKey(line.unit || line.packaging, product.unit);
          const baseKey = legacyUnitKey(product.unit);
          const baseQuantity = line.quantity.times(line.quantityMultiplier);
          const lineTotal = line.quantity.times(line.unitPrice);
          const components = parseConsumptionSnapshot(line.inventoryConsumptionSnapshot) ?? this.estimatedConsumption(line, productById);
          const lineCost = sum(components.map((component) => component.quantity.times(averageCostByProduct.get(component.productId) ?? 0)));
          totalAmount = totalAmount.plus(lineTotal); operationalCost = operationalCost.plus(lineCost);
          documentLines.push({
            id: legacyTargetId('registration-line', line.id), tenantId, companyId, documentId, itemId: itemIdBySource.get(line.productId)!, lineNumber: index + 1,
            itemNameSnapshot: product.nameAr, inputQuantity: line.quantity, inputUnitId: unitIdByKey.get(inputKey)!, baseQuantity,
            baseUnitId: unitIdByKey.get(baseKey)!, unitPrice: line.unitPrice, priceUnitId: unitIdByKey.get(inputKey)!, priceQuantity: line.quantity,
            lineTotal, operationalCost: lineCost, conversionVersionId: conversionVersionIdByProduct.get(line.productId), recipeVersionId: recipeVersionIdByProduct.get(line.productId),
            conversionSnapshot: { sourceSystem: 'legacy-orders', quantityMultiplier: line.quantityMultiplier.toString() },
            recipeSnapshot: { sourceSystem: 'legacy-orders', hasConsumptionSnapshot: Boolean(parseConsumptionSnapshot(line.inventoryConsumptionSnapshot)) },
            costSnapshot: { policy: 'simple-average-last-5-received-purchase-orders', totalCost: lineCost.toString() },
            calculationSnapshot: { kernelVersion: 4, sourceLineId: line.id, migrationRunId: runId }, createdAt: line.createdAt,
          });
        });
        documentRows.push({
          id: documentId, tenantId, companyId, documentNumber: `LEGACY-${staffOrder.logRef || staffOrder.id}`,
          documentType: 'registration', status: 'received', paymentMethod: null, documentDate, sectionId, locationId: mainLocationId,
          subtotal: totalAmount, totalAmount, operationalCost, notes: staffOrder.notes, revision: 1,
          idempotencyKey: `legacy-staff-order:${staffOrder.id}`, requestHash: legacyStableHash(staffOrder.id), calculationVersion: 4,
          calculationSnapshot: { kernelVersion: 4, sourceSystem: 'legacy-orders', sourceId: staffOrder.id, migrationRunId: runId },
          receivedAt: staffOrder.sentAt ?? staffOrder.updatedAt, receivedByUserId: staffOrder.userId, createdByUserId: staffOrder.userId,
          updatedByUserId: staffOrder.userId, createdAt: staffOrder.createdAt, updatedAt: staffOrder.updatedAt,
        });
      }
      if (documentRows.length) await tx.ordersV4Document.createMany({ data: documentRows });
      if (documentLines.length) await tx.ordersV4DocumentLine.createMany({ data: documentLines });
      if (priceHistory.length) await tx.ordersV4PriceHistory.createMany({ data: priceHistory });

      for (const order of activeOrders.filter((row) => legacyPaymentMethod(row.orderType) === 'custody')) {
        await this.fundsPosting.postPurchase(tx, {
          tenantId, companyId, documentId: documentIdByOrder.get(order.id)!, effectiveAt: order.orderDate,
          purchaseAmount: order.totalAmount, fundingAmount: order.pettyCashAmount,
        });
      }
      const openingRows: Array<{ productId: string; quantity: Prisma.Decimal; value: Prisma.Decimal }> = [];
      for (const product of purchaseProducts) {
        const quantity = quantityByProduct.get(product.id) ?? new Prisma.Decimal(0);
        const value = quantity.times(averageCostByProduct.get(product.id) ?? 0).toDecimalPlaces(6);
        if (quantity.isZero() && value.isZero()) continue;
        openingRows.push({ productId: product.id, quantity, value });
        await this.ledgerPosting.postCutoverOpening(tx, {
          tenantId, companyId, itemId: itemIdBySource.get(product.id)!, inventoryUnitId: unitIdByKey.get(legacyUnitKey(product.unit))!,
          locationId: mainLocationId, sourceId: product.id, sourceKey: `legacy-cutover:${runId}:product:${product.id}`,
          effectiveAt: executedAt, quantity, value,
          sourceSnapshot: { kernelVersion: 4, sourceSystem: 'legacy-orders-projected-stock', sourceProductId: product.id, migrationRunId: runId, costPolicy: 'simple-average-last-5-active-purchase-orders' },
        });
      }

      const migrationMaps: Prisma.OrdersV4MigrationMapCreateManyInput[] = [
        ...categories.map((row) => this.mapRow(tenantId, companyId, runId, 'OrderCategory', row.id, 'OrdersV4Category', categoryIdBySource.get(row.id)!, row)),
        ...sections.map((row) => this.mapRow(tenantId, companyId, runId, 'OrderSection', row.id, 'OrdersV4Section', sectionIdBySource.get(row.id)!, row)),
        ...catalogUnits.map((row) => this.mapRow(tenantId, companyId, runId, 'OrderCatalogUnit', row.id, 'OrdersV4Unit', unitIdByKey.get(legacyUnitKey(row.code || row.nameAr))!, row)),
        ...products.map((row) => this.mapRow(tenantId, companyId, runId, 'OrderProduct', row.id, 'OrdersV4Item', itemIdBySource.get(row.id)!, row)),
        ...orders.map((row) => this.mapRow(tenantId, companyId, runId, 'Order', row.id, 'OrdersV4Document', documentIdByOrder.get(row.id)!, { id: row.id, totalAmount: row.totalAmount.toString(), status: row.status })),
        ...staffOrders.map((row) => this.mapRow(tenantId, companyId, runId, 'StaffOrder', row.id, row.entryType === 'issue' ? 'OrdersV4Document' : 'SkippedCancellation', row.entryType === 'issue' ? documentIdByStaffOrder.get(row.id)! : runId, { id: row.id, entryType: row.entryType, status: row.status })),
        ...openingRows.map((row) => this.mapRow(tenantId, companyId, runId, 'InventoryCutoverBalance', row.productId, 'OrdersV4InventoryLedgerEntry', itemIdBySource.get(row.productId)!, { quantity: row.quantity.toString(), value: row.value.toString() })),
      ];
      await tx.ordersV4MigrationMap.createMany({ data: migrationMaps });

      const [purchaseTarget, registrationTarget, custodyTarget, inventoryTarget, mappingCount] = await Promise.all([
        tx.ordersV4Document.aggregate({ where: { companyId, documentType: 'purchase', status: 'received' }, _count: { _all: true }, _sum: { totalAmount: true } }),
        tx.ordersV4Document.aggregate({ where: { companyId, documentType: 'registration', status: 'received' }, _count: { _all: true }, _sum: { totalAmount: true, operationalCost: true } }),
        tx.ordersV4CustodyLedgerEntry.findFirst({ where: { companyId }, orderBy: { sequence: 'desc' }, select: { balanceAfter: true } }),
        tx.ordersV4InventoryLedgerEntry.aggregate({ where: { companyId }, _count: { _all: true }, _sum: { quantityAfter: true, valueAfter: true } }),
        tx.ordersV4MigrationMap.count({ where: { companyId, migrationRunId: runId, status: 'verified' } }),
      ]);
      const sourcePurchaseTotal = sum(activeOrders.map((order) => order.totalAmount));
      const sourceRegistrationTotal = sum(staffIssues.flatMap((order) => order.items.map((line) => line.quantity.times(line.unitPrice))));
      const sourceCustody = sum(activeOrders.filter((order) => legacyPaymentMethod(order.orderType) === 'custody').map((order) => order.pettyCashAmount ?? 0))
        .minus(sum(activeOrders.filter((order) => legacyPaymentMethod(order.orderType) === 'custody').map((order) => order.totalAmount)));
      const sourceInventoryQuantity = sum(openingRows.map((row) => row.quantity));
      const sourceInventoryValue = sum(openingRows.map((row) => row.value));
      const checks = {
        purchaseDocuments: purchaseTarget._count._all === activeOrders.length,
        purchaseTotal: new Prisma.Decimal(purchaseTarget._sum.totalAmount ?? 0).eq(sourcePurchaseTotal),
        registrationDocuments: registrationTarget._count._all === staffIssues.length,
        registrationTotal: new Prisma.Decimal(registrationTarget._sum.totalAmount ?? 0).eq(sourceRegistrationTotal),
        custodyBalance: new Prisma.Decimal(custodyTarget?.balanceAfter ?? 0).eq(sourceCustody),
        inventoryQuantity: new Prisma.Decimal(inventoryTarget._sum.quantityAfter ?? 0).eq(sourceInventoryQuantity),
        inventoryValue: new Prisma.Decimal(inventoryTarget._sum.valueAfter ?? 0).eq(sourceInventoryValue),
        mappings: mappingCount === migrationMaps.length,
      };
      if (Object.values(checks).some((passed) => !passed)) throw new Error(`Orders V4 cutover reconciliation failed: ${JSON.stringify(checks)}`);

      return {
        cutover: 'legacy-orders-to-v4', runId, executedAt: executedAt.toISOString(), sourceFingerprint,
        passed: true, checks,
        source: {
          categories: categories.length, uniqueCategories: categoryTargetByName.size, sections: sections.length, units: catalogUnits.length,
          purchasedItems: purchaseProducts.length, saleItems: saleProducts.length, activePurchaseDocuments: activeOrders.length,
          registrationDocuments: staffIssues.length, purchaseTotal: sourcePurchaseTotal.toString(), registrationTotal: sourceRegistrationTotal.toString(),
          custodyBalance: sourceCustody.toString(), inventoryBalances: openingRows.length, inventoryQuantity: sourceInventoryQuantity.toString(), inventoryValue: sourceInventoryValue.toString(),
        },
        target: {
          purchaseDocuments: purchaseTarget._count._all, purchaseTotal: purchaseTarget._sum.totalAmount?.toString() ?? '0',
          registrationDocuments: registrationTarget._count._all, registrationTotal: registrationTarget._sum.totalAmount?.toString() ?? '0',
          registrationOperationalCost: registrationTarget._sum.operationalCost?.toString() ?? '0', custodyBalance: custodyTarget?.balanceAfter.toString() ?? '0',
          inventoryEntries: inventoryTarget._count._all, inventoryQuantity: inventoryTarget._sum.quantityAfter?.toString() ?? '0', inventoryValue: inventoryTarget._sum.valueAfter?.toString() ?? '0', verifiedMappings: mappingCount,
        },
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: CUTOVER_TIMEOUT_MS, maxWait: 20_000 });
  }

  private averageCosts(orders: Array<{ id: string; orderDate: Date; createdAt: Date; items: Array<{ productId: string; amount: Prisma.Decimal; quantity: Prisma.Decimal; quantityMultiplier: Prisma.Decimal; inventoryBaseQuantitySnapshot: Prisma.Decimal | null }> }>) {
    const samples = new Map<string, Array<{ orderId: string; cost: Prisma.Decimal }>>();
    for (const order of [...orders].sort((a, b) => b.orderDate.getTime() - a.orderDate.getTime() || b.createdAt.getTime() - a.createdAt.getTime())) {
      for (const line of order.items) {
        const base = line.inventoryBaseQuantitySnapshot ?? line.quantity.times(line.quantityMultiplier);
        if (!base.gt(0)) continue;
        const rows = samples.get(line.productId) ?? [];
        if (!rows.some((row) => row.orderId === order.id) && rows.length < 5) rows.push({ orderId: order.id, cost: line.amount.div(base) });
        samples.set(line.productId, rows);
      }
    }
    return new Map([...samples.entries()].map(([productId, rows]) => [productId, sum(rows.map((row) => row.cost)).div(rows.length).toDecimalPlaces(8)]));
  }

  private estimatedConsumption(line: { productId: string; quantity: Prisma.Decimal; quantityMultiplier: Prisma.Decimal }, productById: Map<string, { id: string; unit: string; recipe: Prisma.JsonValue | null; inventoryConversions: Prisma.JsonValue | null; conversionTemplate: { conversions: Prisma.JsonValue | null } | null }>) {
    const saleProduct = productById.get(line.productId);
    if (!saleProduct) return [];
    const batches = line.quantity.times(line.quantityMultiplier);
    return legacyRecipeRows(saleProduct.recipe).flatMap((recipe) => {
      const material = productById.get(recipe.materialProductId);
      if (!material) return [];
      const factor = resolveProductUnitMultiplierOrNull(material, recipe.unitKey, material.unit);
      return factor ? [{ productId: recipe.materialProductId, quantity: batches.times(recipe.quantity).times(factor) }] : [];
    });
  }

  private mapRow(tenantId: string, companyId: string, runId: string, sourceEntity: string, sourceId: string, targetEntity: string, targetId: string, source: unknown): Prisma.OrdersV4MigrationMapCreateManyInput {
    return { id: legacyTargetId('migration-map', `${sourceEntity}:${sourceId}`), tenantId, companyId, sourceSystem: 'legacy-orders', sourceEntity, sourceId, targetEntity, targetId, sourceChecksum: legacyStableHash(source), migrationRunId: runId, status: 'verified', detail: { migrationRunId: runId } };
  }

  private async purgeTarget(tx: Prisma.TransactionClient, companyId: string): Promise<void> {
    await tx.ordersV4MigrationMap.deleteMany({ where: { companyId } });
    await tx.ordersV4StocktakeLine.deleteMany({ where: { companyId } });
    await tx.ordersV4Stocktake.deleteMany({ where: { companyId } });
    await tx.ordersV4CustodyLedgerEntry.deleteMany({ where: { companyId } });
    await tx.ordersV4InventoryLedgerEntry.deleteMany({ where: { companyId } });
    await tx.ordersV4PriceHistory.deleteMany({ where: { companyId } });
    await tx.ordersV4DocumentLine.deleteMany({ where: { companyId } });
    await tx.ordersV4Document.deleteMany({ where: { companyId } });
    await tx.ordersV4RecipeLine.deleteMany({ where: { companyId } });
    await tx.ordersV4RecipeVersion.deleteMany({ where: { companyId } });
    await tx.ordersV4ConversionEdge.deleteMany({ where: { companyId } });
    await tx.ordersV4ConversionVersion.deleteMany({ where: { companyId } });
    await tx.ordersV4ItemSection.deleteMany({ where: { companyId } });
    await tx.ordersV4ItemUnit.deleteMany({ where: { companyId } });
    await tx.ordersV4Item.deleteMany({ where: { companyId } });
    await tx.ordersV4Location.deleteMany({ where: { companyId } });
    await tx.ordersV4Section.deleteMany({ where: { companyId } });
    await tx.ordersV4Category.deleteMany({ where: { companyId } });
    await tx.ordersV4Unit.deleteMany({ where: { companyId } });
  }
}
