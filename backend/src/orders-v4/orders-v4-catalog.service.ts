import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { TenantContext } from '../common/tenant-context';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import type {
  OrdersV4ConversionPublishInput,
  OrdersV4ItemInput,
  OrdersV4ItemUnitsInput,
  OrdersV4NamedInput,
  OrdersV4RecipePublishInput,
  OrdersV4UnitInput,
} from './orders-v4.contracts';
import { resolveOrdersV4Conversion, validateOrdersV4ConversionDefinition } from './orders-v4-conversion.kernel';
import type { OrdersV4ConversionEdgeDefinition, OrdersV4UnitDefinition } from './orders-v4-kernel.types';
import { OrdersV4LedgerPostingService } from './orders-v4-ledger-posting.service';
import {
  calculateOrdersV4ConvertedQuantity,
  calculateOrdersV4ConvertedUnitPrice,
  calculateOrdersV4LastFiveAverage,
  calculateOrdersV4RecipeComponentCost,
} from './orders-v4-calculation.kernel';

const DEFAULT_UNITS: Array<OrdersV4UnitInput & { sortOrder: number }> = [
  { code: 'piece', nameAr: 'حبة', nameEn: 'Piece', dimension: 'count', canonicalFactor: '1', decimalScale: 3, sortOrder: 10 },
  { code: 'kg', nameAr: 'كيلوجرام', nameEn: 'Kilogram', dimension: 'mass', canonicalFactor: '1000', decimalScale: 6, sortOrder: 20 },
  { code: 'g', nameAr: 'جرام', nameEn: 'Gram', dimension: 'mass', canonicalFactor: '1', decimalScale: 6, sortOrder: 30 },
  { code: 'l', nameAr: 'لتر', nameEn: 'Liter', dimension: 'volume', canonicalFactor: '1000', decimalScale: 6, sortOrder: 40 },
  { code: 'ml', nameAr: 'ملليلتر', nameEn: 'Milliliter', dimension: 'volume', canonicalFactor: '1', decimalScale: 6, sortOrder: 50 },
  { code: 'pack', nameAr: 'باكيت', nameEn: 'Pack', dimension: 'package', canonicalFactor: null, decimalScale: 4, sortOrder: 60 },
  { code: 'carton', nameAr: 'كرتون', nameEn: 'Carton', dimension: 'package', canonicalFactor: null, decimalScale: 4, sortOrder: 70 },
];

function normalizedText(value: unknown, label: string): string {
  const text = String(value ?? '').trim();
  if (!text) throw new BadRequestException(`${label} مطلوب`);
  return text;
}

function slugCode(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
}

function stableHash(value: object): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function decimalInput(value: Prisma.Decimal.Value, label: string): Prisma.Decimal {
  try {
    const parsed = new Prisma.Decimal(value);
    if (!parsed.isFinite()) throw new Error('not finite');
    return parsed;
  } catch {
    throw new BadRequestException(`${label} غير صالح`);
  }
}

function positiveDecimal(value: Prisma.Decimal.Value, label: string): Prisma.Decimal {
  const parsed = decimalInput(value, label);
  if (parsed.lte(0)) throw new BadRequestException(`${label} يجب أن يكون أكبر من صفر`);
  return parsed;
}

function unitDefinition(unit: {
  id: string;
  code: string;
  dimension: string;
  canonicalFactor: Prisma.Decimal | null;
}): OrdersV4UnitDefinition {
  return {
    id: unit.id,
    code: unit.code,
    dimension: unit.dimension,
    canonicalFactor: unit.canonicalFactor,
  };
}

@Injectable()
export class OrdersV4CatalogService {
  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly posting: OrdersV4LedgerPostingService,
  ) {}

  async ensureFoundation(companyId: string): Promise<void> {
    const tenantId = TenantContext.getTenantId();
    await this.prisma.withTenant(async (tx) => {
      await tx.ordersV4Unit.createMany({
        data: DEFAULT_UNITS.map((unit) => ({
          tenantId,
          companyId,
          code: unit.code,
          nameAr: unit.nameAr,
          nameEn: unit.nameEn,
          dimension: unit.dimension,
          canonicalFactor: unit.canonicalFactor ? new Prisma.Decimal(unit.canonicalFactor) : null,
          decimalScale: unit.decimalScale,
          sortOrder: unit.sortOrder,
        })),
        skipDuplicates: true,
      });
      await tx.ordersV4Section.createMany({
        data: [{ tenantId, companyId, code: 'general', nameAr: 'عام', nameEn: 'General', sortOrder: 10 }],
        skipDuplicates: true,
      });
      await tx.ordersV4Location.createMany({
        data: [{ tenantId, companyId, code: 'main', nameAr: 'المخزون الرئيسي', nameEn: 'Main inventory', kind: 'warehouse' }],
        skipDuplicates: true,
      });
    });
  }

  async getBootstrap(companyId: string) {
    await this.ensureFoundation(companyId);
    const [units, categories, sections, items, locations, conversions, recipes] = await Promise.all([
      this.prisma.ordersV4Unit.findMany({ where: { companyId }, orderBy: [{ sortOrder: 'asc' }, { nameAr: 'asc' }] }),
      this.prisma.ordersV4Category.findMany({ where: { companyId }, orderBy: [{ sortOrder: 'asc' }, { nameAr: 'asc' }] }),
      this.prisma.ordersV4Section.findMany({ where: { companyId }, orderBy: [{ sortOrder: 'asc' }, { nameAr: 'asc' }] }),
      this.prisma.ordersV4Item.findMany({
        where: { companyId },
        include: {
          inventoryUnit: true,
          category: true,
          units: { include: { unit: true }, orderBy: { sortOrder: 'asc' } },
          sections: { include: { section: true } },
        },
        orderBy: [{ sortOrder: 'asc' }, { nameAr: 'asc' }],
      }),
      this.prisma.ordersV4Location.findMany({ where: { companyId }, include: { section: true }, orderBy: { nameAr: 'asc' } }),
      this.prisma.ordersV4ConversionVersion.findMany({
        where: { companyId, status: 'published' },
        include: { edges: { include: { fromUnit: true, toUnit: true }, orderBy: { sortOrder: 'asc' } }, item: true },
        orderBy: [{ item: { nameAr: 'asc' } }, { version: 'desc' }],
      }),
      this.prisma.ordersV4RecipeVersion.findMany({
        where: { companyId, status: 'published' },
        include: {
          outputItem: true,
          outputUnit: true,
          lines: {
            include: {
              componentItem: {
                include: {
                  inventoryUnit: true,
                  conversionVersions: { where: { status: 'published' }, include: { edges: true }, orderBy: { version: 'desc' }, take: 1 },
                },
              },
              unit: true,
            },
            orderBy: { sortOrder: 'asc' },
          },
        },
        orderBy: [{ outputItem: { nameAr: 'asc' } }, { version: 'desc' }],
      }),
    ]);
    const componentIds = [...new Set(recipes.flatMap((recipe) => recipe.lines.map((line) => line.componentItemId)))];
    const priceRows = componentIds.length
      ? await this.prisma.ordersV4PriceHistory.findMany({
          where: { companyId, itemId: { in: componentIds }, document: { status: 'received' } },
          orderBy: [{ effectiveAt: 'desc' }, { createdAt: 'desc' }],
          select: { itemId: true, inventoryUnitPrice: true, inventoryUnitId: true },
        })
      : [];
    const normalizedUnits = units.map(unitDefinition);
    const recipesWithCost = recipes.map((recipe) => {
      const components = recipe.lines.map((line) => {
        const definition = line.componentItem.conversionVersions[0];
        const conversion = resolveOrdersV4Conversion({
          fromUnitId: line.unitId,
          toUnitId: line.componentItem.inventoryUnitId,
          units: normalizedUnits,
          edges: definition?.edges ?? [],
        });
        const samples = priceRows.filter((price) => price.itemId === line.componentItemId).slice(0, 5);
        const normalizedPrices = samples.map((price) => calculateOrdersV4ConvertedUnitPrice(
          price.inventoryUnitPrice,
          resolveOrdersV4Conversion({
            fromUnitId: price.inventoryUnitId,
            toUnitId: line.componentItem.inventoryUnitId,
            units: normalizedUnits,
            edges: definition?.edges ?? [],
          }),
        ));
        const averageLastFive = calculateOrdersV4LastFiveAverage(normalizedPrices);
        const issueQuantity = calculateOrdersV4ConvertedQuantity(line.quantity, conversion);
        const cost = calculateOrdersV4RecipeComponentCost(issueQuantity, averageLastFive);
        return { componentItemId: line.componentItemId, averageLastFive, sampleCount: samples.length, cost };
      });
      const estimatedCost = components.reduce((sum, line) => sum.plus(line.cost), new Prisma.Decimal(0)).toDecimalPlaces(6);
      return { ...recipe, estimatedCost, costPolicy: 'simple-average-last-5-received-purchase-orders', costComponents: components };
    });
    return { units, categories, sections, items, locations, conversions, recipes: recipesWithCost, kernelVersion: 4 };
  }

  /** Minimal catalog exposed to an employee whose only job is internal registration. */
  async getInternalRegistrationBootstrap(companyId: string) {
    const bootstrap = await this.getBootstrap(companyId);
    const items = bootstrap.items.filter((item) => item.itemType === 'sale');
    const unitIds = new Set(items.flatMap((item) => item.units.map((entry) => entry.unitId)));
    const categoryIds = new Set(items.map((item) => item.categoryId).filter(Boolean));
    return {
      units: bootstrap.units.filter((unit) => unitIds.has(unit.id)),
      categories: bootstrap.categories.filter((category) => categoryIds.has(category.id)),
      sections: bootstrap.sections,
      items,
      locations: bootstrap.locations,
      conversions: [],
      recipes: [],
      kernelVersion: 4,
      scope: 'internal-registration' as const,
    };
  }

  async createUnit(companyId: string, input: OrdersV4UnitInput) {
    const tenantId = TenantContext.getTenantId();
    const code = slugCode(normalizedText(input.code, 'رمز الوحدة'));
    if (!code) throw new BadRequestException('رمز الوحدة غير صالح');
    const dimension = slugCode(normalizedText(input.dimension, 'بُعد الوحدة'));
    const canonicalFactor = input.canonicalFactor == null || input.canonicalFactor === ''
      ? null
      : positiveDecimal(input.canonicalFactor, 'المعامل القياسي');
    return this.prisma.ordersV4Unit.create({
      data: {
        tenantId,
        companyId,
        code,
        nameAr: normalizedText(input.nameAr, 'اسم الوحدة'),
        nameEn: input.nameEn?.trim() || null,
        dimension,
        canonicalFactor,
        decimalScale: Math.max(0, Math.min(8, Number(input.decimalScale ?? 6))),
      },
    });
  }

  async createCategory(companyId: string, input: OrdersV4NamedInput) {
    return this.prisma.ordersV4Category.create({
      data: {
        tenantId: TenantContext.getTenantId(), companyId,
        nameAr: normalizedText(input.nameAr, 'اسم الفئة'),
        nameEn: input.nameEn?.trim() || null,
        sortOrder: Number(input.sortOrder ?? 0),
      },
    });
  }

  async createSection(companyId: string, input: OrdersV4NamedInput) {
    const nameAr = normalizedText(input.nameAr, 'اسم القسم');
    const code = slugCode(input.code?.trim() || nameAr) || `section-${Date.now()}`;
    return this.prisma.ordersV4Section.create({
      data: {
        tenantId: TenantContext.getTenantId(), companyId, code, nameAr,
        nameEn: input.nameEn?.trim() || null,
        sortOrder: Number(input.sortOrder ?? 0),
      },
    });
  }

  async createLocation(companyId: string, input: OrdersV4NamedInput & { kind?: string; sectionId?: string | null }) {
    const nameAr = normalizedText(input.nameAr, 'اسم الموقع');
    const code = slugCode(input.code?.trim() || nameAr) || `location-${Date.now()}`;
    if (input.sectionId) await this.requireSection(companyId, input.sectionId);
    return this.prisma.ordersV4Location.create({
      data: {
        tenantId: TenantContext.getTenantId(), companyId, code, nameAr,
        nameEn: input.nameEn?.trim() || null,
        kind: input.kind?.trim() || 'warehouse',
        sectionId: input.sectionId || null,
      },
    });
  }

  async createItem(companyId: string, input: OrdersV4ItemInput) {
    const tenantId = TenantContext.getTenantId();
    const itemType = input.itemType;
    if (!['purchased', 'sale'].includes(itemType)) throw new BadRequestException('نوع الصنف غير صالح');
    await this.requireUnit(companyId, input.inventoryUnitId);
    if (input.categoryId) await this.requireCategory(companyId, input.categoryId);
    const sectionIds = [...new Set(input.sectionIds ?? [])];
    for (const sectionId of sectionIds) await this.requireSection(companyId, sectionId);
    const configuredUnits = input.units?.length
      ? input.units
      : [{ unitId: input.inventoryUnitId, isOrderEnabled: itemType === 'purchased', sortOrder: 0 }];
    if (!configuredUnits.some((row) => row.unitId === input.inventoryUnitId)) {
      configuredUnits.unshift({ unitId: input.inventoryUnitId, isOrderEnabled: itemType === 'purchased', sortOrder: 0 });
    }
    if (new Set(configuredUnits.map((row) => row.unitId)).size !== configuredUnits.length) {
      throw new BadRequestException('لا يمكن تكرار الوحدة في بطاقة الصنف');
    }
    for (const row of configuredUnits) await this.requireUnit(companyId, row.unitId);
    return this.prisma.ordersV4Item.create({
      data: {
        tenantId,
        companyId,
        sku: input.sku?.trim() || null,
        nameAr: normalizedText(input.nameAr, 'اسم الصنف'),
        nameEn: input.nameEn?.trim() || null,
        itemType,
        categoryId: input.categoryId || null,
        inventoryUnitId: input.inventoryUnitId,
        trackInventory: input.trackInventory !== false,
        sortOrder: Number(input.sortOrder ?? 0),
        sections: sectionIds.length
          ? { create: sectionIds.map((sectionId) => ({ tenantId, companyId, sectionId })) }
          : undefined,
        units: {
          create: configuredUnits.map((row, index) => ({
            tenantId,
            companyId,
            unitId: row.unitId,
            isOrderEnabled: row.isOrderEnabled === true,
            lastPrice: row.lastPrice == null || row.lastPrice === '' ? null : positiveDecimal(row.lastPrice, 'السعر'),
            sortOrder: Number(row.sortOrder ?? index),
          })),
        },
      },
      include: {
        inventoryUnit: true,
        category: true,
        units: { include: { unit: true }, orderBy: { sortOrder: 'asc' } },
        sections: { include: { section: true } },
      },
    });
  }

  async replaceItemUnits(companyId: string, itemId: string, input: OrdersV4ItemUnitsInput) {
    if (!input.units?.length) throw new BadRequestException('يجب إضافة وحدة واحدة على الأقل');
    const rows = [...input.units];
    if (!rows.some((row) => row.unitId === input.inventoryUnitId)) {
      rows.unshift({ unitId: input.inventoryUnitId, isOrderEnabled: false, sortOrder: 0 });
    }
    if (new Set(rows.map((row) => row.unitId)).size !== rows.length) throw new BadRequestException('لا يمكن تكرار الوحدة');
    const normalizedRows = rows.map((row, index) => ({
      unitId: row.unitId,
      isOrderEnabled: row.isOrderEnabled === true,
      lastPrice: row.lastPrice == null || row.lastPrice === '' ? null : positiveDecimal(row.lastPrice, 'السعر'),
      sortOrder: Number(row.sortOrder ?? index),
    }));
    const tenantId = TenantContext.getTenantId();
    return this.prisma.withTenant(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`orders-v4:item-units:${itemId}`}))`;
      const item = await tx.ordersV4Item.findFirst({
        where: { id: itemId, companyId, isActive: true },
        include: {
          units: true,
          conversionVersions: {
            where: { status: 'published' },
            orderBy: { version: 'desc' },
            take: 1,
            include: { edges: true },
          },
        },
      });
      if (!item) throw new NotFoundException('الصنف غير موجود');

      const companyUnits = await tx.ordersV4Unit.findMany({ where: { companyId, isActive: true } });
      const nextUnitIds = new Set(normalizedRows.map((row) => row.unitId));
      if (companyUnits.filter((unit) => nextUnitIds.has(unit.id)).length !== nextUnitIds.size) {
        throw new BadRequestException('إحدى الوحدات لا تنتمي إلى الشركة أو غير نشطة');
      }

      const [documentUnits, priceUnits, ledgerUnits, recipeInputUnits, recipeOutputUnits] = await Promise.all([
        tx.ordersV4DocumentLine.findMany({
          where: { companyId, itemId },
          select: { inputUnitId: true, priceUnitId: true, baseUnitId: true },
        }),
        tx.ordersV4PriceHistory.findMany({
          where: { companyId, itemId },
          select: { unitId: true, inventoryUnitId: true },
        }),
        tx.ordersV4InventoryLedgerEntry.findMany({
          where: { companyId, itemId },
          select: { inventoryUnitId: true },
        }),
        tx.ordersV4RecipeLine.findMany({
          where: { companyId, componentItemId: itemId },
          select: { unitId: true },
        }),
        tx.ordersV4RecipeVersion.findMany({
          where: { companyId, outputItemId: itemId },
          select: { outputUnitId: true },
        }),
      ]);
      const protectedUnitIds = new Set<string>([
        item.inventoryUnitId,
        ...item.conversionVersions.flatMap((version) => version.edges.flatMap((edge) => [edge.fromUnitId, edge.toUnitId])),
        ...documentUnits.flatMap((row) => [row.inputUnitId, row.priceUnitId, row.baseUnitId]),
        ...priceUnits.flatMap((row) => [row.unitId, row.inventoryUnitId]),
        ...ledgerUnits.map((row) => row.inventoryUnitId),
        ...recipeInputUnits.map((row) => row.unitId),
        ...recipeOutputUnits.map((row) => row.outputUnitId),
      ]);
      if ([...protectedUnitIds].some((unitId) => !nextUnitIds.has(unitId))) {
        throw new BadRequestException('لا يمكن حذف وحدة مستخدمة في مستند أو سعر أو مخزون أو رسبي؛ يمكن إيقافها للطلبات مع إبقائها في بطاقة الصنف');
      }

      if (item.inventoryUnitId !== input.inventoryUnitId) {
        if (!nextUnitIds.has(item.inventoryUnitId)) {
          throw new BadRequestException('يجب إبقاء وحدة المخزون السابقة لحماية السجل التاريخي والتحويلات');
        }
        const definitions = companyUnits.map(unitDefinition);
        const currentVersion = item.conversionVersions[0];
        const currentEdges: OrdersV4ConversionEdgeDefinition[] = (currentVersion?.edges ?? []).map((edge) => ({
          id: edge.id,
          fromUnitId: edge.fromUnitId,
          toUnitId: edge.toUnitId,
          factor: edge.factor,
          reversible: edge.reversible,
          allowDimensionBridge: edge.allowDimensionBridge,
        }));
        const oldToNewConversion = resolveOrdersV4Conversion({
          fromUnitId: item.inventoryUnitId,
          toUnitId: input.inventoryUnitId,
          units: definitions,
          edges: currentEdges,
        });
        const normalizedEdges = currentEdges.map((edge) => ({
          fromUnitId: edge.fromUnitId,
          toUnitId: edge.toUnitId,
          factor: edge.factor.toString(),
          reversible: edge.reversible,
          allowDimensionBridge: edge.allowDimensionBridge,
        }));
        const contentHash = stableHash({
          itemId,
          inventoryUnitId: input.inventoryUnitId,
          predecessorVersionId: currentVersion?.id ?? null,
          edges: normalizedEdges,
        });
        const latest = await tx.ordersV4ConversionVersion.aggregate({ where: { itemId }, _max: { version: true } });
        await tx.ordersV4ConversionVersion.updateMany({
          where: { itemId, status: 'published' },
          data: { status: 'retired', retiredAt: new Date() },
        });
        const conversionVersion = await tx.ordersV4ConversionVersion.create({
          data: {
            tenantId,
            companyId,
            itemId,
            version: (latest._max.version ?? 0) + 1,
            status: 'published',
            contentHash,
            publishedAt: new Date(),
            createdByUserId: TenantContext.getUserId(),
            edges: normalizedEdges.length ? {
              create: normalizedEdges.map((edge, index) => ({
                tenantId,
                companyId,
                ...edge,
                factor: new Prisma.Decimal(edge.factor),
                sortOrder: index,
              })),
            } : undefined,
          },
        });
        const locations = await tx.ordersV4InventoryLedgerEntry.findMany({
          where: { companyId, itemId },
          select: { locationId: true },
          distinct: ['locationId'],
        });
        const changedAt = new Date();
        for (const { locationId } of locations.sort((a, b) => a.locationId.localeCompare(b.locationId))) {
          await this.posting.postUnitRebase(tx, {
            tenantId,
            companyId,
            itemId,
            locationId,
            effectiveAt: changedAt,
            oldInventoryUnitId: item.inventoryUnitId,
            newInventoryUnitId: input.inventoryUnitId,
            conversionVersionId: conversionVersion.id,
            conversion: oldToNewConversion,
          });
        }
      }

      await tx.ordersV4ItemUnit.deleteMany({ where: { companyId, itemId } });
      await tx.ordersV4Item.update({ where: { id: itemId }, data: { inventoryUnitId: input.inventoryUnitId } });
      await tx.ordersV4ItemUnit.createMany({
        data: normalizedRows.map((row) => ({
          tenantId,
          companyId,
          itemId,
          ...row,
        })),
      });
      return tx.ordersV4Item.findUniqueOrThrow({
        where: { id: itemId },
        include: { inventoryUnit: true, units: { include: { unit: true }, orderBy: { sortOrder: 'asc' } } },
      });
    });
  }

  async publishConversion(companyId: string, input: OrdersV4ConversionPublishInput) {
    const tenantId = TenantContext.getTenantId();
    if (!input.edges?.length) throw new BadRequestException('نسخة التحويل يجب أن تحتوي على مسار واحد على الأقل');
    const item = await this.prisma.ordersV4Item.findFirst({ where: { id: input.itemId, companyId }, include: { units: true } });
    if (!item) throw new NotFoundException('صنف V4 غير موجود');
    const units = await this.prisma.ordersV4Unit.findMany({ where: { companyId, isActive: true } });
    const definitions = units.map(unitDefinition);
    const definitionEdges: OrdersV4ConversionEdgeDefinition[] = input.edges.map((edge, index) => ({
      id: `candidate-${index + 1}`,
      fromUnitId: edge.fromUnitId,
      toUnitId: edge.toUnitId,
      factor: positiveDecimal(edge.factor, `معامل التحويل رقم ${index + 1}`),
      reversible: edge.reversible !== false,
      allowDimensionBridge: edge.allowDimensionBridge === true,
    }));
    validateOrdersV4ConversionDefinition(definitions, definitionEdges);
    for (const unitId of [item.inventoryUnitId, ...definitionEdges.flatMap((edge) => [edge.fromUnitId, edge.toUnitId])]) {
      if (!units.some((unit) => unit.id === unitId)) throw new BadRequestException('وحدة التحويل لا تنتمي إلى الشركة');
      if (!item.units.some((row) => row.unitId === unitId && row.isActive)) throw new BadRequestException('وحدة التحويل غير مضافة إلى بطاقة الصنف');
    }
    for (const unitId of new Set(definitionEdges.flatMap((edge) => [edge.fromUnitId, edge.toUnitId]))) {
      resolveOrdersV4Conversion({ fromUnitId: unitId, toUnitId: item.inventoryUnitId, units: definitions, edges: definitionEdges });
    }
    const normalized = definitionEdges.map((edge) => ({
      fromUnitId: edge.fromUnitId,
      toUnitId: edge.toUnitId,
      factor: edge.factor.toString(),
      reversible: edge.reversible,
      allowDimensionBridge: edge.allowDimensionBridge,
    }));
    const contentHash = stableHash({ itemId: item.id, inventoryUnitId: item.inventoryUnitId, edges: normalized });
    return this.prisma.withTenant(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`orders-v4:conversion:${item.id}`}))`;
      const existingHash = await tx.ordersV4ConversionVersion.findFirst({ where: { itemId: item.id, contentHash } });
      if (existingHash) return existingHash;
      const latest = await tx.ordersV4ConversionVersion.aggregate({ where: { itemId: item.id }, _max: { version: true } });
      await tx.ordersV4ConversionVersion.updateMany({
        where: { itemId: item.id, status: 'published' },
        data: { status: 'retired', retiredAt: new Date() },
      });
      return tx.ordersV4ConversionVersion.create({
        data: {
          tenantId, companyId, itemId: item.id,
          version: (latest._max.version ?? 0) + 1,
          status: 'published', contentHash, publishedAt: new Date(),
          createdByUserId: TenantContext.getUserId(),
          edges: {
            create: normalized.map((edge, index) => ({
              tenantId, companyId, ...edge, factor: new Prisma.Decimal(edge.factor), sortOrder: index,
            })),
          },
        },
        include: { edges: { include: { fromUnit: true, toUnit: true } }, item: true },
      });
    });
  }

  async publishRecipe(companyId: string, input: OrdersV4RecipePublishInput) {
    const tenantId = TenantContext.getTenantId();
    if (!input.lines?.length) throw new BadRequestException('الوصفة يجب أن تحتوي على مكوّن واحد على الأقل');
    if (new Set(input.lines.map((line) => line.componentItemId)).size !== input.lines.length) {
      throw new BadRequestException('لا يمكن تكرار المكوّن نفسه داخل نسخة الوصفة');
    }
    if (input.lines.some((line) => line.componentItemId === input.outputItemId)) {
      throw new BadRequestException('لا يمكن للصنف أن يستهلك نفسه داخل الوصفة');
    }
    const outputItem = await this.prisma.ordersV4Item.findFirst({ where: { id: input.outputItemId, companyId }, include: { units: true } });
    if (!outputItem) throw new NotFoundException('صنف المخرَج غير موجود');
    if (outputItem.itemType === 'purchased') throw new BadRequestException('لا يمكن نشر وصفة لمادة مشتراة فقط');
    if (!outputItem.units.some((row) => row.unitId === input.outputUnitId && row.isActive)) {
      throw new BadRequestException('وحدة مخرج الرسبي غير مضافة إلى بطاقة صنف البيع');
    }
    const units = await this.prisma.ordersV4Unit.findMany({ where: { companyId, isActive: true } });
    const unitDefinitions = units.map(unitDefinition);
    const itemIds = [...new Set(input.lines.map((line) => line.componentItemId))];
    const components = await this.prisma.ordersV4Item.findMany({
      where: { companyId, id: { in: itemIds }, isActive: true },
      include: { units: true, conversionVersions: { where: { status: 'published' }, include: { edges: true }, take: 1, orderBy: { version: 'desc' } } },
    });
    if (components.length !== itemIds.length) throw new BadRequestException('أحد مكوّنات الوصفة غير موجود');
    const outputDefinition = await this.prisma.ordersV4ConversionVersion.findFirst({
      where: { companyId, itemId: outputItem.id, status: 'published' }, include: { edges: true }, orderBy: { version: 'desc' },
    });
    resolveOrdersV4Conversion({
      fromUnitId: input.outputUnitId, toUnitId: outputItem.inventoryUnitId, units: unitDefinitions,
      edges: outputDefinition?.edges.map((edge) => ({ ...edge, allowDimensionBridge: edge.allowDimensionBridge })) ?? [],
    });
    for (const line of input.lines) {
      const component = components.find((item) => item.id === line.componentItemId);
      if (!component) throw new BadRequestException('مكوّن وصفة غير موجود');
      const definition = component.conversionVersions[0];
      if (!component.units.some((row) => row.unitId === line.unitId && row.isActive)) {
        throw new BadRequestException(`${component.nameAr}: وحدة الرسبي غير مضافة إلى بطاقة المكوّن`);
      }
      resolveOrdersV4Conversion({
        fromUnitId: line.unitId, toUnitId: component.inventoryUnitId, units: unitDefinitions,
        edges: definition?.edges.map((edge) => ({ ...edge, allowDimensionBridge: edge.allowDimensionBridge })) ?? [],
      });
      positiveDecimal(line.quantity, 'كمية مكوّن الوصفة');
    }
    const outputQuantity = positiveDecimal(input.outputQuantity, 'كمية مخرَج الوصفة');
    const normalized = {
      outputItemId: input.outputItemId,
      outputQuantity: outputQuantity.toString(),
      outputUnitId: input.outputUnitId,
      lines: input.lines.map((line) => ({
        componentItemId: line.componentItemId,
        quantity: positiveDecimal(line.quantity, 'كمية مكوّن الوصفة').toString(),
        unitId: line.unitId,
      })),
    };
    const contentHash = stableHash(normalized);
    return this.prisma.withTenant(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`orders-v4:recipe:${outputItem.id}`}))`;
      const duplicate = await tx.ordersV4RecipeVersion.findFirst({ where: { outputItemId: outputItem.id, contentHash } });
      if (duplicate) return duplicate;
      const latest = await tx.ordersV4RecipeVersion.aggregate({ where: { outputItemId: outputItem.id }, _max: { version: true } });
      await tx.ordersV4RecipeVersion.updateMany({
        where: { outputItemId: outputItem.id, status: 'published' }, data: { status: 'retired', retiredAt: new Date() },
      });
      return tx.ordersV4RecipeVersion.create({
        data: {
          tenantId, companyId, outputItemId: outputItem.id,
          outputQuantity: new Prisma.Decimal(normalized.outputQuantity), outputUnitId: normalized.outputUnitId,
          version: (latest._max.version ?? 0) + 1,
          status: 'published', contentHash, publishedAt: new Date(), createdByUserId: TenantContext.getUserId(),
          lines: {
            create: normalized.lines.map((line, index) => ({
              tenantId, companyId, componentItemId: line.componentItemId,
              quantity: new Prisma.Decimal(line.quantity), unitId: line.unitId, sortOrder: index,
            })),
          },
        },
        include: { outputItem: true, outputUnit: true, lines: { include: { componentItem: true, unit: true } } },
      });
    });
  }

  async deactivate(companyId: string, entity: 'unit' | 'category' | 'section' | 'item' | 'location', id: string) {
    const updated = entity === 'unit'
      ? await this.prisma.ordersV4Unit.updateMany({ where: { id, companyId }, data: { isActive: false } })
      : entity === 'category'
        ? await this.prisma.ordersV4Category.updateMany({ where: { id, companyId }, data: { isActive: false } })
        : entity === 'section'
          ? await this.prisma.ordersV4Section.updateMany({ where: { id, companyId }, data: { isActive: false } })
          : entity === 'item'
            ? await this.prisma.ordersV4Item.updateMany({ where: { id, companyId }, data: { isActive: false } })
            : await this.prisma.ordersV4Location.updateMany({ where: { id, companyId }, data: { isActive: false } });
    if (!updated.count) throw new NotFoundException('سجل V4 غير موجود');
    return { id, deactivated: true };
  }

  private async requireUnit(companyId: string, id: string) {
    const row = await this.prisma.ordersV4Unit.findFirst({ where: { id, companyId, isActive: true } });
    if (!row) throw new BadRequestException('الوحدة لا تنتمي إلى الشركة');
    return row;
  }

  private async requireCategory(companyId: string, id: string) {
    const row = await this.prisma.ordersV4Category.findFirst({ where: { id, companyId, isActive: true } });
    if (!row) throw new BadRequestException('الفئة لا تنتمي إلى الشركة');
    return row;
  }

  private async requireSection(companyId: string, id: string) {
    const row = await this.prisma.ordersV4Section.findFirst({ where: { id, companyId, isActive: true } });
    if (!row) throw new BadRequestException('القسم لا ينتمي إلى الشركة');
    return row;
  }
}
