import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { toYmd } from '../common/utils/to-ymd.util';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import type { ShishaSaleEventInput } from './shisha-inventory-calculator.util';
import { normalizeUnit, resolveProductUnitMultiplier } from './orders-unit-conversions.util';

const ZERO = new Prisma.Decimal(0);

type RecipeMaterialType = 'tobacco' | 'hose' | 'charcoal';

type ProductRecipeItem = {
  materialType?: unknown;
  materialProductId?: unknown;
  quantity?: unknown;
  unit?: unknown;
};

type ProductRecipeConsumption = {
  tobaccoGrams: Prisma.Decimal;
  hoses: Prisma.Decimal;
  charcoalPieces: Prisma.Decimal;
  hasTobacco: boolean;
  hasHoses: boolean;
  hasCharcoal: boolean;
};

type ProductRecipeMaterialProduct = {
  id: string;
  nameAr: string;
  nameEn: string | null;
  unit: string | null;
  inventoryConversions?: unknown;
};

function decimal(value: unknown): Prisma.Decimal {
  try {
    return new Prisma.Decimal(String(value ?? 0));
  } catch {
    return ZERO;
  }
}

function recipeItems(value: unknown): ProductRecipeItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ProductRecipeItem => Boolean(item && typeof item === 'object'));
}

function isRecipeMaterialType(value: unknown): value is RecipeMaterialType {
  return value === 'tobacco' || value === 'hose' || value === 'charcoal';
}

function inferRecipeMaterialType(
  item: ProductRecipeItem,
  materialProduct: ProductRecipeMaterialProduct | undefined,
): RecipeMaterialType | null {
  if (isRecipeMaterialType(item.materialType)) return item.materialType;
  const name = `${materialProduct?.nameAr ?? ''} ${materialProduct?.nameEn ?? ''}`.trim().toLowerCase();
  if (!name) return null;
  if (name.includes('معسل') || name.includes('tobacco') || name.includes('molasses')) return 'tobacco';
  if (name.includes('فحم') || name.includes('charcoal') || name.includes('coal')) return 'charcoal';
  if (name.includes('لي') || name.includes('hose')) return 'hose';
  return null;
}

function recipeQuantityBase(
  materialType: RecipeMaterialType,
  quantity: Prisma.Decimal,
  unit: string,
  charcoalPiecesPerPack: number,
  charcoalPacksPerCarton: number,
): Prisma.Decimal {
  if (materialType === 'tobacco') return unit === 'kg' ? quantity.times(1000) : quantity;
  if (materialType === 'charcoal') {
    if (unit === 'carton') return quantity.times(charcoalPacksPerCarton).times(charcoalPiecesPerPack);
    if (unit === 'pack' || unit === 'box') return quantity.times(charcoalPiecesPerPack);
  }
  return quantity;
}

function recipeConsumption(
  recipe: unknown,
  soldQuantity: Prisma.Decimal,
  materialById: Map<string, ProductRecipeMaterialProduct>,
  charcoalPiecesPerPack: number,
  charcoalPacksPerCarton: number,
): ProductRecipeConsumption | null {
  const initial: ProductRecipeConsumption = {
    tobaccoGrams: ZERO,
    hoses: ZERO,
    charcoalPieces: ZERO,
    hasTobacco: false,
    hasHoses: false,
    hasCharcoal: false,
  };
  const result = recipeItems(recipe).reduce<ProductRecipeConsumption>((acc, item) => {
    const materialProductId = String(item.materialProductId ?? '').trim();
    const materialProduct = materialById.get(materialProductId);
    const materialType = inferRecipeMaterialType(item, materialProduct);
    if (!materialType) return acc;
    const quantity = decimal(item.quantity);
    if (!quantity.gt(0)) return acc;
    const unit = String(item.unit ?? '').trim();
    const convertedQuantity = materialProduct
      ? quantity.times(resolveProductUnitMultiplier(
          materialProduct,
          unit,
          normalizeUnit(materialProduct.unit, unit || 'piece'),
        ))
      : quantity;
    const baseQuantity = recipeQuantityBase(
      materialType,
      convertedQuantity,
      normalizeUnit(materialProduct?.unit, unit || 'piece'),
      charcoalPiecesPerPack,
      charcoalPacksPerCarton,
    ).times(soldQuantity);
    if (materialType === 'tobacco') {
      return { ...acc, tobaccoGrams: acc.tobaccoGrams.plus(baseQuantity), hasTobacco: true };
    }
    if (materialType === 'hose') {
      return { ...acc, hoses: acc.hoses.plus(baseQuantity), hasHoses: true };
    }
    return { ...acc, charcoalPieces: acc.charcoalPieces.plus(baseQuantity), hasCharcoal: true };
  }, initial);
  return result.hasTobacco || result.hasHoses || result.hasCharcoal ? result : null;
}

function isShishaSection(value: string | null | undefined): boolean {
  return String(value ?? '').trim() === 'شيشة';
}

export function isCharcoalConsumptionProduct(
  product: { nameAr: string; nameEn: string | null },
  productId: string,
  linkedProductId: string | null,
): boolean {
  const arabicName = product.nameAr.trim();
  const englishName = String(product.nameEn ?? '').trim().toLowerCase();
  return productId === linkedProductId
    || arabicName.includes('فحم')
    || englishName.includes('charcoal');
}

@Injectable()
export class ShishaInventorySourceService {
  constructor(private readonly prisma: TenantPrismaService) {}

  async saleEvents(
    companyId: string,
    trackingStart: Date,
    endDate: Date,
    changeProductId: string | null,
    charcoalConsumptionProductId: string | null,
    charcoalPiecesPerPack: number,
    charcoalPacksPerCarton: number,
  ): Promise<ShishaSaleEventInput[]> {
    const [orders, materialProducts] = await Promise.all([
      this.prisma.staffOrder.findMany({
      where: {
        companyId,
        orderType: 'sale',
        saleDate: { gte: trackingStart, lte: endDate },
      },
      select: {
        id: true,
        logRef: true,
        saleDate: true,
        sectionName: true,
        items: {
          select: {
            quantity: true,
            quantityMultiplier: true,
            productId: true,
            product: {
              select: { nameAr: true, nameEn: true, productType: true, sections: true, recipe: true },
            },
          },
        },
      },
      orderBy: [{ saleDate: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.orderProduct.findMany({
        where: { companyId, productType: 'order', isActive: true },
        select: { id: true, nameAr: true, nameEn: true, unit: true, inventoryConversions: true },
      }),
    ]);
    const materialById = new Map(materialProducts.map((product) => [product.id, product]));

    const events: ShishaSaleEventInput[] = [];
    for (const order of orders) {
      if (!order.saleDate) continue;
      for (const item of order.items) {
        if (isCharcoalConsumptionProduct(
          item.product,
          item.productId,
          charcoalConsumptionProductId,
        )) {
          events.push({
            date: toYmd(order.saleDate),
            operationKey: order.logRef ?? order.id,
            heads: ZERO,
            changes: ZERO,
            actualCharcoalBoxes: item.quantity.times(item.quantityMultiplier),
          });
          continue;
        }
        const sections = Array.isArray(item.product.sections) ? item.product.sections : [];
        const belongsToShisha =
          isShishaSection(order.sectionName) ||
          sections.some((section) => isShishaSection(String(section)));
        if (!belongsToShisha || item.product.productType !== 'sale') continue;
        const isChange =
          item.productId === changeProductId ||
          item.product.nameAr.trim() === 'تغيير';
        const soldQuantity = item.quantity.times(item.quantityMultiplier);
        const consumption = recipeConsumption(
          item.product.recipe,
          soldQuantity,
          materialById,
          charcoalPiecesPerPack,
          charcoalPacksPerCarton,
        );
        events.push({
          date: toYmd(order.saleDate),
          operationKey: order.logRef ?? order.id,
          heads: item.quantity,
          changes: isChange ? item.quantity : ZERO,
          actualCharcoalBoxes: null,
          ...(consumption?.hasTobacco ? { tobaccoGramsConsumed: consumption.tobaccoGrams } : {}),
          ...(consumption?.hasHoses ? { hosesConsumed: consumption.hoses } : {}),
          ...(consumption?.hasCharcoal ? { charcoalPiecesConsumed: consumption.charcoalPieces } : {}),
        });
      }
    }
    return events;
  }

  async catalogCharcoalPurchases(
    companyId: string,
    productId: string | null,
    trackingStartedAt: Date | null,
    endDate: Date,
    piecesPerPack: number,
  ) {
    if (!productId || !trackingStartedAt) return [];
    const items = await this.prisma.orderItem.findMany({
      where: {
        productId,
        order: {
          companyId,
          status: 'active',
          createdAt: { gte: trackingStartedAt },
          orderDate: { lte: endDate },
        },
      },
      select: {
        id: true,
        quantity: true,
        quantityMultiplier: true,
        amount: true,
        order: {
          select: {
            orderDate: true,
            orderNumber: true,
            createdAt: true,
          },
        },
      },
      orderBy: [{ order: { orderDate: 'asc' } }, { id: 'asc' }],
    });
    return items.map((item) => ({
      id: `catalog-charcoal:${item.id}`,
      transactionDate: item.order.orderDate,
      movementType: 'purchase' as const,
      materialType: 'charcoal' as const,
      quantityBase: item.quantity.times(item.quantityMultiplier).times(piecesPerPack),
      costInclVat: item.amount,
      invoiceNumber: item.order.orderNumber,
      supplierName: null,
      notes: 'شراء آلي من صنف فحم في الطلبات',
      createdAt: item.order.createdAt,
      createdBy: null,
      source: 'order_catalog' as const,
    }));
  }
}
