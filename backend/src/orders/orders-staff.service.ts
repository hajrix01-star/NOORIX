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
  notes?: string;
  items: StaffOrderItemInput[];
}

@Injectable()
export class OrdersStaffService {
  constructor(private readonly prisma: TenantPrismaService) {}

  async createStaffOrder(userId: string, dto: CreateStaffOrderDto) {
    const tenantId = TenantContext.getTenantId();
    if (!dto.items?.length) throw new BadRequestException('يجب إضافة صنف واحد على الأقل');
    if (!dto.sectionName?.trim()) throw new BadRequestException('اسم القسم مطلوب');

    const qty = dto.items.map((it) => {
      const q = parseFloat(it.quantity);
      if (!it.productId || isNaN(q) || q <= 0) throw new BadRequestException('بيانات الصنف غير صحيحة');
      return q;
    });

    return this.prisma.staffOrder.create({
      data: {
        tenantId,
        companyId: dto.companyId,
        userId,
        sectionName: dto.sectionName.trim(),
        notes: dto.notes?.trim() || null,
        status: 'pending',
        items: {
          create: dto.items.map((it, i) => ({
            productId: it.productId,
            quantity: qty[i],
            unit: it.unit?.trim() || null,
            notes: it.notes?.trim() || null,
          })),
        },
      },
      include: { items: { include: { product: true } } },
    });
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
    if (order.status !== 'pending') throw new BadRequestException('لا يمكن حذف طلب تم إرساله');
    await this.prisma.staffOrder.delete({ where: { id } });
    return { deleted: true };
  }

  /** المدير/الكاشير: يجلب الطلبات المعلّقة مجمّعة بالقسم */
  async getDigest(companyId: string) {
    const orders = await this.prisma.staffOrder.findMany({
      where: { companyId, status: 'pending' },
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
    const where: any = { companyId, status: 'pending' };
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
}
