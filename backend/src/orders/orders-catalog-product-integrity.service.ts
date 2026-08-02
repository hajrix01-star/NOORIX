import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import type {
  PersistedProductVariantInput,
  ProductRecipeItemInput,
  ProductVariantInput,
} from './orders-catalog-product.types';
import { findRecipeLinkIntegrityIssues } from './orders-recipe-link-integrity.util';
import {
  type ProductUnitConversionInput,
  productUnitConversionRowsFromUnknown,
  resolveProductUnitMultiplierOrNull,
  validateProductUnitConversions,
} from './orders-unit-conversions.util';

@Injectable()
export class OrdersCatalogProductIntegrityService {
  constructor(private readonly prisma: TenantPrismaService) {}

  async assertConversionTemplates(companyId: string, ids: Array<string | null>) {
    const cleanIds = [...new Set(ids.map((id) => this.cleanNullableId(id)).filter((id): id is string => Boolean(id)))];
    if (cleanIds.length === 0) return new Map<string, ProductUnitConversionInput[]>();
    const rows = await this.prisma.orderConversionTemplate.findMany({
      where: { companyId, id: { in: cleanIds }, isActive: true },
      select: { id: true, conversions: true },
    });
    if (rows.length !== cleanIds.length) {
      throw new BadRequestException('Conversion template is not available for this company.');
    }
    return new Map(rows.map((row) => [
      row.id,
      productUnitConversionRowsFromUnknown(row.conversions),
    ]));
  }

  assertUnitConversionRows(conversions?: ProductUnitConversionInput[] | null) {
    const issues = validateProductUnitConversions(conversions);
    if (issues.length === 0) return;
    throw new BadRequestException(issues.map((issue) => issue.message).join(' '));
  }

  assertProductUnitConversionChain(input: {
    directConversions?: ProductUnitConversionInput[] | null;
    templateConversions?: ProductUnitConversionInput[] | null;
    baseUnit?: unknown;
    variants?: ProductVariantInput[] | null;
  }) {
    const conversions = [
      ...productUnitConversionRowsFromUnknown(input.templateConversions),
      ...productUnitConversionRowsFromUnknown(input.directConversions),
    ];
    this.assertUnitConversionRows(conversions);
    const product = {
      unit: String(input.baseUnit ?? 'piece'),
      inventoryConversions: input.directConversions,
      conversionTemplate: { conversions: input.templateConversions },
    };
    for (const conversion of conversions) {
      const sourceUnit = String(conversion.fromUnit ?? '').trim();
      const targetUnit = String(conversion.toUnit ?? '').trim();
      if (
        !resolveProductUnitMultiplierOrNull(product, sourceUnit, input.baseUnit)
        || !resolveProductUnitMultiplierOrNull(product, targetUnit, input.baseUnit)
      ) {
        throw new BadRequestException(
          `Conversion from "${sourceUnit}" to "${targetUnit}" is not connected to the product inventory unit.`,
        );
      }
    }
    for (const variant of input.variants ?? []) {
      const pricingUnit = String(variant.unit ?? '').trim();
      if (!pricingUnit) {
        throw new BadRequestException('Every price row must select a unit from the product conversion chain.');
      }
      if (!resolveProductUnitMultiplierOrNull(product, pricingUnit, input.baseUnit)) {
        throw new BadRequestException(
          `Pricing unit "${pricingUnit}" is not connected to the product inventory unit.`,
        );
      }
    }
  }

  productVariantsFromUnknown(value: unknown): PersistedProductVariantInput[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
      const row = entry as Record<string, unknown>;
      return [{
        size: String(row.size ?? ''),
        packaging: String(row.packaging ?? ''),
        unit: String(row.unit ?? ''),
        lastPrice: String(row.lastPrice ?? ''),
        quantityMultiplier: String(row.quantityMultiplier ?? ''),
      }];
    });
  }

  productRecipeFromUnknown(value: unknown): ProductRecipeItemInput[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
      const row = entry as Record<string, unknown>;
      return [{
        materialType: String(row.materialType ?? ''),
        materialProductId: String(row.materialProductId ?? ''),
        quantity: String(row.quantity ?? ''),
        unit: String(row.unit ?? ''),
      }];
    });
  }

  variantJson(
    variants?: ProductVariantInput[],
    existingVariants?: PersistedProductVariantInput[],
  ): Prisma.InputJsonValue | typeof Prisma.DbNull {
    if (!variants?.length) return Prisma.DbNull;
    const legacyMultiplierByKey = new Map(
      (existingVariants ?? []).flatMap((variant) => {
        const multiplier = String(variant.quantityMultiplier ?? '').trim();
        return multiplier ? [[this.variantIdentity(variant), multiplier] as const] : [];
      }),
    );
    return variants.map((variant) => {
      const legacyMultiplier = legacyMultiplierByKey.get(this.variantIdentity(variant));
      return {
        size: variant.size || '',
        packaging: variant.packaging || '',
        unit: variant.unit || 'piece',
        lastPrice: variant.lastPrice || '0',
        ...(legacyMultiplier ? { quantityMultiplier: legacyMultiplier } : {}),
      };
    });
  }

  recipeJson(recipe?: ProductRecipeItemInput[]): Prisma.InputJsonValue | typeof Prisma.DbNull {
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

  async assertRecipeMaterialProducts(companyId: string, recipe?: ProductRecipeItemInput[]) {
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
      const materialType = this.recipeMaterialType(item.materialType);
      const recipeUnit = String(item.unit ?? '').trim() || this.defaultRecipeUnit(materialType);
      const baseUnit = String(material.unit || recipeUnit || 'piece').trim() || 'piece';
      if (!resolveProductUnitMultiplierOrNull(material, recipeUnit, baseUnit)) {
        throw new BadRequestException(
          `Recipe material "${material.nameAr}" cannot convert from "${recipeUnit}" to stock unit "${baseUnit}".`,
        );
      }
    }
  }

  async assertDependentRecipesRemainValid(
    companyId: string,
    material: Parameters<typeof findRecipeLinkIntegrityIssues>[0]['material'],
  ) {
    const saleProducts = await this.prisma.orderProduct.findMany({
      where: { companyId, productType: 'sale', isActive: true },
      select: { id: true, nameAr: true, recipe: true },
    });
    const issue = findRecipeLinkIntegrityIssues({ material, saleProducts })[0];
    if (!issue) return;
    if (issue.reason === 'inactive') {
      throw new BadRequestException(
        `Cannot deactivate this inventory product because sale product "${issue.saleProductName}" uses it in a recipe.`,
      );
    }
    if (issue.reason === 'not_inventory') {
      throw new BadRequestException(
        `Cannot change this product type because sale product "${issue.saleProductName}" uses it as inventory.`,
      );
    }
    throw new BadRequestException(
      `Cannot update this inventory product because recipe "${issue.saleProductName}" needs conversion from "${issue.recipeUnit}" to "${issue.materialBaseUnit}". Update the recipe first.`,
    );
  }

  private recipeMaterialIds(recipe?: ProductRecipeItemInput[]): string[] {
    if (!recipe?.length) return [];
    return [...new Set(recipe.flatMap((item) => {
      const materialProductId = String(item.materialProductId ?? '').trim();
      const quantity = String(item.quantity ?? '').trim();
      return materialProductId && this.positiveDecimal(quantity) ? [materialProductId] : [];
    }))];
  }

  private cleanNullableId(value: string | null | undefined) {
    const clean = String(value ?? '').trim();
    return clean || null;
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

  private variantIdentity(variant: ProductVariantInput) {
    return [variant.size, variant.packaging, variant.unit]
      .map((value) => String(value ?? '').trim())
      .join('|');
  }
}
