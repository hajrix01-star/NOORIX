import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContext } from '../common/tenant-context';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { OrdersService } from './orders.service';
import { mapDtoItemsToOrderLines } from './orders-lines.util';
import { resolveStaffItemVariant, staffLineAggregateKey } from './orders-staff-pricing.util';
import { buildStaffPurchaseWhatsAppText } from './orders-staff-whatsapp.util';
import { SendStaffDigestOptions } from './orders-staff.types';

type StaffOrderWithItems = Prisma.StaffOrderGetPayload<{
  include: {
    items: { include: { product: true } };
  };
}>;

@Injectable()
export class OrdersStaffDigestService {
  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly ordersService: OrdersService,
  ) {}

  async getDigestHistory(companyId: string, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const orders = await this.prisma.staffOrder.findMany({
      where: { companyId, orderType: 'order', status: 'sent', sentAt: { gte: since } },
      orderBy: [{ sentAt: 'desc' }, { sectionName: 'asc' }],
      include: {
        items: { include: { product: true } },
        user: { select: { id: true, nameAr: true, nameEn: true } },
      },
    });

    type DigestHistoryOrder = (typeof orders)[number];
    const byDate: Record<string, { date: string; sentAt: Date; sections: Record<string, DigestHistoryOrder[]> }> = {};
    for (const order of orders) {
      const sentAt = order.sentAt ?? order.updatedAt;
      const key = sentAt.toISOString().slice(0, 10);
      if (!byDate[key]) byDate[key] = { date: key, sentAt, sections: {} };
      byDate[key].sections[order.sectionName] ??= [];
      byDate[key].sections[order.sectionName].push(order);
    }

    return Object.values(byDate).map((day) => ({
      date: day.date,
      sentAt: day.sentAt,
      sections: Object.entries(day.sections).map(([sectionName, sectionOrders]) => ({
        sectionName,
        ordersCount: sectionOrders.length,
        items: this.mergeSectionItems(sectionOrders),
      })),
    }));
  }

  async getDigest(companyId: string) {
    const orders = await this.prisma.staffOrder.findMany({
      where: { companyId, orderType: 'order', status: 'pending' },
      orderBy: [{ sectionName: 'asc' }, { createdAt: 'asc' }],
      include: {
        items: { include: { product: true } },
        user: { select: { id: true, nameAr: true, nameEn: true } },
      },
    });

    const grouped: Record<string, { orders: typeof orders; totalItems: number }> = {};
    for (const order of orders) {
      grouped[order.sectionName] ??= { orders: [], totalItems: 0 };
      grouped[order.sectionName].orders.push(order);
      grouped[order.sectionName].totalItems += order.items.length;
    }

    return {
      sections: Object.entries(grouped).map(([sectionName, { orders: sectionOrders, totalItems }]) => ({
        sectionName,
        totalItems,
        orders: sectionOrders,
      })),
      totalOrders: orders.length,
      pendingCount: orders.length,
    };
  }

  async sendDigest(companyId: string, orderIds?: string[], opts: SendStaffDigestOptions = {}) {
    const lang = opts.lang === 'en' ? 'en' : 'ar';
    const createPurchaseOrder = opts.createPurchaseOrder !== false;
    const orderType = opts.orderType === 'internal' ? 'internal' : 'external';

    const where: Prisma.StaffOrderWhereInput = { companyId, orderType: 'order', status: 'pending' };
    if (orderIds?.length) where.id = { in: orderIds };

    const orders = await this.prisma.staffOrder.findMany({
      where,
      include: { items: { include: { product: true } } },
    });
    if (!orders.length) throw new BadRequestException('لا توجد طلبات معلقة');

    const ids = orders.map((order) => order.id);
    const grouped = this.groupBySection(orders);
    const purchaseDtoItems = this.aggregateStaffOrdersToPurchaseLines(orders).map((row) => ({
      productId: row.productId,
      size: row.size || undefined,
      packaging: row.packaging || undefined,
      unit: row.unit || undefined,
      quantity: row.quantity.toString(),
      unitPrice: row.unitPrice.toString(),
    }));
    const mappedOrderLines = mapDtoItemsToOrderLines(purchaseDtoItems);
    const grandTotal = mappedOrderLines.reduce((sum, item) => sum.plus(item.amount), new Prisma.Decimal(0));
    const now = new Date();
    const dateStr = opts.orderDate?.trim()
      || `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
    const orderDateYmd = opts.orderDate?.trim() || now.toISOString().slice(0, 10);
    const sections = Object.entries(grouped).map(([sectionName, sectionOrders]) => ({ sectionName, orders: sectionOrders }));
    const whatsAppText = buildStaffPurchaseWhatsAppText(sections, dateStr, lang, grandTotal);

    await this.prisma.staffOrder.updateMany({
      where: { id: { in: ids } },
      data: { status: 'sent', sentAt: new Date() },
    });

    const purchaseOrder = createPurchaseOrder && purchaseDtoItems.length > 0
      ? await this.createLinkedPurchaseOrder(companyId, ids, orderType, orderDateYmd, opts, purchaseDtoItems, lang)
      : null;

    return {
      sent: orders.length,
      whatsAppText,
      purchaseOrder: purchaseOrder
        ? {
            id: purchaseOrder.id,
            orderNumber: purchaseOrder.orderNumber,
            totalAmount: purchaseOrder.totalAmount,
            orderType: purchaseOrder.orderType,
          }
        : null,
      grandTotal: grandTotal.toString(),
    };
  }

  private async createLinkedPurchaseOrder(
    companyId: string,
    sourceStaffOrderIds: string[],
    orderType: 'internal' | 'external',
    orderDate: string,
    opts: SendStaffDigestOptions,
    items: Array<{ productId: string; size?: string; packaging?: string; unit?: string; quantity: string; unitPrice: string }>,
    lang: 'ar' | 'en',
  ) {
    try {
      const purchaseOrder = await this.ordersService.create(companyId, {
        orderDate,
        orderType,
        pettyCashAmount: orderType === 'external' ? opts.pettyCashAmount : undefined,
        notes: lang === 'en'
          ? `Consolidated from ${sourceStaffOrderIds.length} section order(s)`
          : `مجمّع من ${sourceStaffOrderIds.length} طلب قسم`,
        items,
      });
      await this.prisma.order.update({
        where: { id: purchaseOrder.id },
        data: { sourceStaffOrderIds },
      });
      await this.prisma.staffOrder.updateMany({
        where: { id: { in: sourceStaffOrderIds } },
        data: { purchaseOrderId: purchaseOrder.id },
      });
      return purchaseOrder;
    } catch (error) {
      await this.prisma.staffOrder.updateMany({
        where: { id: { in: sourceStaffOrderIds } },
        data: { status: 'pending', sentAt: null, purchaseOrderId: null },
      });
      throw error;
    }
  }

  private mergeSectionItems(orders: readonly StaffOrderWithItems[]) {
    const itemMap: Record<string, { nameAr: string; nameEn: string | null; qty: number; unit: string }> = {};
    for (const order of orders) {
      for (const item of order.items) {
        const key = `${item.productId}|${item.unit || ''}`;
        itemMap[key] ??= {
          nameAr: item.product?.nameAr || '-',
          nameEn: item.product?.nameEn || null,
          qty: 0,
          unit: item.unit || '',
        };
        itemMap[key].qty += Number(item.quantity);
      }
    }
    return Object.values(itemMap);
  }

  private aggregateStaffOrdersToPurchaseLines(orders: readonly StaffOrderWithItems[]) {
    const map = new Map<string, {
      productId: string;
      name: string;
      size: string | null;
      packaging: string | null;
      unit: string | null;
      unitPrice: Prisma.Decimal;
      quantity: Prisma.Decimal;
    }>();
    for (const order of orders) {
      for (const item of order.items || []) {
        const variant = resolveStaffItemVariant(item.product, {
          size: item.size,
          packaging: item.packaging,
          unit: item.unit,
          unitPrice: item.unitPrice != null ? String(item.unitPrice) : undefined,
        });
        const key = staffLineAggregateKey(item.productId, variant.size, variant.packaging, variant.unit, variant.unitPrice);
        const quantity = new Prisma.Decimal(item.quantity || 0);
        const current = map.get(key);
        if (current) current.quantity = current.quantity.plus(quantity);
        else {
          map.set(key, {
            productId: item.productId,
            name: item.product?.nameAr || item.product?.nameEn || '-',
            size: variant.size,
            packaging: variant.packaging,
            unit: variant.unit,
            unitPrice: variant.unitPrice,
            quantity,
          });
        }
      }
    }
    return [...map.values()];
  }

  private groupBySection<T extends { sectionName: string }>(orders: readonly T[]) {
    const grouped: Record<string, T[]> = {};
    for (const order of orders) {
      grouped[order.sectionName] ??= [];
      grouped[order.sectionName].push(order);
    }
    return grouped;
  }
}
