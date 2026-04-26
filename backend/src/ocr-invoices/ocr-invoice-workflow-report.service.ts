/**
 * تقارير OCR (مثلاً مشتريات شهر)
 */
import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OcrInvoiceWorkflowReportService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * تقرير فواتير OCR في شهر (حسب تاريخ الفاتورة أو تاريخ الإنشاء) مع أصناف وفئات.
   */
  async getPurchasesMonthlyReport(tenantId: string, companyId: string, month: string) {
    const m = /^(\d{4})-(\d{2})$/.exec((month || '').trim());
    if (!m) throw new BadRequestException('month مطلوب بصيغة YYYY-MM');
    const y = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10);
    if (mo < 1 || mo > 12) throw new BadRequestException('شهر غير صالح');
    const start = new Date(Date.UTC(y, mo - 1, 1, 0, 0, 0, 0));
    const endEx = new Date(Date.UTC(y, mo, 1, 0, 0, 0, 0));

    const invoices = await this.prisma.ocrInvoice.findMany({
      where: {
        tenantId,
        companyId,
        OR: [
          { AND: [{ invoiceDate: { not: null } }, { invoiceDate: { gte: start, lt: endEx } }] },
          { AND: [{ invoiceDate: null }, { createdAt: { gte: start, lt: endEx } }] },
        ],
      },
      include: {
        supplier: { select: { id: true, nameAr: true, accountingSupplierId: true } },
        lines: {
          include: {
            item: { select: { id: true, nameAr: true, category: true } },
          },
        },
        linkedPurchaseInvoice: { select: { id: true, invoiceNumber: true } },
      },
      orderBy: [{ invoiceDate: 'desc' }, { createdAt: 'desc' }],
    });

    type CatAgg = { category: string; lineCount: number; total: Prisma.Decimal };
    const byCategory = new Map<string, CatAgg>();
    type ItemAgg = {
      itemId: string | null;
      nameAr: string;
      category: string | null;
      lineCount: number;
      quantity: Prisma.Decimal;
      total: Prisma.Decimal;
    };
    const byItem = new Map<string, ItemAgg>();

    let lineTotalAll = new Prisma.Decimal(0);
    let lineCountAll = 0;

    for (const inv of invoices) {
      for (const line of inv.lines) {
        lineCountAll += 1;
        const tp = line.totalPrice ?? new Prisma.Decimal(0);
        lineTotalAll = lineTotalAll.add(tp);
        const cat = line.item?.category?.trim() || '—';
        const prevC = byCategory.get(cat) || { category: cat, lineCount: 0, total: new Prisma.Decimal(0) };
        prevC.lineCount += 1;
        prevC.total = prevC.total.add(tp);
        byCategory.set(cat, prevC);

        const itemKey = line.itemId || `raw:${line.rawName}`;
        const nameAr = line.item?.nameAr || line.nameAr || line.rawName || '—';
        const itemCat = line.item?.category ?? null;
        const prevI = byItem.get(itemKey) || {
          itemId: line.itemId,
          nameAr,
          category: itemCat,
          lineCount: 0,
          quantity: new Prisma.Decimal(0),
          total: new Prisma.Decimal(0),
        };
        prevI.lineCount += 1;
        if (line.quantity) prevI.quantity = prevI.quantity.add(line.quantity);
        prevI.total = prevI.total.add(tp);
        byItem.set(itemKey, prevI);
      }
    }

    return {
      month: `${y}-${String(mo).padStart(2, '0')}`,
      invoiceCount: invoices.length,
      lineCount: lineCountAll,
      grandTotal: lineTotalAll.toNumber(),
      byCategory: [...byCategory.values()]
        .map((c) => ({ category: c.category, lineCount: c.lineCount, total: c.total.toNumber() }))
        .sort((a, b) => b.total - a.total),
      byItem: [...byItem.values()]
        .map((it) => ({
          itemId: it.itemId,
          nameAr: it.nameAr,
          category: it.category,
          lineCount: it.lineCount,
          quantity: it.quantity.toNumber(),
          total: it.total.toNumber(),
        }))
        .sort((a, b) => b.total - a.total),
      invoices: invoices.map((i) => ({
        id: i.id,
        status: i.status,
        invoiceNumber: i.invoiceNumber,
        invoiceDate: i.invoiceDate,
        createdAt: i.createdAt,
        totalAmount: i.totalAmount?.toNumber() ?? null,
        supplier: i.supplier,
        lineCount: i.lines.length,
        linkedPurchaseId: i.linkedPurchaseInvoiceId,
        linkedPurchase: i.linkedPurchaseInvoice,
      })),
    };
  }
}
