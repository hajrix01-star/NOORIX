import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContext } from '../common/tenant-context';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import {
  canonicalOrderSections,
  cleanOrderSectionName,
  enrichProductWithSectionIds,
  normalizeProductSections,
  orderSectionIdentity,
  parseStringArrayJson,
} from './orders-product-sections.util';
import {
  type ProductUnitConversionInput,
  productUnitConversionRowsFromUnknown,
  unitConversionsJson,
} from './orders-unit-conversions.util';
import { OrdersCatalogProductIntegrityService } from './orders-catalog-product-integrity.service';
import type {
  PersistedProductVariantInput,
  ProductRecipeItemInput,
  ProductVariantInput,
} from './orders-catalog-product.types';

type OrderProductWithSections = { sections?: unknown; sectionIds?: unknown };

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

@Injectable()
export class OrdersCatalogService {
  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly productIntegrity: OrdersCatalogProductIntegrityService,
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
    await this.productIntegrity.assertRecipeMaterialProducts(
      companyId,
      products.flatMap((dto) => (dto.productType === 'sale' ? (dto.recipe ?? []) : [])),
    );
    const conversionTemplates = await this.productIntegrity.assertConversionTemplates(
      companyId,
      products
        .map((dto) => this.cleanNullableId(dto.conversionTemplateId))
        .filter((id): id is string => Boolean(id)),
    );
    for (const dto of products) {
      const conversionTemplateId = this.cleanNullableId(dto.conversionTemplateId);
      this.productIntegrity.assertProductUnitConversionChain({
        directConversions: dto.inventoryConversions,
        templateConversions: conversionTemplateId
          ? conversionTemplates.get(conversionTemplateId) ?? []
          : [],
        baseUnit: dto.unit,
        variants: dto.variants,
      });
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
      await this.productIntegrity.assertRecipeMaterialProducts(companyId, dto.recipe);
    }
    const conversionTemplateId = this.cleanNullableId(dto.conversionTemplateId);
    const conversionTemplates = await this.productIntegrity.assertConversionTemplates(
      companyId,
      conversionTemplateId ? [conversionTemplateId] : [],
    );
    this.productIntegrity.assertProductUnitConversionChain({
      directConversions: dto.inventoryConversions,
      templateConversions: conversionTemplateId
        ? conversionTemplates.get(conversionTemplateId) ?? []
        : [],
      baseUnit: dto.unit,
      variants: dto.variants,
    });
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
    const product = await this.prisma.orderProduct.findFirst({
      where: { id, companyId },
      include: { conversionTemplate: { select: { conversions: true } } },
    });
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
    const nextIsActive = dto.isActive ?? product.isActive;
    if (
      nextProductType === 'sale'
      && nextIsActive
      && (dto.recipe !== undefined || dto.productType !== undefined || dto.isActive !== undefined)
    ) {
      await this.productIntegrity.assertRecipeMaterialProducts(
        companyId,
        dto.recipe ?? this.productIntegrity.productRecipeFromUnknown(product.recipe),
      );
    }
    const changesConversionDefinition = dto.productType !== undefined
      || dto.unit !== undefined
      || dto.variants !== undefined
      || dto.inventoryConversions !== undefined
      || dto.conversionTemplateId !== undefined;
    const conversionTemplateId = dto.conversionTemplateId !== undefined
      ? this.cleanNullableId(dto.conversionTemplateId)
      : product.conversionTemplateId;
    const conversionTemplates = dto.conversionTemplateId !== undefined
      ? await this.productIntegrity.assertConversionTemplates(
        companyId,
        conversionTemplateId ? [conversionTemplateId] : [],
      )
      : new Map<string, ProductUnitConversionInput[]>();
    const templateConversions = dto.conversionTemplateId !== undefined
      ? (conversionTemplateId ? conversionTemplates.get(conversionTemplateId) ?? [] : [])
      : productUnitConversionRowsFromUnknown(product.conversionTemplate?.conversions);
    const directConversions = dto.inventoryConversions !== undefined
      ? dto.inventoryConversions
      : productUnitConversionRowsFromUnknown(product.inventoryConversions);
    if (changesConversionDefinition) {
      const variants = dto.variants !== undefined
        ? dto.variants
        : this.productIntegrity.productVariantsFromUnknown(product.variants);
      this.productIntegrity.assertProductUnitConversionChain({
        directConversions,
        templateConversions,
        baseUnit: dto.unit ?? product.unit,
        variants,
      });
    }
    const changesRecipeMaterialContract = dto.unit !== undefined
      || dto.inventoryConversions !== undefined
      || dto.conversionTemplateId !== undefined
      || dto.productType !== undefined
      || dto.isActive !== undefined;
    if (changesRecipeMaterialContract && product.productType === 'order') {
      await this.productIntegrity.assertDependentRecipesRemainValid(companyId, {
        id: product.id,
        nameAr: dto.nameAr ?? product.nameAr,
        productType: nextProductType,
        isActive: nextIsActive,
        unit: dto.unit ?? product.unit,
        inventoryConversions: directConversions,
        conversionTemplate: { conversions: templateConversions },
      });
    }
    const updated = await this.prisma.orderProduct.update({
      where: { id },
      data: this.buildProductUpdateInput(
        dto,
        sectionList,
        nextProductType,
        this.productIntegrity.productVariantsFromUnknown(product.variants),
      ),
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
    const categories = await this.prisma.orderCategory.findMany({
      where: { companyId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { nameAr: 'asc' }],
      include: {
        _count: { select: { products: { where: { isActive: true } } } },
      },
    });
    return categories.map(({ _count, ...category }) => ({
      ...category,
      productCount: _count.products,
    }));
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
    const nameAr = cleanOrderSectionName(dto.nameAr);
    if (!nameAr) throw new BadRequestException('اسم القسم بالعربية مطلوب');
    await this.assertSectionNameAvailable(companyId, nameAr);
    return this.prisma.orderSection.create({
      data: {
        tenantId,
        companyId,
        nameAr,
        nameEn: dto.nameEn?.trim() || null,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateSection(id: string, companyId: string, dto: { nameAr?: string; nameEn?: string | null; sortOrder?: number }) {
    const section = await this.prisma.orderSection.findFirst({ where: { id, companyId } });
    if (!section) throw new NotFoundException('القسم غير موجود');
    const nameAr = dto.nameAr === undefined ? undefined : cleanOrderSectionName(dto.nameAr);
    if (nameAr !== undefined && !nameAr) throw new BadRequestException('اسم القسم بالعربية مطلوب');
    if (nameAr !== undefined && orderSectionIdentity(nameAr) !== orderSectionIdentity(section.nameAr)) {
      await this.assertSectionNameAvailable(companyId, nameAr, id);
    }
    const updated = await this.prisma.orderSection.update({
      where: { id },
      data: {
        ...(nameAr !== undefined ? { nameAr } : {}),
        ...(dto.nameEn !== undefined ? { nameEn: dto.nameEn?.trim() || null } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });
    if (nameAr !== undefined && nameAr !== section.nameAr) {
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
        const requestedIds = mode === 'add'
          ? [...new Set([...existingIds, ...(normalized.sectionIds ?? [])])]
          : (normalized.sectionIds ?? []);
        const requestedNames = mode === 'add'
          ? [...new Set([...existingNames, ...(normalized.sections ?? [])])]
          : (normalized.sections ?? []);
        const next = normalizeProductSections(sectionList, {
          sectionIds: requestedIds,
          sections: requestedNames,
        });
        return this.prisma.orderProduct.update({
          where: { id: product.id },
          data: this.sectionJsonData(next.sectionIds ?? [], next.sections ?? []),
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
    this.productIntegrity.assertUnitConversionRows(dto.conversions);
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
    await this.productIntegrity.assertConversionTemplates(companyId, [id]);
    if (dto.conversions !== undefined) this.productIntegrity.assertUnitConversionRows(dto.conversions);
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
    await this.productIntegrity.assertConversionTemplates(companyId, [id]);
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
      variants: this.productIntegrity.variantJson(dto.variants),
      inventoryConversions: unitConversionsJson(dto.inventoryConversions),
      conversionTemplateId: this.cleanNullableId(dto.conversionTemplateId),
      recipe: productType === 'sale' ? this.productIntegrity.recipeJson(dto.recipe) : Prisma.DbNull,
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
    existingVariants: PersistedProductVariantInput[],
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
      ...(dto.variants !== undefined
        ? { variants: this.productIntegrity.variantJson(dto.variants, existingVariants) }
        : {}),
      ...(dto.inventoryConversions !== undefined
        ? { inventoryConversions: unitConversionsJson(dto.inventoryConversions) }
        : {}),
      ...(dto.conversionTemplateId !== undefined
        ? { conversionTemplateId: this.cleanNullableId(dto.conversionTemplateId) }
        : {}),
      ...(effectiveProductType === 'order'
        ? { recipe: Prisma.DbNull }
        : dto.recipe !== undefined
          ? { recipe: this.productIntegrity.recipeJson(dto.recipe) }
          : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    };
  }

  private async loadSectionList(companyId: string) {
    const sections = await this.prisma.orderSection.findMany({
      where: { companyId },
      orderBy: [{ sortOrder: 'asc' }, { nameAr: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });
    return canonicalOrderSections(sections);
  }

  private async assertSectionNameAvailable(companyId: string, nameAr: string, excludeId?: string) {
    const sections = await this.prisma.orderSection.findMany({
      where: {
        companyId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true, nameAr: true },
    });
    const identity = orderSectionIdentity(nameAr);
    if (sections.some((section) => orderSectionIdentity(section.nameAr) === identity)) {
      throw new BadRequestException('يوجد قسم آخر بالاسم نفسه');
    }
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

  private sectionJsonData(sectionIds: string[], sections: string[]) {
    return {
      sectionIds: sectionIds.length > 0 ? sectionIds : Prisma.DbNull,
      sections: sections.length > 0 ? sections : Prisma.DbNull,
    };
  }

  private async renameSectionInProducts(companyId: string, sectionId: string, oldName: string, newName: string) {
    const products = await this.prisma.orderProduct.findMany({ where: { companyId } });
    const oldIdentity = orderSectionIdentity(oldName);
    await Promise.all(
      products.map((product) => {
        const ids = parseStringArrayJson(product.sectionIds);
        const existingNames = parseStringArrayJson(product.sections);
        if (!ids.includes(sectionId) && !existingNames.some((name) => orderSectionIdentity(name) === oldIdentity)) {
          return Promise.resolve();
        }
        const names = existingNames.map((name) => (
          orderSectionIdentity(name) === oldIdentity ? newName : name
        ));
        return this.prisma.orderProduct.update({
          where: { id: product.id },
          data: { sections: names.length > 0 ? names : Prisma.DbNull },
        });
      }),
    );
  }

  private async removeSectionFromProducts(companyId: string, sectionId: string, sectionName: string) {
    const products = await this.prisma.orderProduct.findMany({ where: { companyId } });
    const sectionIdentity = orderSectionIdentity(sectionName);
    await Promise.all(
      products.map((product) => {
        const existingIds = parseStringArrayJson(product.sectionIds);
        const existingNames = parseStringArrayJson(product.sections);
        const ids = existingIds.filter((id) => id !== sectionId);
        const names = existingNames.filter((name) => orderSectionIdentity(name) !== sectionIdentity);
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
