import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { TenantContext } from '../common/tenant-context';
import { resolveStaffItemVariant } from './orders-staff-pricing.util';
import {
  buildStaffSaleLogRef,
  staffSaleLogRefPrefix,
} from './orders-staff-log-ref.util';
import { buildSalesReportSince } from './orders-staff-sales-report.util';
import { buildSalesWhatsAppTextCombined } from './orders-staff-whatsapp.util';
import { saudiDateYmd } from '../hr/utils/hr-saudi-dates.util';
import { parseSaleDateYmd } from './orders-staff-date.util';
import { resolveProductSection } from './orders-staff-sections.util';
import { CreateStaffOrderDto, SendStaffDigestOptions, StaffOrderItemInput } from './orders-staff.types';
import { OrdersStaffDigestService } from './orders-staff-digest.service';
import { OrdersStaffReportService } from './orders-staff-report.service';

@Injectable()
export class OrdersStaffService {
  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly digest: OrdersStaffDigestService,
    private readonly report: OrdersStaffReportService,
  ) {}

  private async countStaffSaleOperationsForDay(companyId: string, saleDate: Date): Promise<number> {
    const prefix = staffSaleLogRefPrefix(saleDate);
    const rows = await this.prisma.staffOrder.findMany({
      where: { companyId, orderType: 'sale', logRef: { startsWith: prefix } },
      select: { logRef: true },
      distinct: ['logRef'],
    });
    return rows.length;
  }

  private async allocateStaffSaleLogRef(companyId: string, saleDate: Date): Promise<string> {
    const nextSeq = (await this.countStaffSaleOperationsForDay(companyId, saleDate)) + 1;
    return buildStaffSaleLogRef(saleDate, nextSeq);
  }

  /** Ù…Ø¹Ø§ÙŠÙ†Ø© Ø§Ù„Ø±Ù‚Ù… Ø§Ù„ØªØ§Ù„ÙŠ ÙÙŠ Ø³Ù„Ø© Ø§Ù„ØªØ³Ø¬ÙŠÙ„ â€” Ù„Ø§ ÙŠØ­Ø¬Ø² */
  async peekNextStaffSaleLogRef(companyId: string, saleDateYmd: string): Promise<{ logRef: string }> {
    const saleDate = parseSaleDateYmd(saleDateYmd);
    const nextSeq = (await this.countStaffSaleOperationsForDay(companyId, saleDate)) + 1;
    return { logRef: buildStaffSaleLogRef(saleDate, nextSeq) };
  }

  private async groupItemsBySection(
    companyId: string,
    items: StaffOrderItemInput[],
    explicitSection?: string,
  ): Promise<Map<string, StaffOrderItemInput[]>> {
    const groups = new Map<string, StaffOrderItemInput[]>();
    if (explicitSection?.trim()) {
      groups.set(explicitSection.trim(), items);
      return groups;
    }

    const productIds = [...new Set(items.map((it) => it.productId).filter(Boolean))];
    const products = productIds.length
      ? await this.prisma.orderProduct.findMany({
          where: { companyId, id: { in: productIds } },
          select: { id: true, sections: true },
        })
      : [];
    const productMap = new Map(products.map((p) => [p.id, p]));

    for (const it of items) {
      const fromItem = it.sectionName?.trim();
      const fromProduct = resolveProductSection(productMap.get(it.productId));
      const sec = fromItem || fromProduct;
      if (!groups.has(sec)) groups.set(sec, []);
      groups.get(sec)!.push(it);
    }
    return groups;
  }

  private validateItemQuantities(items: StaffOrderItemInput[]): number[] {
    return items.map((it) => {
      const q = parseFloat(it.quantity);
      if (!it.productId || isNaN(q) || q <= 0) throw new BadRequestException('Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„ØµÙ†Ù ØºÙŠØ± ØµØ­ÙŠØ­Ø©');
      return q;
    });
  }

  private async mapStaffItemsForCreate(companyId: string, items: StaffOrderItemInput[]) {
    const productIds = [...new Set(items.map((it) => it.productId).filter(Boolean))];
    const products = productIds.length
      ? await this.prisma.orderProduct.findMany({ where: { companyId, id: { in: productIds } } })
      : [];
    const pmap = new Map(products.map((p) => [p.id, p]));
    const missing = productIds.filter((id) => !pmap.has(id));
    if (missing.length) {
      throw new BadRequestException('ØµÙ†Ù ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯ Ø£Ùˆ Ù„Ø§ ÙŠÙ†ØªÙ…ÙŠ Ù„Ù‡Ø°Ù‡ Ø§Ù„Ø´Ø±ÙƒØ©');
    }
    const qty = this.validateItemQuantities(items);
    return items.map((it, i) => {
      const v = resolveStaffItemVariant(pmap.get(it.productId), it);
      return {
        productId: it.productId,
        quantity: qty[i],
        size: v.size,
        packaging: v.packaging,
        unit: v.unit,
        unitPrice: v.unitPrice,
        notes: it.notes?.trim() || null,
      };
    });
  }

  private async createStaffOrderRecord(
    tenantId: string,
    userId: string,
    dto: CreateStaffOrderDto,
    sectionName: string,
    items: StaffOrderItemInput[],
    orderType: 'order' | 'sale',
    saleDate: Date | null,
    sentAt: Date | null,
    logRef: string | null = null,
  ) {
    const mapped = await this.mapStaffItemsForCreate(dto.companyId, items);
    return this.prisma.staffOrder.create({
      data: {
        tenantId,
        companyId: dto.companyId,
        userId,
        sectionName,
        orderType,
        logRef,
        saleDate,
        notes: dto.notes?.trim() || null,
        status: orderType === 'sale' ? 'sent' : 'pending',
        sentAt,
        items: {
          create: mapped,
        },
      },
      include: {
        items: { include: { product: true } },
        user: { select: { nameAr: true, nameEn: true } },
      },
    });
  }

  async createStaffOrder(userId: string, dto: CreateStaffOrderDto) {
    const tenantId = TenantContext.getTenantId();
    const companyId = String(dto.companyId ?? '').trim();
    if (!companyId) throw new BadRequestException('companyId Ù…Ø·Ù„ÙˆØ¨');
    if (!dto.items?.length) throw new BadRequestException('ÙŠØ¬Ø¨ Ø¥Ø¶Ø§ÙØ© ØµÙ†Ù ÙˆØ§Ø­Ø¯ Ø¹Ù„Ù‰ Ø§Ù„Ø£Ù‚Ù„');

    const orderType = dto.orderType === 'sale' ? 'sale' : 'order';
    const lang: 'ar' | 'en' = dto.lang === 'en' ? 'en' : 'ar';
    const isSale = orderType === 'sale';
    const saleDate = isSale ? parseSaleDateYmd(dto.saleDate || saudiDateYmd()) : null;
    const sentAt = isSale ? new Date() : null;

    const grouped = await this.groupItemsBySection(companyId, dto.items, dto.sectionName);
    const sectionEntries = [...grouped.entries()];
    const saleLogRef = isSale && saleDate ? await this.allocateStaffSaleLogRef(companyId, saleDate) : null;

    const orders: Awaited<ReturnType<typeof this.createStaffOrderRecord>>[] = [];
    for (const [sectionName, sectionItems] of sectionEntries) {
      orders.push(
        await this.createStaffOrderRecord(
          tenantId,
          userId,
          { ...dto, companyId },
          sectionName,
          sectionItems,
          orderType,
          saleDate,
          sentAt,
          saleLogRef,
        ),
      );
    }

    if (!isSale) return orders.length === 1 ? orders[0] : { orders, count: orders.length };

    const whatsAppText = buildSalesWhatsAppTextCombined(orders, saleDate!, lang, saleLogRef);
    const primary = orders[0];
    return { ...primary, orders, count: orders.length, logRef: saleLogRef, whatsAppText };
  }

  async getMyStaffOrders(companyId: string, userId: string, days = 30) {
    // Ù†ÙØ³ Ù†Ø§ÙØ°Ø© ØªÙ‚Ø±ÙŠØ± Ø§Ù„Ù…Ø¨ÙŠØ¹Ø§Øª â€” createdAt Ø£Ùˆ saleDate Ø¯Ø§Ø®Ù„ Ø§Ù„ÙØªØ±Ø©
    const since = buildSalesReportSince(days);
    const tenantId = TenantContext.tryGetTenantId();
    const where: Prisma.StaffOrderWhereInput = {
      companyId,
      userId,
      OR: [{ createdAt: { gte: since } }, { saleDate: { gte: since } }],
    };
    if (tenantId) where.tenantId = tenantId;
    return this.prisma.staffOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { items: { include: { product: true } } },
    });
  }

  async updateStaffOrder(
    id: string,
    companyId: string,
    userId: string,
    dto: {
      sectionName?: string;
      notes?: string;
      saleDate?: string;
      items?: StaffOrderItemInput[];
      lang?: 'ar' | 'en';
    },
  ) {
    const order = await this.prisma.staffOrder.findFirst({ where: { id, companyId } });
    if (!order) throw new NotFoundException('Ø§Ù„Ø·Ù„Ø¨ ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯');
    if (order.userId !== userId) throw new ForbiddenException('Ù„Ø§ ÙŠÙ…ÙƒÙ† ØªØ¹Ø¯ÙŠÙ„ Ø·Ù„Ø¨ Ù…ÙˆØ¸Ù Ø¢Ø®Ø±');

    const isSale = order.orderType === 'sale';
    if (!isSale && order.status !== 'pending') {
      throw new BadRequestException('Ù„Ø§ ÙŠÙ…ÙƒÙ† ØªØ¹Ø¯ÙŠÙ„ Ø·Ù„Ø¨ ØªÙ… Ø¥Ø±Ø³Ø§Ù„Ù‡');
    }

    const lang: 'ar' | 'en' = dto.lang === 'en' ? 'en' : 'ar';
    const data: Prisma.StaffOrderUpdateInput = {};
    if (dto.notes !== undefined) data.notes = dto.notes?.trim() || null;

    if (isSale && dto.saleDate) {
      data.saleDate = parseSaleDateYmd(dto.saleDate);
    }

    if (dto.items?.length) {
      const grouped = await this.groupItemsBySection(companyId, dto.items, dto.sectionName);
      if (grouped.size > 1) {
        throw new BadRequestException(
          'Ù„Ø§ ÙŠÙ…ÙƒÙ† Ø¯Ù…Ø¬ Ø£Ù‚Ø³Ø§Ù… Ù…ØªØ¹Ø¯Ø¯Ø© ÙÙŠ Ø³Ø¬Ù„ Ù…Ø¨ÙŠØ¹Ø§Øª ÙˆØ§Ø­Ø¯ â€” Ø¹Ø¯Ù‘Ù„ ÙƒÙ„ Ù‚Ø³Ù… Ù…Ù† Ù‚Ø§Ø¦Ù…Ø© Ø§Ù„Ù…Ø¨ÙŠØ¹Ø§Øª',
        );
      }
      const [[sectionName, sectionItems]] = grouped.entries();
      data.sectionName = sectionName;
      const mapped = await this.mapStaffItemsForCreate(companyId, sectionItems);
      await this.prisma.staffOrderItem.deleteMany({ where: { staffOrderId: id } });
      data.items = { create: mapped };
    } else if (dto.sectionName?.trim()) {
      data.sectionName = dto.sectionName.trim();
    }

    const updated = await this.prisma.staffOrder.update({
      where: { id },
      data,
      include: {
        items: { include: { product: true } },
        user: { select: { nameAr: true, nameEn: true } },
      },
    });

    if (!isSale) return updated;

    const saleDay = updated.saleDate ?? updated.createdAt;
    const whatsAppText = buildSalesWhatsAppTextCombined([updated], saleDay, lang, updated.logRef);
    return { ...updated, whatsAppText };
  }

  /** Ø¥Ø¹Ø§Ø¯Ø© ÙØªØ­ ÙˆØ§ØªØ³Ø§Ø¨ Ù„Ù…Ø¨ÙŠØ¹Ø§Øª Ù…ÙØ³Ø¬Ù‘Ù„Ø© Ø¯ÙˆÙ† ØªØ¹Ø¯ÙŠÙ„ */
  async resendStaffSale(id: string, companyId: string, userId: string, lang: 'ar' | 'en' = 'ar') {
    const order = await this.prisma.staffOrder.findFirst({
      where: { id, companyId, orderType: 'sale' },
      include: {
        items: { include: { product: true } },
        user: { select: { nameAr: true, nameEn: true } },
      },
    });
    if (!order) throw new NotFoundException('Ø§Ù„Ù…Ø¨ÙŠØ¹Ø§Øª ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯Ø©');
    if (order.userId !== userId) throw new ForbiddenException('Ù„Ø§ ÙŠÙ…ÙƒÙ† Ø¥Ø¹Ø§Ø¯Ø© Ø¥Ø±Ø³Ø§Ù„ Ù…Ø¨ÙŠØ¹Ø§Øª Ù…ÙˆØ¸Ù Ø¢Ø®Ø±');
    const saleDay = order.saleDate ?? order.createdAt;
    const orders = order.logRef
      ? await this.prisma.staffOrder.findMany({
          where: { companyId, orderType: 'sale', logRef: order.logRef },
          orderBy: { sectionName: 'asc' },
          include: {
            items: { include: { product: true } },
            user: { select: { nameAr: true, nameEn: true } },
          },
        })
      : [order];
    const whatsAppText = buildSalesWhatsAppTextCombined(orders, saleDay, lang, order.logRef);
    return { whatsAppText, logRef: order.logRef };
  }

  async deleteStaffOrder(id: string, companyId: string, userId: string) {
    const order = await this.prisma.staffOrder.findFirst({ where: { id, companyId } });
    if (!order) throw new NotFoundException('Ø§Ù„Ø·Ù„Ø¨ ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯');
    if (order.userId !== userId) throw new ForbiddenException('Ù„Ø§ ÙŠÙ…ÙƒÙ† Ø­Ø°Ù Ø·Ù„Ø¨ Ù…ÙˆØ¸Ù Ø¢Ø®Ø±');
    if (order.orderType !== 'sale' && order.status !== 'pending') {
      throw new BadRequestException('Ù„Ø§ ÙŠÙ…ÙƒÙ† Ø­Ø°Ù Ø·Ù„Ø¨ ØªÙ… Ø¥Ø±Ø³Ø§Ù„Ù‡');
    }
    await this.prisma.staffOrder.delete({ where: { id } });
    return { deleted: true };
  }

  /** Ø§Ù„ÙƒØ§Ø´ÙŠØ±: ØªØ§Ø±ÙŠØ® Ø§Ù„Ø¥Ø±Ø³Ø§Ù„Ø§Øª â€” Ø¢Ø®Ø± 30 ÙŠÙˆÙ…Ø§Ù‹ Ù…Ø¬Ù…Ù‘Ø¹Ø© Ø¨ØªØ§Ø±ÙŠØ® Ø§Ù„Ø¥Ø±Ø³Ø§Ù„ */
  async getDigestHistory(companyId: string, days = 30) {
    return this.digest.getDigestHistory(companyId, days);
  }

  async getDigest(companyId: string) {
    return this.digest.getDigest(companyId);
  }

  async sendDigest(companyId: string, orderIds?: string[], opts: SendStaffDigestOptions = {}) {
    return this.digest.sendDigest(companyId, orderIds, opts);
  }

  async getSalesReport(
    companyId: string,
    periodInput: number | { startDate: string; endDate: string } = 30,
  ) {
    return this.report.getSalesReport(companyId, periodInput);
  }
}
