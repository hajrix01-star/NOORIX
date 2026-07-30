import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContext } from '../common/tenant-context';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import {
  enrichProductWithSectionIds,
  normalizeProductSections,
  parseStringArrayJson,
} from './orders-product-sections.util';

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

@Injectable()
export class OrdersCatalogService {
  constructor(private readonly prisma: TenantPrismaService) {}

  async getProducts(companyId: string, section?: string, productType?: string) {
    const all = await this.prisma.orderProduct.findMany({
      where: { companyId, isActive: true, ...(productType ? { productType } : {}) },
      orderBy: [{ sortOrder: 'asc' }, { nameAr: 'asc' }],
      include: { category: true },
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
    recipe?: ProductRecipeItemInput[];
  }>) {
    const tenantId = TenantContext.getTenantId();
    const sectionList = await this.loadSectionList(companyId);
    const data = products
      .filter((dto) => !!dto.nameAr?.trim())
      .map((dto) => this.buildProductCreateInput(tenantId, companyId, dto, sectionList));
    if (data.length === 0) return [];

    const inserted = await this.prisma.orderProduct.createManyAndReturn({ data });
    const rows = await this.prisma.orderProduct.findMany({
      where: { id: { in: inserted.map((row) => row.id) } },
      include: { category: true },
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
    recipe?: ProductRecipeItemInput[];
  }) {
    const tenantId = TenantContext.getTenantId();
    if (!dto.nameAr?.trim()) throw new BadRequestException('اسم الصنف بالعربية مطلوب');
    const sectionList = await this.loadSectionList(companyId);
    const created = await this.prisma.orderProduct.create({
      data: this.buildProductCreateInput(tenantId, companyId, dto, sectionList),
      include: { category: true },
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
    recipe?: ProductRecipeItemInput[];
    isActive?: boolean;
  }) {
    const product = await this.prisma.orderProduct.findFirst({ where: { id, companyId } });
    if (!product) throw new NotFoundException('الصنف غير موجود');
    const sectionList = await this.loadSectionList(companyId);
    const updated = await this.prisma.orderProduct.update({
      where: { id },
      data: this.buildProductUpdateInput(dto, sectionList),
      include: { category: true },
    });
    return enrichProductWithSectionIds(updated, sectionList);
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
      recipe?: ProductRecipeItemInput[];
      isActive?: boolean;
    },
    sectionList: Awaited<ReturnType<OrdersCatalogService['loadSectionList']>>,
  ): Prisma.OrderProductUpdateInput {
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
      ...(dto.productType === 'order'
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

  private async enrichProductsList<T extends OrderProductWithSections>(companyId: string, products: T[]) {
    const sectionList = await this.loadSectionList(companyId);
    return products.map((product) => enrichProductWithSectionIds(product, sectionList));
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
      const materialType = item.materialType === 'tobacco' || item.materialType === 'hose' || item.materialType === 'charcoal'
        ? item.materialType
        : null;
      const materialProductId = String(item.materialProductId ?? '').trim();
      const quantity = String(item.quantity ?? '').trim();
      if (!materialType || !materialProductId || !this.positiveDecimal(quantity)) return [];
      return [{
        materialType,
        materialProductId,
        quantity,
        unit: String(item.unit ?? '').trim() || this.defaultRecipeUnit(materialType),
      }];
    });
    return rows.length > 0 ? rows : Prisma.DbNull;
  }

  private positiveDecimal(value: string): boolean {
    try {
      return new Prisma.Decimal(value || 0).gt(0);
    } catch {
      return false;
    }
  }

  private defaultRecipeUnit(materialType: 'tobacco' | 'hose' | 'charcoal') {
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
