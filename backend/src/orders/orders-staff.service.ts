import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { TenantContext } from '../common/tenant-context';
import { PERMISSIONS } from '../auth/constants/permissions';
import { resolveStaffItemVariant } from './orders-staff-pricing.util';
import {
  buildStaffSaleLogRef,
  staffSaleLogRefPrefix,
} from './orders-staff-log-ref.util';
import { buildSalesReportSince } from './orders-staff-sales-report.util';
import {
  buildSalesWhatsAppTextCombined,
  buildStaffPurchaseWhatsAppText,
} from './orders-staff-whatsapp.util';
import { dateToSaudiYmd, saudiDateYmd } from '../hr/utils/hr-saudi-dates.util';
import { parseSaleDateYmd } from './orders-staff-date.util';
import { suggestNextStaffRegistrationDate } from './orders-staff-registration-coverage.util';
import { resolveProductSection } from './orders-staff-sections.util';
import { CreateStaffOrderDto, StaffOrderItemInput, StaffOrderEntryType } from './orders-staff.types';
import { OrdersStaffReportService } from './orders-staff-report.service';
import {
  normalizeCancellationReasons,
  staffCancellationVariantKey,
} from './orders-staff-cancellation.util';
import { canEditStaffSaleRecordByLatest } from './orders-staff-edit-policy.util';

@Injectable()
export class OrdersStaffService {
  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly report: OrdersStaffReportService,
  ) {}

  private isPrivilegedStaffOrderUser(userRole?: string): boolean {
    const role = String(userRole || '').toLowerCase();
    return role === 'owner' || role === 'super_admin';
  }

  private hasStaffPermission(userPermissions: string[] | undefined, permission: string): boolean {
    return Array.isArray(userPermissions) && userPermissions.includes(permission);
  }

  private resolveAllowedStaffOrderTypes(
    userRole?: string,
    userPermissions?: string[],
  ): { order: boolean; sale: boolean } {
    if (this.isPrivilegedStaffOrderUser(userRole)) return { order: true, sale: true };
    return {
      order: this.hasStaffPermission(userPermissions, PERMISSIONS.ORDERS_STAFF_SUBMIT),
      sale: this.hasStaffPermission(userPermissions, PERMISSIONS.STAFF_ORDERS_SUBMIT),
    };
  }

  private assertStaffOrderTypeAccess(
    orderType: 'order' | 'sale',
    userRole?: string,
    userPermissions?: string[],
  ): void {
    const allowed = this.resolveAllowedStaffOrderTypes(userRole, userPermissions);
    if (allowed[orderType]) return;
    throw new ForbiddenException(
      orderType === 'sale'
        ? 'لا تملك صلاحية التسجيل الداخلي.'
        : 'لا تملك صلاحية إرسال طلبات الأقسام.',
    );
  }

  private async assertLatestEditableStaffSaleOrder(
    order: { id: string; companyId: string; userId: string; orderType?: string | null; logRef?: string | null },
    userRole?: string,
  ): Promise<void> {
    if (order.orderType !== 'sale') return;

    const where: Prisma.StaffOrderWhereInput = {
      companyId: order.companyId,
      userId: order.userId,
      orderType: 'sale',
    };
    const tenantId = TenantContext.tryGetTenantId();
    if (tenantId) where.tenantId = tenantId;

    const latest = await this.prisma.staffOrder.findFirst({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true, logRef: true },
    });

    if (!canEditStaffSaleRecordByLatest({ target: order, latest, role: userRole })) {
      throw new ForbiddenException('يمكن تعديل آخر تسجيل داخلي فقط.');
    }
  }

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

  async getStaffSaleDateStatus(companyId: string, userId: string, sectionNameInput?: string) {
    const today = saudiDateYmd();
    const sectionName = String(sectionNameInput || '').trim();
    if (!sectionName) {
      return {
        sectionName: '',
        today,
        suggestedDate: today,
        lastSectionDate: null,
        lastUserDate: null,
      };
    }

    const tenantId = TenantContext.tryGetTenantId();
    const baseWhere: Prisma.StaffOrderWhereInput = {
      companyId,
      orderType: 'sale',
      entryType: 'issue',
      sectionName,
      ...(tenantId ? { tenantId } : {}),
    };
    const sectionRows = await this.prisma.staffOrder.findMany({
      where: baseWhere,
      select: { userId: true, saleDate: true, createdAt: true },
    });
    const sectionDates = sectionRows.map((row) => dateToSaudiYmd(row.saleDate ?? row.createdAt)).sort();
    const userDates = sectionRows
      .filter((row) => row.userId === userId)
      .map((row) => dateToSaudiYmd(row.saleDate ?? row.createdAt))
      .sort();
    const lastSectionDate = sectionDates.at(-1) ?? null;
    const lastUserDate = userDates.at(-1) ?? null;

    return {
      sectionName,
      today,
      suggestedDate: suggestNextStaffRegistrationDate(lastSectionDate, today),
      lastSectionDate,
      lastUserDate,
    };
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

  private async mapStaffItemsForCreate(
    companyId: string,
    items: StaffOrderItemInput[],
    entryType: StaffOrderEntryType,
  ) {
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
      const cancellationReasons = normalizeCancellationReasons(it, entryType === 'cancellation');
      return {
        productId: it.productId,
        quantity: qty[i],
        quantityMultiplier: v.quantityMultiplier,
        size: v.size,
        packaging: v.packaging,
        unit: v.unit,
        unitPrice: v.unitPrice,
        notes: it.notes?.trim() || null,
        cancellationReasons,
      };
    });
  }

  private async assertCancellationAvailability(
    companyId: string,
    sectionName: string,
    saleDate: Date,
    items: Awaited<ReturnType<OrdersStaffService['mapStaffItemsForCreate']>>,
  ) {
    const recordedItems = await this.prisma.staffOrderItem.findMany({
      where: {
        staffOrder: {
          companyId,
          orderType: 'sale',
          sectionName,
          saleDate,
        },
      },
      select: {
        productId: true,
        quantity: true,
        size: true,
        packaging: true,
        unit: true,
      },
    });
    const availableByVariant = new Map<string, Prisma.Decimal>();
    for (const item of recordedItems) {
      const key = staffCancellationVariantKey(item);
      availableByVariant.set(
        key,
        (availableByVariant.get(key) ?? new Prisma.Decimal(0)).plus(item.quantity),
      );
    }

    const requestedByVariant = new Map<string, Prisma.Decimal>();
    for (const item of items) {
      const key = staffCancellationVariantKey(item);
      requestedByVariant.set(
        key,
        (requestedByVariant.get(key) ?? new Prisma.Decimal(0)).plus(item.quantity),
      );
    }

    for (const [key, requested] of requestedByVariant) {
      const available = availableByVariant.get(key) ?? new Prisma.Decimal(0);
      if (requested.gt(available)) {
        throw new BadRequestException(
          `كمية الإلغاء (${requested.toString()}) أكبر من الكمية المسجلة المتاحة (${available.toString()}) لهذا الصنف.`,
        );
      }
    }
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
    entryType: StaffOrderEntryType = 'issue',
  ) {
    const mapped = await this.mapStaffItemsForCreate(dto.companyId, items, entryType);
    if (entryType === 'cancellation') {
      if (!saleDate) throw new BadRequestException('تاريخ الإلغاء مطلوب.');
      await this.assertCancellationAvailability(dto.companyId, sectionName, saleDate, mapped);
    }
    return this.prisma.staffOrder.create({
      data: {
        tenantId,
        companyId: dto.companyId,
        userId,
        sectionName,
        orderType,
        entryType,
        logRef,
        saleDate,
        notes: dto.notes?.trim() || null,
        status: 'sent',
        sentAt,
        items: {
          create: mapped.map((item) => ({
            ...item,
            quantity: entryType === 'cancellation'
              ? new Prisma.Decimal(item.quantity).negated()
              : item.quantity,
            cancellationReasons: item.cancellationReasons ?? Prisma.JsonNull,
          })),
        },
      },
      include: {
        items: { include: { product: true } },
        user: { select: { nameAr: true, nameEn: true } },
      },
    });
  }

  async createStaffOrder(
    userId: string,
    dto: CreateStaffOrderDto,
    userRole?: string,
    userPermissions?: string[],
  ) {
    const tenantId = TenantContext.getTenantId();
    const companyId = String(dto.companyId ?? '').trim();
    if (!companyId) throw new BadRequestException('companyId Ù…Ø·Ù„ÙˆØ¨');
    if (!dto.items?.length) throw new BadRequestException('ÙŠØ¬Ø¨ Ø¥Ø¶Ø§ÙØ© ØµÙ†Ù ÙˆØ§Ø­Ø¯ Ø¹Ù„Ù‰ Ø§Ù„Ø£Ù‚Ù„');

    const orderType = dto.orderType === 'sale' ? 'sale' : 'order';
    this.assertStaffOrderTypeAccess(orderType, userRole, userPermissions);
    const entryType: StaffOrderEntryType = dto.entryType === 'cancellation' ? 'cancellation' : 'issue';
    const lang: 'ar' | 'en' = dto.lang === 'en' ? 'en' : 'ar';
    const isSale = orderType === 'sale';
    if (!isSale && entryType === 'cancellation') {
      throw new BadRequestException('الإلغاء متاح في التسجيل الداخلي فقط.');
    }
    const saleDate = isSale ? parseSaleDateYmd(dto.saleDate || saudiDateYmd()) : null;
    const sentAt = new Date();

    const grouped = await this.groupItemsBySection(companyId, dto.items, dto.sectionName);
    const sectionEntries = [...grouped.entries()];
    if (isSale && sectionEntries.length !== 1) {
      throw new BadRequestException('يجب تسجيل كل قسم بشكل مستقل في التسجيل الداخلي.');
    }
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
          entryType,
        ),
      );
    }

    if (!isSale) {
      const sections = orders.map((order) => ({
        sectionName: order.sectionName,
        orders: [order],
      }));
      const whatsAppText = buildStaffPurchaseWhatsAppText(
        sections,
        saudiDateYmd().replace(/-/g, '/'),
        lang,
      );
      const primary = orders[0];
      return { ...primary, orders, count: orders.length, whatsAppText };
    }

    const whatsAppText = buildSalesWhatsAppTextCombined(orders, saleDate!, lang, saleLogRef);
    const primary = orders[0];
    return { ...primary, orders, count: orders.length, logRef: saleLogRef, whatsAppText };
  }

  async getMyStaffOrders(
    companyId: string,
    userId: string,
    days = 30,
    userRole?: string,
    userPermissions?: string[],
  ) {
    // Ù†ÙØ³ Ù†Ø§ÙØ°Ø© ØªÙ‚Ø±ÙŠØ± Ø§Ù„Ù…Ø¨ÙŠØ¹Ø§Øª â€” createdAt Ø£Ùˆ saleDate Ø¯Ø§Ø®Ù„ Ø§Ù„ÙØªØ±Ø©
    const since = buildSalesReportSince(days);
    const tenantId = TenantContext.tryGetTenantId();
    const where: Prisma.StaffOrderWhereInput = {
      companyId,
      userId,
      OR: [{ createdAt: { gte: since } }, { saleDate: { gte: since } }],
    };
    const allowed = this.resolveAllowedStaffOrderTypes(userRole, userPermissions);
    if (!allowed.order && !allowed.sale) return [];
    if (allowed.order !== allowed.sale) {
      where.orderType = allowed.sale ? 'sale' : 'order';
    }
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
    userRole: string | undefined,
    userPermissions: string[] | undefined,
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
    this.assertStaffOrderTypeAccess(order.orderType === 'sale' ? 'sale' : 'order', userRole, userPermissions);

    const isSale = order.orderType === 'sale';
    if (!isSale) {
      throw new BadRequestException('Ù„Ø§ ÙŠÙ…ÙƒÙ† ØªØ¹Ø¯ÙŠÙ„ Ø·Ù„Ø¨ ØªÙ… Ø¥Ø±Ø³Ø§Ù„Ù‡');
    }
    if (order.entryType === 'cancellation') {
      throw new BadRequestException('عملية الإلغاء محفوظة كسجل رقابي ولا يمكن تعديلها.');
    }
    await this.assertLatestEditableStaffSaleOrder(order, userRole);

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
      const mapped = await this.mapStaffItemsForCreate(companyId, sectionItems, 'issue');
      await this.prisma.staffOrderItem.deleteMany({ where: { staffOrderId: id } });
      data.items = {
        create: mapped.map((item) => ({
          ...item,
          cancellationReasons: item.cancellationReasons ?? Prisma.JsonNull,
        })),
      };
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

  /** Reopen WhatsApp for an operational section order or an internal log. */
  async resendStaffOrder(
    id: string,
    companyId: string,
    userId: string,
    lang: 'ar' | 'en' = 'ar',
    userRole?: string,
    userPermissions?: string[],
  ) {
    const order = await this.prisma.staffOrder.findFirst({
      where: { id, companyId },
      include: {
        items: { include: { product: true } },
        user: { select: { nameAr: true, nameEn: true } },
      },
    });
    if (!order) throw new NotFoundException('Ø§Ù„Ù…Ø¨ÙŠØ¹Ø§Øª ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯Ø©');
    if (order.userId !== userId) throw new ForbiddenException('Ù„Ø§ ÙŠÙ…ÙƒÙ† Ø¥Ø¹Ø§Ø¯Ø© Ø¥Ø±Ø³Ø§Ù„ Ù…Ø¨ÙŠØ¹Ø§Øª Ù…ÙˆØ¸Ù Ø¢Ø®Ø±');
    this.assertStaffOrderTypeAccess(order.orderType === 'sale' ? 'sale' : 'order', userRole, userPermissions);

    if (order.orderType !== 'sale') {
      if (order.status !== 'sent') {
        await this.prisma.staffOrder.update({
          where: { id: order.id },
          data: { status: 'sent', sentAt: new Date() },
        });
      }
      const whatsAppText = buildStaffPurchaseWhatsAppText(
        [{ sectionName: order.sectionName, orders: [order] }],
        dateToSaudiYmd(order.createdAt).replace(/-/g, '/'),
        lang,
      );
      return { whatsAppText, logRef: null };
    }

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

  async deleteStaffOrder(
    id: string,
    companyId: string,
    userId: string,
    userRole?: string,
    userPermissions?: string[],
  ) {
    const order = await this.prisma.staffOrder.findFirst({ where: { id, companyId } });
    if (!order) throw new NotFoundException('Ø§Ù„Ø·Ù„Ø¨ ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯');
    if (order.userId !== userId) throw new ForbiddenException('Ù„Ø§ ÙŠÙ…ÙƒÙ† Ø­Ø°Ù Ø·Ù„Ø¨ Ù…ÙˆØ¸Ù Ø¢Ø®Ø±');
    this.assertStaffOrderTypeAccess(order.orderType === 'sale' ? 'sale' : 'order', userRole, userPermissions);
    if (order.orderType !== 'sale') {
      throw new BadRequestException('Ù„Ø§ ÙŠÙ…ÙƒÙ† Ø­Ø°Ù Ø·Ù„Ø¨ ØªÙ… Ø¥Ø±Ø³Ø§Ù„Ù‡');
    }
    if (order.entryType === 'cancellation') {
      throw new BadRequestException('عملية الإلغاء محفوظة كسجل رقابي ولا يمكن حذفها.');
    }
    await this.assertLatestEditableStaffSaleOrder(order, userRole);
    await this.prisma.staffOrder.delete({ where: { id } });
    return { deleted: true };
  }

  async getSalesReport(
    companyId: string,
    periodInput: number | { startDate: string; endDate: string } = 30,
  ) {
    return this.report.getSalesReport(companyId, periodInput);
  }
}
