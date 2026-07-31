import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContext } from '../common/tenant-context';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { GeminiService } from '../chat/gemini.service';
import {
  enrichProductWithSectionIds,
  normalizeProductSections,
  parseStringArrayJson,
} from './orders-product-sections.util';
import {
  type ProductUnitConversionInput,
  resolveProductUnitMultiplierOrNull,
  unitConversionsJson,
  validateProductUnitConversions,
} from './orders-unit-conversions.util';

type OrderProductWithSections = { sections?: unknown; sectionIds?: unknown };
type ProductVariantInput = {
  size?: string;
  packaging?: string;
  unit?: string;
  lastPrice?: string;
  quantityMultiplier?: string;
};

type ProductRecipeItemInput = {
  materialType?: string;
  materialProductId?: string;
  quantity?: string;
  unit?: string;
};

type CatalogUnitInput = {
  code?: string;
  nameAr?: string;
  nameEn?: string | null;
  kind?: string | null;
  isActive?: boolean;
  sortOrder?: number;
};

type ConversionTemplateInput = {
  code?: string;
  nameAr?: string;
  nameEn?: string | null;
  description?: string | null;
  conversions?: ProductUnitConversionInput[];
  isActive?: boolean;
  sortOrder?: number;
};

const CATALOG_TRANSLATION_BATCH_SIZE = 15;

@Injectable()
export class OrdersCatalogService {
  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly gemini: GeminiService,
  ) {}

  async getProducts(companyId: string, section?: string, productType?: string) {
    const all = await this.prisma.orderProduct.findMany({
      where: { companyId, isActive: true, ...(productType ? { productType } : {}) },
      orderBy: [{ sortOrder: 'asc' }, { nameAr: 'asc' }],
      include: { category: true, conversionTemplate: true },
    });
    const enriched = await this.enrichProductsList(companyId, all);
    if (!section) return enriched;
    return enriched.filter((product) => parseStringArrayJson(product.sections).includes(section));
  }

  async previewMissingProductTranslations(companyId: string, productType?: string, limit = 30) {
    const products = await this.prisma.orderProduct.findMany({
      where: { companyId, isActive: true, ...(productType ? { productType } : {}) },
      orderBy: [{ sortOrder: 'asc' }, { nameAr: 'asc' }],
      include: { category: true },
    });
    const missing = products.filter((product) => !product.nameEn?.trim());
    const requestedLimit = Math.min(Math.max(limit, 1), 50);
    const selected = missing.slice(0, Math.min(requestedLimit, CATALOG_TRANSLATION_BATCH_SIZE));
    if (!selected.length) return { suggestions: [], totalMissing: 0, truncated: false };

    const suggestions = await this.gemini.translateRestaurantCatalogItems(selected.map((product) => ({
      id: product.id,
      nameAr: product.nameAr,
      categoryAr: product.category?.nameAr,
      categoryEn: product.category?.nameEn,
      unit: product.unit,
      productType: product.productType,
    })));
    if (!suggestions) {
      throw new ServiceUnavailableException('Catalog translation service is currently unavailable.');
    }
    if (suggestions.length === 0) {
      throw new ServiceUnavailableException('Catalog translation service returned no usable suggestions.');
    }

    const byId = new Map(selected.map((product) => [product.id, product]));
    return {
      suggestions: suggestions.map((suggestion) => {
        const product = byId.get(suggestion.id);
        return {
          productId: suggestion.id,
          nameAr: product?.nameAr ?? '',
          categoryAr: product?.category?.nameAr ?? null,
          unit: product?.unit ?? null,
          productType: product?.productType ?? null,
          suggestedNameEn: suggestion.suggestedNameEn,
          classification: suggestion.classification,
          confidence: suggestion.confidence,
          needsReview: suggestion.needsReview,
        };
      }),
      totalMissing: missing.length,
      truncated: missing.length > selected.length,
    };
  }

  async applyProductTranslations(
    companyId: string,
    translations: Array<{ productId: string; nameEn: string }>,
  ) {
    const unique = new Map<string, string>();
    for (const translation of translations) {
      const productId = translation.productId.trim();
      const nameEn = translation.nameEn.replace(/\s+/g, ' ').trim();
      if (!productId || !nameEn || nameEn.length > 80) continue;
      unique.set(productId, nameEn);
    }
    if (!unique.size) return { updatedCount: 0, skippedCount: translations.length };

    const updatedCount = await this.prisma.withTenant(async (tx) => {
      const updates = await Promise.all([...unique].map(([productId, nameEn]) => (
        tx.orderProduct.updateMany({
          where: {
            id: productId,
            companyId,
            isActive: true,
            OR: [{ nameEn: null }, { nameEn: '' }],
          },
          data: { nameEn },
        })
      )));
      return updates.reduce((total, update) => total + update.count, 0);
    });

    return {
      updatedCount,
      skippedCount: translations.length - updatedCount,
    };
  }

  async createProductsBatch(companyId: string, products: Array<{
    nameAr: string;
    nameEn?: string;
    unit?: string;
    sizes?: string;
    packaging?: string;
    categoryId?: string;
    productType?: string;
    sections?: string[];
    sectionIds?: string[];
    lastPrice?: string;
    variants?: ProductVariantInput[];
    inventoryConversions?: ProductUnitConversionInput[];
    conversionTemplateId?: string | null;
    recipe?: ProductRecipeItemInput[];
  }>) {
    const tenantId = TenantContext.getTenantId();
    const sectionList = await this.loadSectionList(companyId);
    await this.assertRecipeMaterialProducts(
      companyId,
      products.flatMap((dto) => (dto.productType === 'sale' ? (dto.recipe ?? []) : [])),
    );
    await this.assertConversionTemplates(
      companyId,
      products
        .filter((dto) => (dto.productType === 'sale' ? 'sale' : 'order') === 'order')
        .map((dto) => this.cleanNullableId(dto.conversionTemplateId))
        .filter((id): id is string => Boolean(id)),
    );
    for (const dto of products) {
      if ((dto.productType === 'sale' ? 'sale' : 'order') === 'order') {
        this.assertUnitConversionRows(dto.inventoryConversions);
      }
    }
    const data = products
      .filter((dto) => !!dto.nameAr?.trim())
      .map((dto) => this.buildProductCreateInput(tenantId, companyId, dto, sectionList));
    if (data.length === 0) return [];

    const inserted = await this.prisma.orderProduct.createManyAndReturn({ data });
    const rows = await this.prisma.orderProduct.findMany({
      where: { id: { in: inserted.map((row) => row.id) } },
      include: { category: true, conversionTemplate: true },
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    return this.enrichProductsList(
      companyId,
      inserted.map((row) => {
        const full = byId.get(row.id);
        if (!full) throw new Error('orderProduct batch: missing row after insert');
        return full;
      }),
    );
  }

  async createProduct(companyId: string, dto: {
    nameAr: string;
    nameEn?: string;
    unit?: string;
    sizes?: string;
    packaging?: string;
    categoryId?: string;
    lastPrice?: string;
    sections?: string[];
    sectionIds?: string[];
    productType?: string;
    variants?: ProductVariantInput[];
    inventoryConversions?: ProductUnitConversionInput[];
    conversionTemplateId?: string | null;
    recipe?: ProductRecipeItemInput[];
  }) {
    const tenantId = TenantContext.getTenantId();
    if (!dto.nameAr?.trim()) throw new BadRequestException('اسم الصنف بالعربية مطلوب');
    const sectionList = await this.loadSectionList(companyId);
    if (dto.productType === 'sale') {
      await this.assertRecipeMaterialProducts(companyId, dto.recipe);
    }
    if ((dto.productType === 'sale' ? 'sale' : 'order') === 'order') {
      await this.assertConversionTemplates(companyId, this.cleanNullableId(dto.conversionTemplateId) ? [this.cleanNullableId(dto.conversionTemplateId)] : []);
      this.assertUnitConversionRows(dto.inventoryConversions);
    }
    const created = await this.prisma.orderProduct.create({
      data: this.buildProductCreateInput(tenantId, companyId, dto, sectionList),
      include: { category: true, conversionTemplate: true },
    });
    return enrichProductWithSectionIds(created, sectionList);
  }

  async updateProduct(id: string, companyId: string, dto: {
    nameAr?: string;
    nameEn?: string | null;
    unit?: string;
    sizes?: string | null;
    packaging?: string | null;
    categoryId?: string | null;
    lastPrice?: string;
    sections?: string[] | null;
    sectionIds?: string[] | null;
    productType?: string;
    variants?: ProductVariantInput[];
    inventoryConversions?: ProductUnitConversionInput[];
    conversionTemplateId?: string | null;
    recipe?: ProductRecipeItemInput[];
    isActive?: boolean;
  }) {
    const product = await this.prisma.orderProduct.findFirst({ where: { id, companyId } });
    if (!product) throw new NotFoundException('الصنف غير موجود');
    const nextUnit = dto.unit?.trim();
    const nextProductType = dto.productType ?? product.productType;
    const changesInventoryIdentity = (
      (nextUnit !== undefined && nextUnit !== product.unit)
      || nextProductType !== product.productType
    );
    if (changesInventoryIdentity && await this.hasProductInventoryHistory(id, companyId)) {
      throw new BadRequestException(
        'Inventory base unit or product type cannot change after inventory activity. Create a new product to preserve the historical ledger.',
      );
    }
    const sectionList = await this.loadSectionList(companyId);
    if (nextProductType === 'sale' && dto.recipe !== undefined) {
      await this.assertRecipeMaterialProducts(companyId, dto.recipe);
    }
    if (nextProductType === 'order' && dto.conversionTemplateId !== undefined) {
      await this.assertConversionTemplates(companyId, this.cleanNullableId(dto.conversionTemplateId) ? [this.cleanNullableId(dto.conversionTemplateId)] : []);
    }
    if (nextProductType === 'order' && dto.inventoryConversions !== undefined) {
      this.assertUnitConversionRows(dto.inventoryConversions);
    }
    const updated = await this.prisma.orderProduct.update({
      where: { id },
      data: this.buildProductUpdateInput(dto, sectionList, nextProductType),
      include: { category: true, conversionTemplate: true },
    });
    return enrichProductWithSectionIds(updated, sectionList);
  }

  private async hasProductInventoryHistory(productId: string, companyId: string) {
    const [purchaseCount, saleCount, movementCount] = await Promise.all([
      this.prisma.orderItem.count({
        where: { productId, order: { companyId } },
      }),
      this.prisma.staffOrderItem.count({
        where: { productId, staffOrder: { companyId } },
      }),
      this.prisma.inventoryMovement.count({
        where: { productId, companyId },
      }),
    ]);
    return purchaseCount + saleCount + movementCount > 0;
  }

  async getCategories(companyId: string) {
    return this.prisma.orderCategory.findMany({
      where: { companyId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { nameAr: 'asc' }],
    });
  }

  async createCategoriesBatch(companyId: string, categories: Array<{ nameAr: string; nameEn?: string; sortOrder?: number }>) {
    const tenantId = TenantContext.getTenantId();
    const data = categories
      .filter((dto) => !!dto.nameAr?.trim())
      .map((dto) => ({
        tenantId,
        companyId,
        nameAr: dto.nameAr.trim(),
        nameEn: dto.nameEn?.trim() || null,
        sortOrder: dto.sortOrder ?? 0,
      }));
    return data.length === 0 ? [] : this.prisma.orderCategory.createManyAndReturn({ data });
  }

  async createCategory(companyId: string, dto: { nameAr: string; nameEn?: string; sortOrder?: number }) {
    const tenantId = TenantContext.getTenantId();
    if (!dto.nameAr?.trim()) throw new BadRequestException('اسم الفئة بالعربية مطلوب');
    return this.prisma.orderCategory.create({
      data: {
        tenantId,
        companyId,
        nameAr: dto.nameAr.trim(),
        nameEn: dto.nameEn?.trim() || null,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateCategory(id: string, companyId: string, dto: {
    nameAr?: string;
    nameEn?: string | null;
    sortOrder?: number;
    isActive?: boolean;
  }) {
    const category = await this.prisma.orderCategory.findFirst({ where: { id, companyId } });
    if (!category) throw new NotFoundException('الفئة غير موجودة');
    return this.prisma.orderCategory.update({
      where: { id },
      data: {
        ...(dto.nameAr !== undefined ? { nameAr: dto.nameAr.trim() } : {}),
        ...(dto.nameEn !== undefined ? { nameEn: dto.nameEn?.trim() || null } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async getSections(companyId: string) {
    return this.loadSectionList(companyId);
  }

  async createSection(companyId: string, dto: { nameAr: string; nameEn?: string; sortOrder?: number }) {
    const tenantId = TenantContext.getTenantId();
    if (!dto.nameAr?.trim()) throw new BadRequestException('اسم القسم بالعربية مطلوب');
    return this.prisma.orderSection.create({
      data: {
        tenantId,
        companyId,
        nameAr: dto.nameAr.trim(),
        nameEn: dto.nameEn?.trim() || null,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateSection(id: string, companyId: string, dto: { nameAr?: string; nameEn?: string | null; sortOrder?: number }) {
    const section = await this.prisma.orderSection.findFirst({ where: { id, companyId } });
    if (!section) throw new NotFoundException('القسم غير موجود');
    const updated = await this.prisma.orderSection.update({
      where: { id },
      data: {
        ...(dto.nameAr !== undefined ? { nameAr: dto.nameAr.trim() } : {}),
        ...(dto.nameEn !== undefined ? { nameEn: dto.nameEn?.trim() || null } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });
    if (dto.nameAr !== undefined && dto.nameAr.trim() !== section.nameAr) {
      await this.renameSectionInProducts(companyId, id, section.nameAr, updated.nameAr);
    }
    return updated;
  }

  async deleteSection(id: string, companyId: string) {
    const section = await this.prisma.orderSection.findFirst({ where: { id, companyId } });
    if (!section) throw new NotFoundException('القسم غير موجود');
    await this.removeSectionFromProducts(companyId, id, section.nameAr);
    await this.prisma.orderSection.delete({ where: { id } });
    return { deleted: true };
  }

  async bulkSetProductSections(
    companyId: string,
    productIds: string[],
    opts: { sectionNames?: string[]; sectionIds?: string[]; mode?: 'replace' | 'add' },
  ) {
    const mode = opts.mode ?? 'replace';
    const sectionList = await this.loadSectionList(companyId);
    const normalized = normalizeProductSections(sectionList, {
      sections: opts.sectionNames,
      sectionIds: opts.sectionIds,
    });
    const products = await this.prisma.orderProduct.findMany({ where: { id: { in: productIds }, companyId } });
    await Promise.all(
      products.map((product) => {
        const existingIds = parseStringArrayJson(product.sectionIds);
        const existingNames = parseStringArrayJson(product.sections);
        const nextIds = mode === 'add'
          ? [...new Set([...existingIds, ...(normalized.sectionIds ?? [])])]
          : (normalized.sectionIds ?? []);
        const nextNames = mode === 'add'
          ? [...new Set([...existingNames, ...(normalized.sections ?? [])])]
          : (normalized.sections ?? []);
        return this.prisma.orderProduct.update({
          where: { id: product.id },
          data: this.sectionJsonData(nextIds, nextNames),
        });
      }),
    );
    return { updated: products.length };
  }

  async getCatalogUnits(companyId: string) {
    await this.ensureCatalogDefaults(companyId);
    return this.prisma.orderCatalogUnit.findMany({
      where: { companyId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { nameAr: 'asc' }],
    });
  }

  async createCatalogUnit(companyId: string, dto: CatalogUnitInput) {
    const tenantId = TenantContext.getTenantId();
    const code = this.cleanCode(dto.code || dto.nameEn || dto.nameAr);
    if (!code || !dto.nameAr?.trim()) throw new BadRequestException('Catalog unit code and Arabic name are required.');
    return this.prisma.orderCatalogUnit.create({
      data: {
        tenantId,
        companyId,
        code,
        nameAr: dto.nameAr.trim(),
        nameEn: dto.nameEn?.trim() || null,
        kind: dto.kind?.trim() || 'package',
        sortOrder: dto.sortOrder ?? 100,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateCatalogUnit(id: string, companyId: string, dto: CatalogUnitInput) {
    await this.assertCatalogUnit(companyId, id);
    return this.prisma.orderCatalogUnit.update({
      where: { id },
      data: {
        ...(dto.code !== undefined ? { code: this.cleanCode(dto.code) } : {}),
        ...(dto.nameAr !== undefined ? { nameAr: dto.nameAr.trim() } : {}),
        ...(dto.nameEn !== undefined ? { nameEn: dto.nameEn?.trim() || null } : {}),
        ...(dto.kind !== undefined ? { kind: dto.kind?.trim() || 'package' } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async deleteCatalogUnit(id: string, companyId: string) {
    await this.assertCatalogUnit(companyId, id);
    await this.prisma.orderCatalogUnit.update({ where: { id }, data: { isActive: false } });
    return { deleted: true };
  }

  async getConversionTemplates(companyId: string) {
    await this.ensureCatalogDefaults(companyId);
    return this.prisma.orderConversionTemplate.findMany({
      where: { companyId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { nameAr: 'asc' }],
    });
  }

  async createConversionTemplate(companyId: string, dto: ConversionTemplateInput) {
    const tenantId = TenantContext.getTenantId();
    const code = this.cleanCode(dto.code || dto.nameEn || dto.nameAr);
    if (!code || !dto.nameAr?.trim()) throw new BadRequestException('Conversion template code and Arabic name are required.');
    this.assertUnitConversionRows(dto.conversions);
    return this.prisma.orderConversionTemplate.create({
      data: {
        tenantId,
        companyId,
        code,
        nameAr: dto.nameAr.trim(),
        nameEn: dto.nameEn?.trim() || null,
        description: dto.description?.trim() || null,
        conversions: unitConversionsJson(dto.conversions),
        sortOrder: dto.sortOrder ?? 100,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateConversionTemplate(id: string, companyId: string, dto: ConversionTemplateInput) {
    await this.assertConversionTemplates(companyId, [id]);
    if (dto.conversions !== undefined) this.assertUnitConversionRows(dto.conversions);
    return this.prisma.orderConversionTemplate.update({
      where: { id },
      data: {
        ...(dto.code !== undefined ? { code: this.cleanCode(dto.code) } : {}),
        ...(dto.nameAr !== undefined ? { nameAr: dto.nameAr.trim() } : {}),
        ...(dto.nameEn !== undefined ? { nameEn: dto.nameEn?.trim() || null } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
        ...(dto.conversions !== undefined ? { conversions: unitConversionsJson(dto.conversions) } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async deleteConversionTemplate(id: string, companyId: string) {
    await this.assertConversionTemplates(companyId, [id]);
    await this.prisma.orderConversionTemplate.update({ where: { id }, data: { isActive: false } });
    return { deleted: true };
  }

  private buildProductCreateInput(
    tenantId: string,
    companyId: string,
    dto: {
      nameAr: string;
      nameEn?: string | null;
      unit?: string;
      sizes?: string | null;
      packaging?: string | null;
      categoryId?: string | null;
      lastPrice?: string;
      sections?: string[] | null;
      sectionIds?: string[] | null;
      productType?: string;
      variants?: ProductVariantInput[];
      inventoryConversions?: ProductUnitConversionInput[];
      conversionTemplateId?: string | null;
      recipe?: ProductRecipeItemInput[];
    },
    sectionList: Awaited<ReturnType<OrdersCatalogService['loadSectionList']>>,
  ): Prisma.OrderProductCreateManyInput {
    const sections = normalizeProductSections(sectionList, {
      sections: dto.sections ?? undefined,
      sectionIds: dto.sectionIds ?? undefined,
    });
    const productType = dto.productType === 'sale' ? 'sale' : 'order';
    return {
      tenantId,
      companyId,
      nameAr: dto.nameAr.trim(),
      nameEn: dto.nameEn?.trim() || null,
      unit: dto.unit || 'piece',
      sizes: dto.sizes?.trim() || null,
      packaging: dto.packaging?.trim() || null,
      categoryId: dto.categoryId || null,
      productType,
      ...this.sectionJsonData(sections.sectionIds ?? [], sections.sections ?? []),
      lastPrice: dto.lastPrice ? new Prisma.Decimal(dto.lastPrice) : new Prisma.Decimal(0),
      variants: this.variantJson(dto.variants),
      inventoryConversions: productType === 'order'
        ? unitConversionsJson(dto.inventoryConversions)
        : Prisma.DbNull,
      conversionTemplateId: productType === 'order' ? this.cleanNullableId(dto.conversionTemplateId) : null,
      recipe: productType === 'sale' ? this.recipeJson(dto.recipe) : Prisma.DbNull,
    };
  }

  private buildProductUpdateInput(
    dto: {
      nameAr?: string;
      nameEn?: string | null;
      unit?: string;
      sizes?: string | null;
      packaging?: string | null;
      categoryId?: string | null;
      lastPrice?: string;
      sections?: string[] | null;
      sectionIds?: string[] | null;
      productType?: string;
      variants?: ProductVariantInput[];
      inventoryConversions?: ProductUnitConversionInput[];
      conversionTemplateId?: string | null;
      recipe?: ProductRecipeItemInput[];
      isActive?: boolean;
    },
    sectionList: Awaited<ReturnType<OrdersCatalogService['loadSectionList']>>,
    effectiveProductType: string,
  ): Prisma.OrderProductUncheckedUpdateInput {
    const sectionData = dto.sections !== undefined || dto.sectionIds !== undefined
      ? this.sectionJsonData(
          normalizeProductSections(sectionList, {
            sections: dto.sections ?? undefined,
            sectionIds: dto.sectionIds ?? undefined,
          }).sectionIds ?? [],
          normalizeProductSections(sectionList, {
            sections: dto.sections ?? undefined,
            sectionIds: dto.sectionIds ?? undefined,
          }).sections ?? [],
        )
      : {};
    return {
      ...(dto.nameAr !== undefined ? { nameAr: dto.nameAr.trim() } : {}),
      ...(dto.nameEn !== undefined ? { nameEn: dto.nameEn?.trim() || null } : {}),
      ...(dto.unit !== undefined ? { unit: dto.unit } : {}),
      ...(dto.sizes !== undefined ? { sizes: dto.sizes?.trim() || null } : {}),
      ...(dto.packaging !== undefined ? { packaging: dto.packaging?.trim() || null } : {}),
      ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId || null } : {}),
      ...(dto.lastPrice !== undefined ? { lastPrice: new Prisma.Decimal(dto.lastPrice) } : {}),
      ...sectionData,
      ...(dto.productType !== undefined ? { productType: dto.productType } : {}),
      ...(dto.variants !== undefined ? { variants: this.variantJson(dto.variants) } : {}),
      ...(effectiveProductType === 'sale'
        ? { inventoryConversions: Prisma.DbNull, conversionTemplateId: null }
        : dto.inventoryConversions !== undefined
          ? { inventoryConversions: unitConversionsJson(dto.inventoryConversions) }
          : {}),
      ...(effectiveProductType === 'order' && dto.conversionTemplateId !== undefined
        ? { conversionTemplateId: this.cleanNullableId(dto.conversionTemplateId) }
        : {}),
      ...(effectiveProductType === 'order'
        ? { recipe: Prisma.DbNull }
        : dto.recipe !== undefined
          ? { recipe: this.recipeJson(dto.recipe) }
          : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    };
  }

  private async loadSectionList(companyId: string) {
    return this.prisma.orderSection.findMany({
      where: { companyId },
      orderBy: [{ sortOrder: 'asc' }, { nameAr: 'asc' }],
    });
  }

  private async ensureCatalogDefaults(companyId: string) {
    const tenantId = TenantContext.getTenantId();
    const unitsCount = await this.prisma.orderCatalogUnit.count({ where: { companyId } });
    if (unitsCount === 0) {
      await this.prisma.orderCatalogUnit.createMany({
        data: this.defaultCatalogUnits().map((unit) => ({
          tenantId,
          companyId,
          ...unit,
        })),
        skipDuplicates: true,
      });
    }
    const templatesCount = await this.prisma.orderConversionTemplate.count({ where: { companyId } });
    if (templatesCount === 0) {
      await this.prisma.orderConversionTemplate.createMany({
        data: this.defaultConversionTemplates().map((template) => ({
          tenantId,
          companyId,
          ...template,
          conversions: template.conversions,
        })),
        skipDuplicates: true,
      });
    }
  }

  private defaultCatalogUnits() {
    return [
      { code: 'piece', nameAr: 'حبة', nameEn: 'Piece', kind: 'unit', isDefault: true, sortOrder: 1 },
      { code: 'kg', nameAr: 'كيلو', nameEn: 'Kilogram', kind: 'unit', isDefault: true, sortOrder: 2 },
      { code: 'g', nameAr: 'جرام', nameEn: 'Gram', kind: 'unit', isDefault: true, sortOrder: 3 },
      { code: 'l', nameAr: 'لتر', nameEn: 'Liter', kind: 'unit', isDefault: true, sortOrder: 4 },
      { code: 'ml', nameAr: 'مل', nameEn: 'Milliliter', kind: 'unit', isDefault: true, sortOrder: 5 },
      { code: 'box', nameAr: 'صندوق', nameEn: 'Box', kind: 'package', isDefault: true, sortOrder: 10 },
      { code: 'pack', nameAr: 'علبة', nameEn: 'Pack', kind: 'package', isDefault: true, sortOrder: 11 },
      { code: 'half_pack', nameAr: 'نصف علبة', nameEn: 'Half pack', kind: 'package', isDefault: true, sortOrder: 12 },
      { code: 'carton', nameAr: 'كرتون', nameEn: 'Carton', kind: 'package', isDefault: true, sortOrder: 13 },
      { code: 'dozen', nameAr: 'درزن', nameEn: 'Dozen', kind: 'package', isDefault: true, sortOrder: 14 },
      { code: 'bottle', nameAr: 'قارورة', nameEn: 'Bottle', kind: 'package', isDefault: true, sortOrder: 15 },
      { code: 'cup', nameAr: 'كوب', nameEn: 'Cup', kind: 'package', isDefault: true, sortOrder: 16 },
    ];
  }

  private defaultConversionTemplates() {
    return [
      {
        code: 'metric-weight',
        nameAr: 'وزن قياسي',
        nameEn: 'Metric weight',
        description: 'كيلو وجرام',
        conversions: [{ fromUnit: 'kg', toUnit: 'g', multiplier: '1000', label: '1 كيلو = 1000 جرام' }],
        isDefault: true,
        sortOrder: 1,
      },
      {
        code: 'metric-volume',
        nameAr: 'سوائل قياسي',
        nameEn: 'Metric volume',
        description: 'لتر ومل',
        conversions: [{ fromUnit: 'l', toUnit: 'ml', multiplier: '1000', label: '1 لتر = 1000 مل' }],
        isDefault: true,
        sortOrder: 2,
      },
      {
        code: 'dozen-piece',
        nameAr: 'درزن إلى حبة',
        nameEn: 'Dozen to piece',
        description: 'درزن = 12 حبة',
        conversions: [{ fromUnit: 'dozen', toUnit: 'piece', multiplier: '12', label: '1 درزن = 12 حبة' }],
        isDefault: true,
        sortOrder: 3,
      },
    ];
  }

  private async enrichProductsList<T extends OrderProductWithSections>(companyId: string, products: T[]) {
    const sectionList = await this.loadSectionList(companyId);
    return products.map((product) => enrichProductWithSectionIds(product, sectionList));
  }

  private cleanNullableId(value: string | null | undefined) {
    const clean = String(value ?? '').trim();
    return clean || null;
  }

  private cleanCode(value: string | null | undefined) {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9_-]/g, '')
      .slice(0, 48);
  }

  private async assertCatalogUnit(companyId: string, id: string) {
    const unit = await this.prisma.orderCatalogUnit.findFirst({ where: { id, companyId } });
    if (!unit) throw new NotFoundException('Catalog unit not found.');
    return unit;
  }

  private async assertConversionTemplates(companyId: string, ids: Array<string | null>) {
    const cleanIds = [...new Set(ids.map((id) => this.cleanNullableId(id)).filter((id): id is string => Boolean(id)))];
    if (cleanIds.length === 0) return;
    const rows = await this.prisma.orderConversionTemplate.findMany({
      where: { companyId, id: { in: cleanIds }, isActive: true },
      select: { id: true },
    });
    if (rows.length !== cleanIds.length) {
      throw new BadRequestException('Conversion template is not available for this company.');
    }
  }

  private assertUnitConversionRows(conversions?: ProductUnitConversionInput[] | null) {
    const issues = validateProductUnitConversions(conversions);
    if (issues.length === 0) return;
    throw new BadRequestException(issues.map((issue) => issue.message).join(' '));
  }

  private variantJson(variants?: ProductVariantInput[]): Prisma.InputJsonValue | typeof Prisma.DbNull {
    if (!variants?.length) return Prisma.DbNull;
    return variants.map((variant) => ({
      size: variant.size || '',
      packaging: variant.packaging || '',
      unit: variant.unit || 'piece',
      lastPrice: variant.lastPrice || '0',
      quantityMultiplier: variant.quantityMultiplier || '1',
    }));
  }

  private recipeJson(recipe?: ProductRecipeItemInput[]): Prisma.InputJsonValue | typeof Prisma.DbNull {
    if (!recipe?.length) return Prisma.DbNull;
    const rows = recipe.flatMap((item) => {
      const materialType = this.recipeMaterialType(item.materialType);
      const materialProductId = String(item.materialProductId ?? '').trim();
      const quantity = String(item.quantity ?? '').trim();
      if (!materialProductId || !this.positiveDecimal(quantity)) return [];
      return [{
        materialType,
        materialProductId,
        quantity,
        unit: String(item.unit ?? '').trim() || this.defaultRecipeUnit(materialType),
      }];
    });
    return rows.length > 0 ? rows : Prisma.DbNull;
  }

  private recipeMaterialIds(recipe?: ProductRecipeItemInput[]): string[] {
    if (!recipe?.length) return [];
    return [...new Set(recipe.flatMap((item) => {
      const materialProductId = String(item.materialProductId ?? '').trim();
      const quantity = String(item.quantity ?? '').trim();
      return materialProductId && this.positiveDecimal(quantity) ? [materialProductId] : [];
    }))];
  }

  private async assertRecipeMaterialProducts(companyId: string, recipe?: ProductRecipeItemInput[]) {
    const materialIds = this.recipeMaterialIds(recipe);
    if (materialIds.length === 0) return;
    const validMaterials = await this.prisma.orderProduct.findMany({
      where: {
        companyId,
        id: { in: materialIds },
        isActive: true,
        productType: 'order',
      },
      select: {
        id: true,
        nameAr: true,
        unit: true,
        inventoryConversions: true,
        conversionTemplate: { select: { conversions: true } },
      },
    });
    if (validMaterials.length !== materialIds.length) {
      throw new BadRequestException('Recipe components must be purchase/inventory products only.');
    }
    const materialById = new Map(validMaterials.map((material) => [material.id, material]));
    for (const item of recipe ?? []) {
      const materialProductId = String(item.materialProductId ?? '').trim();
      const quantity = String(item.quantity ?? '').trim();
      if (!materialProductId || !this.positiveDecimal(quantity)) continue;
      const material = materialById.get(materialProductId);
      if (!material) continue;
      const recipeUnit = String(item.unit ?? '').trim() || this.defaultRecipeUnit(this.recipeMaterialType(item.materialType));
      const baseUnit = String(material.unit || recipeUnit || 'piece').trim() || 'piece';
      if (!resolveProductUnitMultiplierOrNull(material, recipeUnit, baseUnit)) {
        throw new BadRequestException(
          `Recipe material "${material.nameAr}" cannot convert from "${recipeUnit}" to stock unit "${baseUnit}".`,
        );
      }
    }
  }

  private recipeMaterialType(value: string | null | undefined) {
    const materialType = String(value ?? '').trim();
    if (materialType === 'tobacco' || materialType === 'hose' || materialType === 'charcoal') return materialType;
    return 'material';
  }

  private positiveDecimal(value: string): boolean {
    try {
      return new Prisma.Decimal(value || 0).gt(0);
    } catch {
      return false;
    }
  }

  private defaultRecipeUnit(materialType: string) {
    if (materialType === 'tobacco') return 'g';
    return 'piece';
  }

  private sectionJsonData(sectionIds: string[], sections: string[]) {
    return {
      sectionIds: sectionIds.length > 0 ? sectionIds : Prisma.DbNull,
      sections: sections.length > 0 ? sections : Prisma.DbNull,
    };
  }

  private async renameSectionInProducts(companyId: string, sectionId: string, oldName: string, newName: string) {
    const products = await this.prisma.orderProduct.findMany({ where: { companyId, isActive: true } });
    await Promise.all(
      products.map((product) => {
        const ids = parseStringArrayJson(product.sectionIds);
        if (!ids.includes(sectionId)) return Promise.resolve();
        const names = parseStringArrayJson(product.sections).map((name) => (name === oldName ? newName : name));
        return this.prisma.orderProduct.update({
          where: { id: product.id },
          data: { sections: names.length > 0 ? names : Prisma.DbNull },
        });
      }),
    );
  }

  private async removeSectionFromProducts(companyId: string, sectionId: string, sectionName: string) {
    const products = await this.prisma.orderProduct.findMany({ where: { companyId, isActive: true } });
    await Promise.all(
      products.map((product) => {
        const existingIds = parseStringArrayJson(product.sectionIds);
        const existingNames = parseStringArrayJson(product.sections);
        const ids = existingIds.filter((id) => id !== sectionId);
        const names = existingNames.filter((name) => name !== sectionName);
        if (ids.length === existingIds.length && names.length === existingNames.length) {
          return Promise.resolve();
        }
        return this.prisma.orderProduct.update({
          where: { id: product.id },
          data: this.sectionJsonData(ids, names),
        });
      }),
    );
  }
}
