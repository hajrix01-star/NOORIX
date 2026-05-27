import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { TenantContext } from '../common/tenant-context';

export interface StaffOrderItemInput {
  productId: string;
  quantity: string;
  unit?: string;
  notes?: string;
}

export interface CreateStaffOrderDto {
  companyId: string;
  sectionName: string;
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
  if (o.saleDate) return o.saleDate.toISOString().slice(0, 10);
  return o.createdAt.toISOString().slice(0, 10);
}

@Injectable()
export class OrdersStaffService {
  constructor(private readonly prisma: TenantPrismaService) {}

  async createStaffOrder(userId: string, dto: CreateStaffOrderDto) {
    const tenantId = TenantContext.getTenantId();
    if (!dto.items?.length) throw new BadRequestException('يجب إضافة صنف واحد على الأقل');
    if (!dto.sectionName?.trim()) throw new BadRequestException('اسم القسم مطلوب');

    const orderType = dto.orderType === 'sale' ? 'sale' : 'order';
    const lang: 'ar' | 'en' = dto.lang === 'en' ? 'en' : 'ar';

    const qty = dto.items.map((it) => {
      const q = parseFloat(it.quantity);
      if (!it.productId || isNaN(q) || q <= 0) throw new BadRequestException('بيانات الصنف غير صحيحة');
      return q;
    });

    const isSale = orderType === 'sale';
    const saleDate = isSale ? parseSaleDateYmd(dto.saleDate || new Date().toISOString().slice(0, 10)) : null;
    const sentAt = isSale ? new Date() : null;

    const order = await this.prisma.staffOrder.create({
      data: {
        tenantId,
        companyId: dto.companyId,
        userId,
        sectionName: dto.sectionName.trim(),
        orderType,
        saleDate,
        notes: dto.notes?.trim() || null,
        status: isSale ? 'sent' : 'pending',
        sentAt,
        items: {
          create: dto.items.map((it, i) => ({
            productId: it.productId,
            quantity: qty[i],
            unit: it.unit?.trim() || null,
            notes: it.notes?.trim() || null,
          })),
        },
      },
      include: {
        items: { include: { product: true } },
        user: { select: { nameAr: true, nameEn: true } },
      },
    });

    if (!isSale) return order;

    const whatsAppText = this.buildSalesWhatsAppText(order, saleDate!, lang);
    return { ...order, whatsAppText };
  }

  async getMyStaffOrders(companyId: string, userId: string) {
    // طلبات المستخدم في آخر 30 يوم (لا ترحيل — كل يوم/شهر منفصل)
    const since = new Date();
    since.setDate(since.getDate() - 30);
    return this.prisma.staffOrder.findMany({
      where: { companyId, userId, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      include: { items: { include: { product: true } } },
    });
  }

  async updateStaffOrder(
    id: string,
    companyId: string,
    userId: string,
    dto: { sectionName?: string; notes?: string; items?: StaffOrderItemInput[] },
  ) {
    const order = await this.prisma.staffOrder.findFirst({ where: { id, companyId } });
    if (!order) throw new NotFoundException('الطلب غير موجود');
    if (order.userId !== userId) throw new ForbiddenException('لا يمكن تعديل طلب موظف آخر');
    if (order.orderType === 'sale') throw new BadRequestException('لا يمكن تعديل مبيعات مُرسلة');
    if (order.status !== 'pending') throw new BadRequestException('لا يمكن تعديل طلب تم إرساله');

    const data: any = {};
    if (dto.sectionName) data.sectionName = dto.sectionName.trim();
    if (dto.notes !== undefined) data.notes = dto.notes?.trim() || null;

    if (dto.items?.length) {
      await this.prisma.staffOrderItem.deleteMany({ where: { staffOrderId: id } });
      data.items = {
        create: dto.items.map((it) => ({
          productId: it.productId,
          quantity: parseFloat(it.quantity),
          unit: it.unit?.trim() || null,
          notes: it.notes?.trim() || null,
        })),
      };
    }

    return this.prisma.staffOrder.update({
      where: { id },
      data,
      include: { items: { include: { product: true } } },
    });
  }

  async deleteStaffOrder(id: string, companyId: string, userId: string) {
    const order = await this.prisma.staffOrder.findFirst({ where: { id, companyId } });
    if (!order) throw new NotFoundException('الطلب غير موجود');
    if (order.userId !== userId) throw new ForbiddenException('لا يمكن حذف طلب موظف آخر');
    if (order.orderType === 'sale') throw new BadRequestException('لا يمكن حذف مبيعات مُرسلة');
    if (order.status !== 'pending') throw new BadRequestException('لا يمكن حذف طلب تم إرساله');
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

  /** نص واتساب لمبيعات قسم — يُرسل مباشرة من الموظف دون الكاشير */
  private buildSalesWhatsAppText(order: any, saleDate: Date, lang: 'ar' | 'en' = 'ar'): string {
    const d = saleDate.toISOString().slice(0, 10).replace(/-/g, '/');
    const section = order.sectionName || '—';
    const header = lang === 'en' ? `Sales — ${section}` : `مبيعات — ${section}`;
    const dateLine = lang === 'en' ? `Date: ${d}` : `تاريخ المبيعات: ${d}`;
    const lines: string[] = [header, dateLine, '──────────────'];
    let totalQty = 0;
    for (const it of order.items || []) {
      const name = lang === 'en'
        ? (it.product?.nameEn || it.product?.nameAr || '—')
        : (it.product?.nameAr || it.product?.nameEn || '—');
      const q = Number(it.quantity);
      totalQty += q;
      const unit = it.unit ? ` ${it.unit}` : '';
      lines.push(`• ${name}: ${q}${unit}`);
    }
    lines.push('──────────────');
    lines.push(lang === 'en' ? `Total qty: ${totalQty}` : `إجمالي الكميات: ${totalQty}`);
    if (order.notes?.trim()) {
      lines.push(lang === 'en' ? `Notes: ${order.notes.trim()}` : `ملاحظات: ${order.notes.trim()}`);
    }
    const by = order.user?.nameAr || order.user?.nameEn;
    if (by) lines.push(lang === 'en' ? `By: ${by}` : `بواسطة: ${by}`);
    return lines.join('\n').trim();
  }

  /** بناء نص واتساب من الطلبات المعلّقة */
  private buildWhatsAppText(
    sections: { sectionName: string; orders: any[] }[],
    date: string,
    lang: 'ar' | 'en' = 'ar',
  ): string {
    const header = lang === 'en' ? `Section Orders — ${date}` : `طلبات الأقسام — ${date}`;
    const lines: string[] = [header, ''];
    for (const sec of sections) {
      lines.push(`▪ ${sec.sectionName}`);
      const itemMap: Record<string, { name: string; qty: number; unit: string }> = {};
      for (const order of sec.orders) {
        for (const it of order.items) {
          const key = `${it.productId}|${it.unit || ''}`;
          const name = lang === 'en'
            ? (it.product?.nameEn || it.product?.nameAr || '—')
            : (it.product?.nameAr || it.product?.nameEn || '—');
          if (!itemMap[key]) itemMap[key] = { name, qty: 0, unit: it.unit || '' };
          itemMap[key].qty += Number(it.quantity);
        }
      }
      for (const { name, qty, unit } of Object.values(itemMap)) {
        const unitStr = unit ? ` ${unit}` : '';
        lines.push(`  - ${name}: ${qty}${unitStr}`);
      }
      lines.push('');
    }
    return lines.join('\n').trim();
  }

  /** الكاشير: يرسل الملخص — يعلّم الطلبات كـ «تم الإرسال» ويعيد نص واتساب */
  async sendDigest(companyId: string, orderIds?: string[], lang: 'ar' | 'en' = 'ar') {
    const where: any = { companyId, orderType: 'order', status: 'pending' };
    if (orderIds?.length) where.id = { in: orderIds };

    const orders = await this.prisma.staffOrder.findMany({
      where,
      include: { items: { include: { product: true } } },
    });

    if (!orders.length) throw new BadRequestException('لا توجد طلبات معلّقة');

    const sentAt = new Date();
    await this.prisma.staffOrder.updateMany({
      where: { id: { in: orders.map((o) => o.id) } },
      data: { status: 'sent', sentAt },
    });

    // تجميع بالقسم لبناء النص
    const grouped: Record<string, any[]> = {};
    for (const o of orders) {
      if (!grouped[o.sectionName]) grouped[o.sectionName] = [];
      grouped[o.sectionName].push(o);
    }

    const now = new Date();
    const dateStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
    const sections = Object.entries(grouped).map(([sectionName, sOrders]) => ({ sectionName, orders: sOrders }));
    const whatsAppText = this.buildWhatsAppText(sections, dateStr, lang);

    return { sent: orders.length, whatsAppText };
  }

  /** تقرير المبيعات — orderType = 'sale' */
  async getSalesReport(companyId: string, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const orders = await this.prisma.staffOrder.findMany({
      where: {
        companyId,
        orderType: 'sale',
        OR: [
          { saleDate: { gte: since } },
          { saleDate: null, createdAt: { gte: since } },
        ],
      },
      orderBy: [{ saleDate: 'desc' }, { createdAt: 'desc' }],
      include: {
        items: { include: { product: { include: { category: true } } } },
        user: { select: { id: true, nameAr: true, nameEn: true } },
      },
    } as any);

    let totalOrders = 0;
    let totalQty = 0;
    const byProduct: Record<string, { productId: string; nameAr: string; nameEn: string | null; qty: number; unit: string; sections: Set<string> }> = {};
    const bySection: Record<string, { sectionName: string; qty: number; ordersCount: number }> = {};
    const byUser: Record<string, { userId: string; nameAr: string; nameEn: string | null; ordersCount: number; qty: number }> = {};
    const byDay: Record<string, { date: string; ordersCount: number; qty: number }> = {};

    for (const o of orders as any[]) {
      totalOrders++;
      const day = staffOrderDayKey(o);

      // بالقسم
      if (!bySection[o.sectionName]) bySection[o.sectionName] = { sectionName: o.sectionName, qty: 0, ordersCount: 0 };
      bySection[o.sectionName].ordersCount++;

      // بالمستخدم
      const uid = o.userId;
      if (!byUser[uid]) byUser[uid] = { userId: uid, nameAr: o.user?.nameAr || '—', nameEn: o.user?.nameEn || null, ordersCount: 0, qty: 0 };
      byUser[uid].ordersCount++;

      // باليوم
      if (!byDay[day]) byDay[day] = { date: day, ordersCount: 0, qty: 0 };
      byDay[day].ordersCount++;

      for (const it of o.items) {
        const qty = Number(it.quantity);
        totalQty += qty;
        bySection[o.sectionName].qty += qty;
        byUser[uid].qty += qty;
        byDay[day].qty += qty;

        const pid = it.productId;
        if (!byProduct[pid]) {
          byProduct[pid] = {
            productId: pid,
            nameAr: it.product?.nameAr || '—',
            nameEn: it.product?.nameEn || null,
            qty: 0,
            unit: it.unit || it.product?.unit || '',
            sections: new Set(),
          };
        }
        byProduct[pid].qty += qty;
        byProduct[pid].sections.add(o.sectionName);
      }
    }

    return {
      summary: { totalOrders, totalQty, uniqueProducts: Object.keys(byProduct).length, uniqueSections: Object.keys(bySection).length },
      byProduct: Object.values(byProduct)
        .map((p) => ({ ...p, sections: Array.from(p.sections) }))
        .sort((a, b) => b.qty - a.qty),
      bySection: Object.values(bySection).sort((a, b) => b.qty - a.qty),
      byUser: Object.values(byUser).sort((a, b) => b.qty - a.qty),
      byDay: Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date)),
    };
  }
}
