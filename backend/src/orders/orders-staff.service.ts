import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { TenantContext } from '../common/tenant-context';
import { OrdersService } from './orders.service';
import { mapDtoItemsToOrderLines } from './orders-lines.util';
import { resolveStaffItemVariant, staffLineAggregateKey } from './orders-staff-pricing.util';
import {
  buildStaffSaleLogRef,
  staffSaleLogRefPrefix,
  staffSaleOperationKey,
} from './orders-staff-log-ref.util';
import { buildSalesReportSince, staffSaleMatchesReportWindow } from './orders-staff-sales-report.util';
import {
  staffItemLineAmount,
  staffSaleAvgPerOperation,
  staffSaleAvgPerOrder,
} from './orders-staff-amount.util';
import { buildSalesWhatsAppTextCombined, buildStaffPurchaseWhatsAppText } from './orders-staff-whatsapp.util';
import { saudiDateYmd } from '../hr/utils/hr-saudi-dates.util';
import { toYmd } from '../common/utils/to-ymd.util';

export interface StaffOrderItemInput {
  productId: string;
  quantity: string;
  unit?: string;
  size?: string;
  packaging?: string;
  unitPrice?: string;
  notes?: string;
  /** قسم الصنف — يُستنتج من تعريف المنتج إن لم يُمرَّر */
  sectionName?: string;
}

export type SendStaffDigestOptions = {
  lang?: 'ar' | 'en';
  orderType?: 'external' | 'internal';
  pettyCashAmount?: string;
  orderDate?: string;
  createPurchaseOrder?: boolean;
};

export interface CreateStaffOrderDto {
  companyId: string;
  /** اختياري — إن لم يُمرَّر يُجزَّأ الطلب حسب أقسام الأصناف */
  sectionName?: string;
  orderType?: string;  // 'order' | 'sale'
  /** YYYY-MM-DD — يوم المبيعات (تبويبة المبيعات) */
  saleDate?: string;
  notes?: string;
  items: StaffOrderItemInput[];
  lang?: 'ar' | 'en';
}

function parseSaleDateYmd(ymd: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd ?? '').trim());
  if (!m) throw new BadRequestException('تاريخ المبيعات غير صالح');
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function staffOrderDayKey(o: { saleDate?: Date | null; createdAt: Date }): string {
  return toYmd(o.saleDate ?? o.createdAt);
}

@Injectable()
export class OrdersStaffService {
  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly ordersService: OrdersService,
  ) {}

  private resolveProductSection(product: { sections?: unknown } | null | undefined): string {
    const secs = product?.sections as string[] | null;
    if (Array.isArray(secs) && secs.length > 0) return secs[0];
    return 'عام';
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

  /** معاينة الرقم التالي في سلة التسجيل — لا يحجز */
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
      const fromProduct = this.resolveProductSection(productMap.get(it.productId));
      const sec = fromItem || fromProduct;
      if (!groups.has(sec)) groups.set(sec, []);
      groups.get(sec)!.push(it);
    }
    return groups;
  }

  private validateItemQuantities(items: StaffOrderItemInput[]): number[] {
    return items.map((it) => {
      const q = parseFloat(it.quantity);
      if (!it.productId || isNaN(q) || q <= 0) throw new BadRequestException('بيانات الصنف غير صحيحة');
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
      throw new BadRequestException('صنف غير موجود أو لا ينتمي لهذه الشركة');
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
    if (!companyId) throw new BadRequestException('companyId مطلوب');
    if (!dto.items?.length) throw new BadRequestException('يجب إضافة صنف واحد على الأقل');

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
    // نفس نافذة تقرير المبيعات — createdAt أو saleDate داخل الفترة
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
    if (!order) throw new NotFoundException('الطلب غير موجود');
    if (order.userId !== userId) throw new ForbiddenException('لا يمكن تعديل طلب موظف آخر');

    const isSale = order.orderType === 'sale';
    if (!isSale && order.status !== 'pending') {
      throw new BadRequestException('لا يمكن تعديل طلب تم إرساله');
    }

    const lang: 'ar' | 'en' = dto.lang === 'en' ? 'en' : 'ar';
    const data: any = {};
    if (dto.notes !== undefined) data.notes = dto.notes?.trim() || null;

    if (isSale && dto.saleDate) {
      data.saleDate = parseSaleDateYmd(dto.saleDate);
    }

    if (dto.items?.length) {
      const grouped = await this.groupItemsBySection(companyId, dto.items, dto.sectionName);
      if (grouped.size > 1) {
        throw new BadRequestException(
          'لا يمكن دمج أقسام متعددة في سجل مبيعات واحد — عدّل كل قسم من قائمة المبيعات',
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

  /** إعادة فتح واتساب لمبيعات مُسجّلة دون تعديل */
  async resendStaffSale(id: string, companyId: string, userId: string, lang: 'ar' | 'en' = 'ar') {
    const order = await this.prisma.staffOrder.findFirst({
      where: { id, companyId, orderType: 'sale' },
      include: {
        items: { include: { product: true } },
        user: { select: { nameAr: true, nameEn: true } },
      },
    });
    if (!order) throw new NotFoundException('المبيعات غير موجودة');
    if (order.userId !== userId) throw new ForbiddenException('لا يمكن إعادة إرسال مبيعات موظف آخر');
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
    if (!order) throw new NotFoundException('الطلب غير موجود');
    if (order.userId !== userId) throw new ForbiddenException('لا يمكن حذف طلب موظف آخر');
    if (order.orderType !== 'sale' && order.status !== 'pending') {
      throw new BadRequestException('لا يمكن حذف طلب تم إرساله');
    }
    await this.prisma.staffOrder.delete({ where: { id } });
    return { deleted: true };
  }

  /** الكاشير: تاريخ الإرسالات — آخر 30 يوماً مجمّعة بتاريخ الإرسال */
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

    // تجميع بتاريخ اليوم (YYYY-MM-DD بناءً على sentAt)
    const byDate: Record<string, { date: string; sentAt: Date; sections: Record<string, any[]> }> = {};
    for (const o of orders) {
      const d = o.sentAt ?? o.updatedAt;
      const key = d.toISOString().slice(0, 10);
      if (!byDate[key]) byDate[key] = { date: key, sentAt: d, sections: {} };
      const sec = o.sectionName;
      if (!byDate[key].sections[sec]) byDate[key].sections[sec] = [];
      byDate[key].sections[sec].push(o);
    }

    return Object.values(byDate).map((day) => ({
      date: day.date,
      sentAt: day.sentAt,
      sections: Object.entries(day.sections).map(([sectionName, sOrders]) => {
        // دمج الأصناف المتشابهة لكل قسم
        const itemMap: Record<string, { nameAr: string; nameEn: string | null; qty: number; unit: string }> = {};
        for (const o of sOrders as any[]) {
          for (const it of o.items) {
            const key = `${it.productId}|${it.unit || ''}`;
            if (!itemMap[key]) {
              itemMap[key] = {
                nameAr: it.product?.nameAr || '—',
                nameEn: it.product?.nameEn || null,
                qty: 0,
                unit: it.unit || '',
              };
            }
            itemMap[key].qty += Number(it.quantity);
          }
        }
        return {
          sectionName,
          ordersCount: (sOrders as any[]).length,
          items: Object.values(itemMap),
        };
      }),
    }));
  }

  /** المدير/الكاشير: يجلب الطلبات المعلّقة مجمّعة بالقسم */
  async getDigest(companyId: string) {
    const orders = await this.prisma.staffOrder.findMany({
      where: { companyId, orderType: 'order', status: 'pending' },
      orderBy: [{ sectionName: 'asc' }, { createdAt: 'asc' }],
      include: {
        items: { include: { product: true } },
        user: { select: { id: true, nameAr: true, nameEn: true } },
      },
    });

    // تجميع بالقسم
    const grouped: Record<string, { orders: typeof orders; totalItems: number }> = {};
    for (const o of orders) {
      if (!grouped[o.sectionName]) grouped[o.sectionName] = { orders: [], totalItems: 0 };
      grouped[o.sectionName].orders.push(o);
      grouped[o.sectionName].totalItems += o.items.length;
    }

    return {
      sections: Object.entries(grouped).map(([section, { orders: sOrders, totalItems }]) => ({
        sectionName: section,
        totalItems,
        orders: sOrders,
      })),
      totalOrders: orders.length,
      pendingCount: orders.length,
    };
  }

  /** تجميع بنود الطلبات المعلّقة لطلب مشتريات واحد */
  private aggregateStaffOrdersToPurchaseLines(orders: any[]) {
    type Agg = {
      productId: string;
      name: string;
      size: string | null;
      packaging: string | null;
      unit: string | null;
      unitPrice: Prisma.Decimal;
      quantity: Prisma.Decimal;
    };
    const map = new Map<string, Agg>();
    for (const order of orders) {
      for (const it of order.items || []) {
        const v = resolveStaffItemVariant(it.product, {
          size: it.size,
          packaging: it.packaging,
          unit: it.unit,
          unitPrice: it.unitPrice != null ? String(it.unitPrice) : undefined,
        });
        const key = staffLineAggregateKey(it.productId, v.size, v.packaging, v.unit, v.unitPrice);
        const name = it.product?.nameAr || it.product?.nameEn || '—';
        const q = new Prisma.Decimal(it.quantity || 0);
        const cur = map.get(key);
        if (cur) {
          cur.quantity = cur.quantity.plus(q);
        } else {
          map.set(key, {
            productId: it.productId,
            name,
            size: v.size,
            packaging: v.packaging,
            unit: v.unit,
            unitPrice: v.unitPrice,
            quantity: q,
          });
        }
      }
    }
    return [...map.values()];
  }

  /** الكاشير: يرسل الملخص — يعلّم الطلبات، ينشئ طلب مشتريات، ويعيد نص واتساب */
  async sendDigest(companyId: string, orderIds?: string[], opts: SendStaffDigestOptions = {}) {
    const lang = opts.lang === 'en' ? 'en' : 'ar';
    const createPurchaseOrder = opts.createPurchaseOrder !== false;
    const orderType = opts.orderType === 'internal' ? 'internal' : 'external';

    const where: any = { companyId, orderType: 'order', status: 'pending' };
    if (orderIds?.length) where.id = { in: orderIds };

    const orders = await this.prisma.staffOrder.findMany({
      where,
      include: { items: { include: { product: true } } },
    });

    if (!orders.length) throw new BadRequestException('لا توجد طلبات معلّقة');

    const ids = orders.map((o) => o.id);
    const sentAt = new Date();
    const grouped: Record<string, typeof orders> = {};
    for (const o of orders) {
      if (!grouped[o.sectionName]) grouped[o.sectionName] = [];
      grouped[o.sectionName].push(o);
    }

    const aggLines = this.aggregateStaffOrdersToPurchaseLines(orders);
    const purchaseDtoItems = aggLines.map((row) => ({
      productId: row.productId,
      size: row.size || undefined,
      packaging: row.packaging || undefined,
      unit: row.unit || undefined,
      quantity: row.quantity.toString(),
      unitPrice: row.unitPrice.toString(),
    }));
    const mappedOrderLines = mapDtoItemsToOrderLines(purchaseDtoItems);
    const grandTotal = mappedOrderLines.reduce((s, i) => s.plus(i.amount), new Prisma.Decimal(0));

    const now = new Date();
    const dateStr = opts.orderDate?.trim()
      || `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
    const orderDateYmd = opts.orderDate?.trim()
      || now.toISOString().slice(0, 10);

    const sections = Object.entries(grouped).map(([sectionName, sOrders]) => ({ sectionName, orders: sOrders }));
    const whatsAppText = buildStaffPurchaseWhatsAppText(sections, dateStr, lang, grandTotal);

    await this.prisma.staffOrder.updateMany({
      where: { id: { in: ids } },
      data: { status: 'sent', sentAt },
    });

    let purchaseOrder: Awaited<ReturnType<OrdersService['create']>> | null = null;
    if (createPurchaseOrder && purchaseDtoItems.length > 0) {
      try {
        purchaseOrder = await this.ordersService.create(companyId, {
          orderDate: orderDateYmd,
          orderType,
          pettyCashAmount: orderType === 'external' ? opts.pettyCashAmount : undefined,
          notes: lang === 'en'
            ? `Consolidated from ${ids.length} section order(s)`
            : `مجمّع من ${ids.length} طلب قسم`,
          items: purchaseDtoItems,
        });
        await this.prisma.order.update({
          where: { id: purchaseOrder.id },
          data: { sourceStaffOrderIds: ids },
        });
        await this.prisma.staffOrder.updateMany({
          where: { id: { in: ids } },
          data: { purchaseOrderId: purchaseOrder.id },
        });
      } catch (e) {
        await this.prisma.staffOrder.updateMany({
          where: { id: { in: ids } },
          data: { status: 'pending', sentAt: null, purchaseOrderId: null },
        });
        throw e;
      }
    }

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

  /** تقرير المبيعات — orderType = 'sale' */
  async getSalesReport(companyId: string, days = 30) {
    const since = buildSalesReportSince(days);
    const tenantId = TenantContext.tryGetTenantId();
    const where: Prisma.StaffOrderWhereInput = { companyId, orderType: 'sale' };
    if (tenantId) where.tenantId = tenantId;

    // Avoid nullable DATE filters/orderBy and select only fields needed for the report.
    // This keeps old rows with unrelated nullable columns (for example unit_price) from
    // breaking the report while the repair migration backfills them.
    const allSaleOrders = await this.prisma.staffOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        logRef: true,
        userId: true,
        sectionName: true,
        saleDate: true,
        createdAt: true,
        items: {
          select: {
            productId: true,
            quantity: true,
            unit: true,
            unitPrice: true,
          },
        },
      },
    });
    const orders = allSaleOrders.filter((o) => staffSaleMatchesReportWindow(o, since));

    // جلب بيانات المستخدمين بـ query منفصل (تجنب join قد يسبب مشكلة RLS)
    const userIds = [...new Set(orders.map((o) => o.userId))];
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { ...(tenantId ? { tenantId } : {}), id: { in: userIds } },
          select: { id: true, nameAr: true, nameEn: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const productIds = [...new Set(orders.flatMap((o) => o.items.map((it) => it.productId)).filter(Boolean))];
    const products = productIds.length
      ? await this.prisma.orderProduct.findMany({
          where: { companyId, ...(tenantId ? { tenantId } : {}), id: { in: productIds } },
          select: { id: true, nameAr: true, nameEn: true, unit: true },
        })
      : [];
    const productMap = new Map(products.map((p) => [p.id, p]));

    let totalQty = 0;
    let totalAmount = new Prisma.Decimal(0);
    const operationKeys = new Set<string>();
    const userOps: Record<string, Set<string>> = {};
    const dayOps: Record<string, Set<string>> = {};
    const byProduct: Record<string, { productId: string; nameAr: string; nameEn: string | null; qty: number; unit: string; sections: Set<string> }> = {};
    const bySection: Record<string, { sectionName: string; qty: number; ordersCount: number }> = {};
    const byUser: Record<string, { userId: string; nameAr: string; nameEn: string | null; ordersCount: number; qty: number }> = {};
    const byDay: Record<string, { date: string; ordersCount: number; qty: number }> = {};
    const byLog: Record<string, {
      operationKey: string;
      logRef: string | null;
      date: string;
      userId: string;
      qty: number;
      totalAmount: Prisma.Decimal;
      sections: Set<string>;
    }> = {};

    for (const o of orders) {
      const opKey = staffSaleOperationKey(o);
      operationKeys.add(opKey);
      const day = staffOrderDayKey(o);

      if (!byLog[opKey]) {
        byLog[opKey] = {
          operationKey: opKey,
          logRef: o.logRef,
          date: day,
          userId: o.userId,
          qty: 0,
          totalAmount: new Prisma.Decimal(0),
          sections: new Set(),
        };
      }
      byLog[opKey].sections.add(o.sectionName);

      // بالقسم
      if (!bySection[o.sectionName]) bySection[o.sectionName] = { sectionName: o.sectionName, qty: 0, ordersCount: 0 };
      bySection[o.sectionName].ordersCount++;

      // بالمستخدم
      const uid = o.userId;
      const uData = userMap.get(uid);
      if (!byUser[uid]) {
        byUser[uid] = {
          userId: uid,
          nameAr: uData?.nameAr || '—',
          nameEn: uData?.nameEn || null,
          ordersCount: 0,
          qty: 0,
        };
      }
      if (!userOps[uid]) userOps[uid] = new Set();
      userOps[uid].add(opKey);

      // باليوم
      if (!byDay[day]) byDay[day] = { date: day, ordersCount: 0, qty: 0 };
      if (!dayOps[day]) dayOps[day] = new Set();
      dayOps[day].add(opKey);

      for (const it of o.items) {
        const qty = Number(it.quantity);
        const lineAmount = staffItemLineAmount(it);
        totalQty += qty;
        totalAmount = totalAmount.plus(lineAmount);
        bySection[o.sectionName].qty += qty;
        byUser[uid].qty += qty;
        byDay[day].qty += qty;
        byLog[opKey].qty += qty;
        byLog[opKey].totalAmount = byLog[opKey].totalAmount.plus(lineAmount);

        const pid = it.productId;
        const product = productMap.get(pid);
        if (!byProduct[pid]) {
          byProduct[pid] = {
            productId: pid,
            nameAr: product?.nameAr || '—',
            nameEn: product?.nameEn || null,
            qty: 0,
            unit: it.unit || product?.unit || '',
            sections: new Set(),
          };
        }
        byProduct[pid].qty += qty;
        byProduct[pid].sections.add(o.sectionName);
      }
    }

    for (const uid of Object.keys(byUser)) {
      byUser[uid].ordersCount = userOps[uid]?.size ?? 0;
    }
    for (const day of Object.keys(byDay)) {
      byDay[day].ordersCount = dayOps[day]?.size ?? 0;
    }

    const byLogRows = Object.values(byLog)
      .map((row) => {
        const uData = userMap.get(row.userId);
        const avgPerOrder = staffSaleAvgPerOrder(row.totalAmount, row.qty);
        return {
          operationKey: row.operationKey,
          logRef: row.logRef,
          date: row.date,
          userId: row.userId,
          nameAr: uData?.nameAr || '—',
          nameEn: uData?.nameEn || null,
          qty: row.qty,
          totalAmount: Number(row.totalAmount),
          avgPerOrder: Number(avgPerOrder),
          sectionsCount: row.sections.size,
          sections: Array.from(row.sections),
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date) || (b.logRef || '').localeCompare(a.logRef || ''));

    return {
      summary: {
        totalOrders: operationKeys.size,
        totalQty,
        totalAmount: Number(totalAmount),
        avgPerOrder: Number(staffSaleAvgPerOperation(totalAmount, operationKeys.size)),
        uniqueProducts: Object.keys(byProduct).length,
        uniqueSections: Object.keys(bySection).length,
      },
      byProduct: Object.values(byProduct)
        .map((p) => ({ ...p, sections: Array.from(p.sections) }))
        .sort((a, b) => b.qty - a.qty),
      bySection: Object.values(bySection).sort((a, b) => b.qty - a.qty),
      byUser: Object.values(byUser).sort((a, b) => b.qty - a.qty),
      byDay: Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date)),
      byLog: byLogRows,
    };
  }
}
