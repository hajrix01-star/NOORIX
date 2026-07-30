import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { toYmd } from '../common/utils/to-ymd.util';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import type { ShishaSaleEventInput } from './shisha-inventory-calculator.util';

const ZERO = new Prisma.Decimal(0);

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
  ): Promise<ShishaSaleEventInput[]> {
    const orders = await this.prisma.staffOrder.findMany({
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
              select: { nameAr: true, nameEn: true, productType: true, sections: true },
            },
          },
        },
      },
      orderBy: [{ saleDate: 'asc' }, { createdAt: 'asc' }],
    });

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
        events.push({
          date: toYmd(order.saleDate),
          operationKey: order.logRef ?? order.id,
          heads: item.quantity,
          changes: isChange ? item.quantity : ZERO,
          actualCharcoalBoxes: null,
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
