import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { GeminiService } from '../chat/gemini.service';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

const CATALOG_TRANSLATION_BATCH_SIZE = 15;

function isMissingCatalogTranslation(value: string | null | undefined) {
  const normalized = value?.trim();
  return !normalized || normalized === '-' || normalized === '—';
}

@Injectable()
export class OrdersCatalogTranslationService {
  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly gemini: GeminiService,
  ) {}

  async previewMissingProductTranslations(companyId: string, productType?: string, limit = 30) {
    const products = await this.prisma.orderProduct.findMany({
      where: { companyId, isActive: true, ...(productType ? { productType } : {}) },
      orderBy: [{ sortOrder: 'asc' }, { nameAr: 'asc' }],
      include: { category: true },
    });
    const missing = products.filter((product) => isMissingCatalogTranslation(product.nameEn));
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
      const currentProducts = await tx.orderProduct.findMany({
        where: {
          companyId,
          isActive: true,
          id: { in: [...unique.keys()] },
        },
        select: { id: true, nameEn: true },
      });
      const missingTranslations = currentProducts.filter((product) => (
        isMissingCatalogTranslation(product.nameEn)
      ));
      const updates = await Promise.all(missingTranslations.map((product) => {
        const nameEn = unique.get(product.id);
        if (!nameEn) return Promise.resolve({ count: 0 });
        return tx.orderProduct.updateMany({
          where: {
            id: product.id,
            companyId,
            isActive: true,
            nameEn: product.nameEn,
          },
          data: { nameEn },
        });
      }));
      return updates.reduce((total, update) => total + update.count, 0);
    });

    return {
      updatedCount,
      skippedCount: translations.length - updatedCount,
    };
  }

  async previewMissingCategoryTranslations(companyId: string, limit = 30) {
    const categories = await this.prisma.orderCategory.findMany({
      where: { companyId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { nameAr: 'asc' }],
    });
    const missing = categories.filter((category) => isMissingCatalogTranslation(category.nameEn));
    const requestedLimit = Math.min(Math.max(limit, 1), 50);
    const selected = missing.slice(0, Math.min(requestedLimit, CATALOG_TRANSLATION_BATCH_SIZE));
    if (!selected.length) return { suggestions: [], totalMissing: 0, truncated: false };

    const suggestions = await this.gemini.translateRestaurantCatalogItems(selected.map((category) => ({
      id: category.id,
      nameAr: category.nameAr,
      categoryAr: 'فئة أصناف مطعم',
      productType: 'category',
    })));
    if (!suggestions?.length) {
      throw new ServiceUnavailableException('Catalog translation service returned no usable category suggestions.');
    }

    const byId = new Map(selected.map((category) => [category.id, category]));
    return {
      suggestions: suggestions
        .filter((suggestion) => byId.has(suggestion.id))
        .map((suggestion) => ({
          categoryId: suggestion.id,
          nameAr: byId.get(suggestion.id)?.nameAr ?? '',
          suggestedNameEn: suggestion.suggestedNameEn,
          confidence: suggestion.confidence,
          needsReview: suggestion.needsReview,
        })),
      totalMissing: missing.length,
      truncated: missing.length > selected.length,
    };
  }

  async applyCategoryTranslations(
    companyId: string,
    translations: Array<{ categoryId: string; nameEn: string }>,
  ) {
    const unique = new Map<string, string>();
    for (const translation of translations) {
      const categoryId = translation.categoryId.trim();
      const nameEn = translation.nameEn.replace(/\s+/g, ' ').trim();
      if (!categoryId || !nameEn || nameEn.length > 80) continue;
      unique.set(categoryId, nameEn);
    }
    if (!unique.size) return { updatedCount: 0, skippedCount: translations.length };

    const updatedCount = await this.prisma.withTenant(async (tx) => {
      const currentCategories = await tx.orderCategory.findMany({
        where: {
          companyId,
          isActive: true,
          id: { in: [...unique.keys()] },
        },
        select: { id: true, nameEn: true },
      });
      const missingTranslations = currentCategories.filter((category) => (
        isMissingCatalogTranslation(category.nameEn)
      ));
      const updates = await Promise.all(missingTranslations.map((category) => (
        tx.orderCategory.updateMany({
          where: {
            id: category.id,
            companyId,
            isActive: true,
            nameEn: category.nameEn,
          },
          data: { nameEn: unique.get(category.id) },
        })
      )));
      return updates.reduce((total, update) => total + update.count, 0);
    });

    return { updatedCount, skippedCount: translations.length - updatedCount };
  }
}
