import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { TenantContext } from '../common/tenant-context';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import type {
  OrdersV3ConversionPublishInput,
  OrdersV3ItemInput,
  OrdersV3NamedInput,
  OrdersV3RecipePublishInput,
  OrdersV3UnitInput,
} from './orders-v3.contracts';
import { resolveOrdersV3Conversion, validateOrdersV3ConversionDefinition } from './orders-v3-conversion.kernel';
import type { OrdersV3ConversionEdgeDefinition, OrdersV3UnitDefinition } from './orders-v3-kernel.types';

const DEFAULT_UNITS: Array<OrdersV3UnitInput & { sortOrder: number }> = [
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
}): OrdersV3UnitDefinition {
  return {
    id: unit.id,
    code: unit.code,
    dimension: unit.dimension,
    canonicalFactor: unit.canonicalFactor,
  };
}

@Injectable()
export class OrdersV3CatalogService {
  constructor(private readonly prisma: TenantPrismaService) {}

  async ensureFoundation(companyId: string): Promise<void> {
    const tenantId = TenantContext.getTenantId();
    await this.prisma.withTenant(async (tx) => {
      await tx.ordersV3Unit.createMany({
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
      await tx.ordersV3Section.createMany({
        data: [{ tenantId, companyId, code: 'general', nameAr: 'عام', nameEn: 'General', sortOrder: 10 }],
        skipDuplicates: true,
      });
      await tx.ordersV3Location.createMany({
        data: [{ tenantId, companyId, code: 'main', nameAr: 'المخزون الرئيسي', nameEn: 'Main inventory', kind: 'warehouse' }],
        skipDuplicates: true,
      });
    });
  }

  async getBootstrap(companyId: string) {
    await this.ensureFoundation(companyId);
    const [units, categories, sections, items, locations, conversions, recipes] = await Promise.all([
      this.prisma.ordersV3Unit.findMany({ where: { companyId }, orderBy: [{ sortOrder: 'asc' }, { nameAr: 'asc' }] }),
      this.prisma.ordersV3Category.findMany({ where: { companyId }, orderBy: [{ sortOrder: 'asc' }, { nameAr: 'asc' }] }),
      this.prisma.ordersV3Section.findMany({ where: { companyId }, orderBy: [{ sortOrder: 'asc' }, { nameAr: 'asc' }] }),
      this.prisma.ordersV3Item.findMany({
        where: { companyId },
        include: { baseUnit: true, category: true, sections: { include: { section: true } } },
        orderBy: [{ sortOrder: 'asc' }, { nameAr: 'asc' }],
      }),
      this.prisma.ordersV3Location.findMany({ where: { companyId }, include: { section: true }, orderBy: { nameAr: 'asc' } }),
      this.prisma.ordersV3ConversionVersion.findMany({
        where: { companyId, status: 'published' },
        include: { edges: { include: { fromUnit: true, toUnit: true }, orderBy: { sortOrder: 'asc' } }, item: true },
        orderBy: [{ item: { nameAr: 'asc' } }, { version: 'desc' }],
      }),
      this.prisma.ordersV3RecipeVersion.findMany({
        where: { companyId, status: 'published' },
        include: {
          outputItem: true,
          outputUnit: true,
          lines: { include: { componentItem: true, unit: true }, orderBy: { sortOrder: 'asc' } },
        },
        orderBy: [{ outputItem: { nameAr: 'asc' } }, { version: 'desc' }],
      }),
    ]);
    return { units, categories, sections, items, locations, conversions, recipes, kernelVersion: 3 };
  }

  async createUnit(companyId: string, input: OrdersV3UnitInput) {
    const tenantId = TenantContext.getTenantId();
    const code = slugCode(normalizedText(input.code, 'رمز الوحدة'));
    if (!code) throw new BadRequestException('رمز الوحدة غير صالح');
    const dimension = slugCode(normalizedText(input.dimension, 'بُعد الوحدة'));
    const canonicalFactor = input.canonicalFactor == null || input.canonicalFactor === ''
      ? null
      : positiveDecimal(input.canonicalFactor, 'المعامل القياسي');
    return this.prisma.ordersV3Unit.create({
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

  async createCategory(companyId: string, input: OrdersV3NamedInput) {
    return this.prisma.ordersV3Category.create({
      data: {
        tenantId: TenantContext.getTenantId(), companyId,
        nameAr: normalizedText(input.nameAr, 'اسم الفئة'),
        nameEn: input.nameEn?.trim() || null,
        sortOrder: Number(input.sortOrder ?? 0),
      },
    });
  }

  async createSection(companyId: string, input: OrdersV3NamedInput) {
    const nameAr = normalizedText(input.nameAr, 'اسم القسم');
    const code = slugCode(input.code?.trim() || nameAr) || `section-${Date.now()}`;
    return this.prisma.ordersV3Section.create({
      data: {
        tenantId: TenantContext.getTenantId(), companyId, code, nameAr,
        nameEn: input.nameEn?.trim() || null,
        sortOrder: Number(input.sortOrder ?? 0),
      },
    });
  }

  async createLocation(companyId: string, input: OrdersV3NamedInput & { kind?: string; sectionId?: string | null }) {
    const nameAr = normalizedText(input.nameAr, 'اسم الموقع');
    const code = slugCode(input.code?.trim() || nameAr) || `location-${Date.now()}`;
    if (input.sectionId) await this.requireSection(companyId, input.sectionId);
    return this.prisma.ordersV3Location.create({
      data: {
        tenantId: TenantContext.getTenantId(), companyId, code, nameAr,
        nameEn: input.nameEn?.trim() || null,
        kind: input.kind?.trim() || 'warehouse',
        sectionId: input.sectionId || null,
      },
    });
  }

  async createItem(companyId: string, input: OrdersV3ItemInput) {
    const tenantId = TenantContext.getTenantId();
    const itemType = input.itemType;
    if (!['purchased', 'sale', 'both'].includes(itemType)) throw new BadRequestException('نوع الصنف غير صالح');
    await this.requireUnit(companyId, input.baseUnitId);
    if (input.categoryId) await this.requireCategory(companyId, input.categoryId);
    const sectionIds = [...new Set(input.sectionIds ?? [])];
    for (const sectionId of sectionIds) await this.requireSection(companyId, sectionId);
    return this.prisma.ordersV3Item.create({
      data: {
        tenantId,
        companyId,
        sku: input.sku?.trim() || null,
        nameAr: normalizedText(input.nameAr, 'اسم الصنف'),
        nameEn: input.nameEn?.trim() || null,
        itemType,
        categoryId: input.categoryId || null,
        baseUnitId: input.baseUnitId,
        trackInventory: input.trackInventory !== false,
        sortOrder: Number(input.sortOrder ?? 0),
        sections: sectionIds.length
          ? { create: sectionIds.map((sectionId) => ({ tenantId, companyId, sectionId })) }
          : undefined,
      },
      include: { baseUnit: true, category: true, sections: { include: { section: true } } },
    });
  }

  async publishConversion(companyId: string, input: OrdersV3ConversionPublishInput) {
    const tenantId = TenantContext.getTenantId();
    if (!input.edges?.length) throw new BadRequestException('نسخة التحويل يجب أن تحتوي على مسار واحد على الأقل');
    const item = await this.prisma.ordersV3Item.findFirst({ where: { id: input.itemId, companyId } });
    if (!item) throw new NotFoundException('صنف V3 غير موجود');
    const units = await this.prisma.ordersV3Unit.findMany({ where: { companyId, isActive: true } });
    const definitions = units.map(unitDefinition);
    const definitionEdges: OrdersV3ConversionEdgeDefinition[] = input.edges.map((edge, index) => ({
      id: `candidate-${index + 1}`,
      fromUnitId: edge.fromUnitId,
      toUnitId: edge.toUnitId,
      factor: positiveDecimal(edge.factor, `معامل التحويل رقم ${index + 1}`),
      reversible: edge.reversible !== false,
      allowDimensionBridge: edge.allowDimensionBridge === true,
    }));
    validateOrdersV3ConversionDefinition(definitions, definitionEdges);
    for (const unitId of [item.baseUnitId, ...definitionEdges.flatMap((edge) => [edge.fromUnitId, edge.toUnitId])]) {
      if (!units.some((unit) => unit.id === unitId)) throw new BadRequestException('وحدة التحويل لا تنتمي إلى الشركة');
    }
    for (const unitId of new Set(definitionEdges.flatMap((edge) => [edge.fromUnitId, edge.toUnitId]))) {
      resolveOrdersV3Conversion({ fromUnitId: unitId, toUnitId: item.baseUnitId, units: definitions, edges: definitionEdges });
    }
    const normalized = definitionEdges.map((edge) => ({
      fromUnitId: edge.fromUnitId,
      toUnitId: edge.toUnitId,
      factor: edge.factor.toString(),
      reversible: edge.reversible,
      allowDimensionBridge: edge.allowDimensionBridge,
    }));
    const contentHash = stableHash({ itemId: item.id, baseUnitId: item.baseUnitId, edges: normalized });
    return this.prisma.withTenant(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`orders-v3:conversion:${item.id}`}))`;
      const existingHash = await tx.ordersV3ConversionVersion.findFirst({ where: { itemId: item.id, contentHash } });
      if (existingHash) return existingHash;
      const latest = await tx.ordersV3ConversionVersion.aggregate({ where: { itemId: item.id }, _max: { version: true } });
      await tx.ordersV3ConversionVersion.updateMany({
        where: { itemId: item.id, status: 'published' },
        data: { status: 'retired', retiredAt: new Date() },
      });
      return tx.ordersV3ConversionVersion.create({
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

  async publishRecipe(companyId: string, input: OrdersV3RecipePublishInput) {
    const tenantId = TenantContext.getTenantId();
    if (!input.lines?.length) throw new BadRequestException('الوصفة يجب أن تحتوي على مكوّن واحد على الأقل');
    if (new Set(input.lines.map((line) => line.componentItemId)).size !== input.lines.length) {
      throw new BadRequestException('لا يمكن تكرار المكوّن نفسه داخل نسخة الوصفة');
    }
    if (input.lines.some((line) => line.componentItemId === input.outputItemId)) {
      throw new BadRequestException('لا يمكن للصنف أن يستهلك نفسه داخل الوصفة');
    }
    const outputItem = await this.prisma.ordersV3Item.findFirst({ where: { id: input.outputItemId, companyId } });
    if (!outputItem) throw new NotFoundException('صنف المخرَج غير موجود');
    if (outputItem.itemType === 'purchased') throw new BadRequestException('لا يمكن نشر وصفة لمادة مشتراة فقط');
    const units = await this.prisma.ordersV3Unit.findMany({ where: { companyId, isActive: true } });
    const unitDefinitions = units.map(unitDefinition);
    const itemIds = [...new Set(input.lines.map((line) => line.componentItemId))];
    const components = await this.prisma.ordersV3Item.findMany({
      where: { companyId, id: { in: itemIds }, isActive: true },
      include: { conversionVersions: { where: { status: 'published' }, include: { edges: true }, take: 1, orderBy: { version: 'desc' } } },
    });
    if (components.length !== itemIds.length) throw new BadRequestException('أحد مكوّنات الوصفة غير موجود');
    const outputDefinition = await this.prisma.ordersV3ConversionVersion.findFirst({
      where: { companyId, itemId: outputItem.id, status: 'published' }, include: { edges: true }, orderBy: { version: 'desc' },
    });
    resolveOrdersV3Conversion({
      fromUnitId: input.outputUnitId, toUnitId: outputItem.baseUnitId, units: unitDefinitions,
      edges: outputDefinition?.edges.map((edge) => ({ ...edge, allowDimensionBridge: edge.allowDimensionBridge })) ?? [],
    });
    for (const line of input.lines) {
      const component = components.find((item) => item.id === line.componentItemId);
      if (!component) throw new BadRequestException('مكوّن وصفة غير موجود');
      const definition = component.conversionVersions[0];
      resolveOrdersV3Conversion({
        fromUnitId: line.unitId, toUnitId: component.baseUnitId, units: unitDefinitions,
        edges: definition?.edges.map((edge) => ({ ...edge, allowDimensionBridge: edge.allowDimensionBridge })) ?? [],
      });
      positiveDecimal(line.quantity, 'كمية مكوّن الوصفة');
      const wastePercent = decimalInput(line.wastePercent ?? 0, 'نسبة الهدر');
      if (wastePercent.lt(0) || wastePercent.gt(100)) throw new BadRequestException('نسبة الهدر يجب أن تكون بين 0 و100');
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
        wastePercent: decimalInput(line.wastePercent ?? 0, 'نسبة الهدر').toString(),
      })),
    };
    const contentHash = stableHash(normalized);
    return this.prisma.withTenant(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`orders-v3:recipe:${outputItem.id}`}))`;
      const duplicate = await tx.ordersV3RecipeVersion.findFirst({ where: { outputItemId: outputItem.id, contentHash } });
      if (duplicate) return duplicate;
      const latest = await tx.ordersV3RecipeVersion.aggregate({ where: { outputItemId: outputItem.id }, _max: { version: true } });
      await tx.ordersV3RecipeVersion.updateMany({
        where: { outputItemId: outputItem.id, status: 'published' }, data: { status: 'retired', retiredAt: new Date() },
      });
      return tx.ordersV3RecipeVersion.create({
        data: {
          tenantId, companyId, outputItemId: outputItem.id,
          outputQuantity: new Prisma.Decimal(normalized.outputQuantity), outputUnitId: normalized.outputUnitId,
          version: (latest._max.version ?? 0) + 1,
          status: 'published', contentHash, publishedAt: new Date(), createdByUserId: TenantContext.getUserId(),
          lines: {
            create: normalized.lines.map((line, index) => ({
              tenantId, companyId, componentItemId: line.componentItemId,
              quantity: new Prisma.Decimal(line.quantity), unitId: line.unitId,
              wastePercent: new Prisma.Decimal(line.wastePercent), sortOrder: index,
            })),
          },
        },
        include: { outputItem: true, outputUnit: true, lines: { include: { componentItem: true, unit: true } } },
      });
    });
  }

  async deactivate(companyId: string, entity: 'unit' | 'category' | 'section' | 'item' | 'location', id: string) {
    const updated = entity === 'unit'
      ? await this.prisma.ordersV3Unit.updateMany({ where: { id, companyId }, data: { isActive: false } })
      : entity === 'category'
        ? await this.prisma.ordersV3Category.updateMany({ where: { id, companyId }, data: { isActive: false } })
        : entity === 'section'
          ? await this.prisma.ordersV3Section.updateMany({ where: { id, companyId }, data: { isActive: false } })
          : entity === 'item'
            ? await this.prisma.ordersV3Item.updateMany({ where: { id, companyId }, data: { isActive: false } })
            : await this.prisma.ordersV3Location.updateMany({ where: { id, companyId }, data: { isActive: false } });
    if (!updated.count) throw new NotFoundException('سجل V3 غير موجود');
    return { id, deactivated: true };
  }

  private async requireUnit(companyId: string, id: string) {
    const row = await this.prisma.ordersV3Unit.findFirst({ where: { id, companyId, isActive: true } });
    if (!row) throw new BadRequestException('الوحدة لا تنتمي إلى الشركة');
    return row;
  }

  private async requireCategory(companyId: string, id: string) {
    const row = await this.prisma.ordersV3Category.findFirst({ where: { id, companyId, isActive: true } });
    if (!row) throw new BadRequestException('الفئة لا تنتمي إلى الشركة');
    return row;
  }

  private async requireSection(companyId: string, id: string) {
    const row = await this.prisma.ordersV3Section.findFirst({ where: { id, companyId, isActive: true } });
    if (!row) throw new BadRequestException('القسم لا ينتمي إلى الشركة');
    return row;
  }
}
