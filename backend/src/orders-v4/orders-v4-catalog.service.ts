import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContext } from '../common/tenant-context';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import type {
  OrdersV4ItemInput,
  OrdersV4ItemUpdateInput,
  OrdersV4NamedInput,
  OrdersV4RecipePublishInput,
  OrdersV4UnitInput,
} from './orders-v4.contracts';
import {
  ordersV4EdgeDefinitions,
  ordersV4UnitDefinitions,
  resolveOrdersV4ContextConversion,
} from './orders-v4-conversion.context';
import {
  decideOrdersV4VersionPublication,
  ordersV4DefinitionsEqual,
  ordersV4StableHash,
} from './orders-v4-version.kernel';
import { assertOrdersV4UnitDeactivationAllowed } from './orders-v4-unit-governance.kernel';
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
  { code: 'box', nameAr: 'علبة', nameEn: 'Box', dimension: 'package', canonicalFactor: null, decimalScale: 4, sortOrder: 65 },
  { code: 'carton', nameAr: 'كرتون', nameEn: 'Carton', dimension: 'package', canonicalFactor: null, decimalScale: 4, sortOrder: 70 },
];
const DEFAULT_UNIT_CODES = new Set(DEFAULT_UNITS.map((unit) => unit.code));

function normalizedText(value: unknown, label: string): string {
  const text = String(value ?? '').trim();
  if (!text) throw new BadRequestException(`${label} مطلوب`);
  return text;
}

function slugCode(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
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

@Injectable()
export class OrdersV4CatalogService {
  constructor(private readonly prisma: TenantPrismaService) {}

  async getBootstrap(companyId: string) {
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
          distinct: ['itemId', 'documentId'],
          select: { itemId: true, documentId: true, inventoryUnitPrice: true, inventoryUnitId: true },
        })
      : [];
    const normalizedUnits = ordersV4UnitDefinitions(units);
    const recipesWithCost = recipes.map((recipe) => {
      const components = recipe.lines.map((line) => {
        const definition = line.componentItem.conversionVersions[0];
        const conversion = resolveOrdersV4ContextConversion({
          fromUnitId: line.unitId,
          toUnitId: line.componentItem.kernelUnitId,
          units: normalizedUnits,
          edges: definition?.edges ?? [],
        });
        const samples = priceRows.filter((price) => price.itemId === line.componentItemId).slice(0, 5);
        const normalizedPrices = samples.map((price) => calculateOrdersV4ConvertedUnitPrice(
          price.inventoryUnitPrice,
          resolveOrdersV4ContextConversion({
            fromUnitId: price.inventoryUnitId,
            toUnitId: line.componentItem.kernelUnitId,
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

  async updateCategory(companyId: string, id: string, input: OrdersV4NamedInput) {
    const category = await this.prisma.ordersV4Category.findFirst({ where: { id, companyId, isActive: true } });
    if (!category) throw new NotFoundException('فئة V4 غير موجودة');
    return this.prisma.ordersV4Category.update({
      where: { id },
      data: {
        nameAr: normalizedText(input.nameAr, 'اسم الفئة'),
        nameEn: input.nameEn?.trim() || null,
        sortOrder: Number(input.sortOrder ?? category.sortOrder),
      },
    });
  }

  async updateSection(companyId: string, id: string, input: OrdersV4NamedInput) {
    const section = await this.prisma.ordersV4Section.findFirst({ where: { id, companyId, isActive: true } });
    if (!section) throw new NotFoundException('قسم V4 غير موجود');
    const nameAr = normalizedText(input.nameAr, 'اسم القسم');
    return this.prisma.ordersV4Section.update({
      where: { id },
      data: {
        code: input.code?.trim() ? slugCode(input.code) : section.code,
        nameAr,
        nameEn: input.nameEn?.trim() || null,
        sortOrder: Number(input.sortOrder ?? section.sortOrder),
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
      : [{ unitId: input.inventoryUnitId, isOrderEnabled: false, sortOrder: 0 }];
    if (!configuredUnits.some((row) => row.unitId === input.inventoryUnitId)) {
      configuredUnits.unshift({ unitId: input.inventoryUnitId, isOrderEnabled: false, sortOrder: 0 });
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
        kernelUnitId: input.inventoryUnitId,
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
            purchaseLabel: row.purchaseLabel?.trim() || null,
            isOrderEnabled: row.isOrderEnabled === true && row.lastPrice != null && row.lastPrice !== '',
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

  async updateItem(companyId: string, itemId: string, input: OrdersV4ItemUpdateInput) {
    const tenantId = TenantContext.getTenantId();
    const sectionIds = [...new Set(input.sectionIds ?? [])];
    return this.prisma.withTenant(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`orders-v4:item-definition:${itemId}`}))`;
      const item = await tx.ordersV4Item.findFirst({ where: { id: itemId, companyId, isActive: true } });
      if (!item) throw new NotFoundException('صنف V4 غير موجود');
      if (input.categoryId) {
        const category = await tx.ordersV4Category.findFirst({ where: { id: input.categoryId, companyId, isActive: true } });
        if (!category) throw new BadRequestException('فئة الصنف غير موجودة أو معطلة');
      }
      if (sectionIds.length) {
        const sectionCount = await tx.ordersV4Section.count({ where: { companyId, id: { in: sectionIds }, isActive: true } });
        if (sectionCount !== sectionIds.length) throw new BadRequestException('أحد أقسام الصنف غير موجود أو معطل');
      }
      await tx.ordersV4ItemSection.deleteMany({ where: { companyId, itemId } });
      return tx.ordersV4Item.update({
        where: { id: itemId },
        data: {
          sku: input.sku?.trim() || null,
          nameAr: normalizedText(input.nameAr, 'اسم الصنف'),
          nameEn: input.nameEn?.trim() || null,
          categoryId: input.categoryId || null,
          trackInventory: input.trackInventory !== false,
          sortOrder: Number(input.sortOrder ?? item.sortOrder),
          sections: sectionIds.length
            ? { create: sectionIds.map((sectionId) => ({ tenantId, companyId, sectionId })) }
            : undefined,
        },
        include: {
          inventoryUnit: true,
          category: true,
          units: { include: { unit: true }, orderBy: { sortOrder: 'asc' } },
          sections: { include: { section: true } },
        },
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
    const unitDefinitions = ordersV4UnitDefinitions(units);
    const itemIds = [...new Set(input.lines.map((line) => line.componentItemId))];
    const components = await this.prisma.ordersV4Item.findMany({
      where: { companyId, id: { in: itemIds }, itemType: 'purchased', isActive: true },
      include: { units: true, conversionVersions: { where: { status: 'published' }, include: { edges: true }, take: 1, orderBy: { version: 'desc' } } },
    });
    if (components.length !== itemIds.length) throw new BadRequestException('كل مكوّنات الرسبي يجب أن تكون أصناف شراء فعالة');
    const outputDefinition = await this.prisma.ordersV4ConversionVersion.findFirst({
      where: { companyId, itemId: outputItem.id, status: 'published' }, include: { edges: true }, orderBy: { version: 'desc' },
    });
    resolveOrdersV4ContextConversion({
      fromUnitId: input.outputUnitId, toUnitId: outputItem.kernelUnitId, units: unitDefinitions,
      edges: ordersV4EdgeDefinitions(outputDefinition?.edges),
    });
    for (const line of input.lines) {
      const component = components.find((item) => item.id === line.componentItemId);
      if (!component) throw new BadRequestException('مكوّن وصفة غير موجود');
      const definition = component.conversionVersions[0];
      if (!component.units.some((row) => row.unitId === line.unitId && row.isActive)) {
        throw new BadRequestException(`${component.nameAr}: وحدة الرسبي غير مضافة إلى بطاقة المكوّن`);
      }
      resolveOrdersV4ContextConversion({
        fromUnitId: line.unitId, toUnitId: component.kernelUnitId, units: unitDefinitions,
        edges: ordersV4EdgeDefinitions(definition?.edges),
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
    const contentHash = ordersV4StableHash(normalized);
    return this.prisma.withTenant(async (tx) => {
      for (const definitionItemId of [outputItem.id, ...itemIds].sort()) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`orders-v4:item-definition:${definitionItemId}`}))`;
      }
      const recipeUnitIds = [...new Set([input.outputUnitId, ...input.lines.map((line) => line.unitId)])].sort();
      for (const unitId of recipeUnitIds) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`orders-v4:unit:${unitId}`}))`;
      }
      const lockedActiveUnitCount = await tx.ordersV4Unit.count({ where: { companyId, id: { in: recipeUnitIds }, isActive: true } });
      if (lockedActiveUnitCount !== recipeUnitIds.length) throw new BadRequestException('إحدى وحدات الرسبي عُطلت أثناء النشر');
      const lockedItems = await tx.ordersV4Item.findMany({
        where: { companyId, id: { in: [outputItem.id, ...itemIds] }, isActive: true },
        include: { units: true },
      });
      const lockedOutput = lockedItems.find((item) => item.id === outputItem.id);
      if (!lockedOutput || lockedOutput.kernelUnitId !== outputItem.kernelUnitId || !lockedOutput.units.some((row) => row.unitId === input.outputUnitId && row.isActive)) {
        throw new BadRequestException('تغير تعريف صنف البيع أثناء نشر الرسبي؛ أعد المحاولة بعد تحديث البيانات');
      }
      for (const line of input.lines) {
        const before = components.find((item) => item.id === line.componentItemId);
        const locked = lockedItems.find((item) => item.id === line.componentItemId);
        if (!before || !locked || before.kernelUnitId !== locked.kernelUnitId || !locked.units.some((row) => row.unitId === line.unitId && row.isActive)) {
          throw new BadRequestException('تغير تعريف أحد مكونات الرسبي أثناء النشر؛ أعد المحاولة بعد تحديث البيانات');
        }
      }
      const current = await tx.ordersV4RecipeVersion.findFirst({
        where: { outputItemId: outputItem.id, status: 'published' },
        orderBy: { version: 'desc' },
        include: { lines: { orderBy: { sortOrder: 'asc' } }, outputItem: true, outputUnit: true },
      });
      const currentNormalized = current ? {
        outputItemId: current.outputItemId,
        outputQuantity: current.outputQuantity.toString(),
        outputUnitId: current.outputUnitId,
        lines: current.lines.map((line) => ({
          componentItemId: line.componentItemId,
          quantity: line.quantity.toString(),
          unitId: line.unitId,
        })),
      } : null;
      if (current && ordersV4DefinitionsEqual(currentNormalized, normalized)) return current;
      const latest = await tx.ordersV4RecipeVersion.aggregate({ where: { outputItemId: outputItem.id }, _max: { version: true } });
      const nextVersion = (latest._max.version ?? 0) + 1;
      const hashCollision = await tx.ordersV4RecipeVersion.findFirst({ where: { outputItemId: outputItem.id, contentHash } });
      const publication = decideOrdersV4VersionPublication({
        currentDefinition: currentNormalized,
        candidateDefinition: normalized,
        semanticHash: contentHash,
        hashAlreadyExists: !!hashCollision,
        predecessorVersionId: current?.id ?? null,
        nextVersion,
      });
      await tx.ordersV4RecipeVersion.updateMany({
        where: { outputItemId: outputItem.id, status: 'published' }, data: { status: 'retired', retiredAt: new Date() },
      });
      return tx.ordersV4RecipeVersion.create({
        data: {
          tenantId, companyId, outputItemId: outputItem.id,
          outputQuantity: new Prisma.Decimal(normalized.outputQuantity), outputUnitId: normalized.outputUnitId,
          version: nextVersion,
          status: 'published', contentHash: publication.contentHash, publishedAt: new Date(), createdByUserId: TenantContext.getUserId(),
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
    if (entity === 'unit') {
      return this.prisma.withTenant(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`orders-v4:unit:${id}`}))`;
        const unit = await tx.ordersV4Unit.findFirst({ where: { id, companyId, isActive: true } });
        if (!unit) throw new NotFoundException('وحدة V4 غير موجودة أو معطلة');
        const references = await Promise.all([
          tx.ordersV4Item.count({ where: { companyId, OR: [{ inventoryUnitId: id }, { kernelUnitId: id }] } }),
          tx.ordersV4ItemUnit.count({ where: { companyId, unitId: id } }),
          tx.ordersV4ConversionEdge.count({ where: { companyId, OR: [{ fromUnitId: id }, { toUnitId: id }] } }),
          tx.ordersV4RecipeVersion.count({ where: { companyId, outputUnitId: id } }),
          tx.ordersV4RecipeLine.count({ where: { companyId, unitId: id } }),
          tx.ordersV4DocumentLine.count({ where: { companyId, OR: [{ inputUnitId: id }, { baseUnitId: id }, { priceUnitId: id }] } }),
          tx.ordersV4PriceHistory.count({ where: { companyId, OR: [{ unitId: id }, { inventoryUnitId: id }] } }),
          tx.ordersV4InventoryLedgerEntry.count({ where: { companyId, inventoryUnitId: id } }),
          tx.ordersV4StocktakeLine.count({ where: { companyId, unitId: id } }),
        ]);
        assertOrdersV4UnitDeactivationAllowed(references, { isDefault: DEFAULT_UNIT_CODES.has(unit.code) });
        await tx.ordersV4Unit.update({ where: { id }, data: { isActive: false } });
        return { id, deactivated: true };
      });
    }
    const updated = entity === 'category'
        ? await this.prisma.ordersV4Category.updateMany({ where: { id, companyId }, data: { isActive: false } })
        : entity === 'section'
          ? await this.prisma.ordersV4Section.updateMany({ where: { id, companyId }, data: { isActive: false } })
          : entity === 'item'
            ? await this.prisma.ordersV4Item.updateMany({ where: { id, companyId }, data: { isActive: false } })
            : await this.prisma.ordersV4Location.updateMany({ where: { id, companyId }, data: { isActive: false } });
    if (!updated.count) throw new NotFoundException('سجل V4 غير موجود');
    return { id, deactivated: true };
  }

  async restoreUnit(companyId: string, id: string) {
    const restored = await this.prisma.ordersV4Unit.updateMany({
      where: { id, companyId, isActive: false },
      data: { isActive: true },
    });
    if (!restored.count) {
      const existing = await this.prisma.ordersV4Unit.findFirst({ where: { id, companyId } });
      if (!existing) throw new NotFoundException('وحدة V4 غير موجودة');
    }
    return { id, restored: true };
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
