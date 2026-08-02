import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import type { OrdersV3DocumentType } from './orders-v3.contracts';

function dateOnly(value: string, label: string): Date {
  const text = String(value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new BadRequestException(`${label} غير صالح`);
  const date = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) throw new BadRequestException(`${label} غير صالح`);
  return date;
}

function rangeBounds(startDate?: string, endDate?: string): { gte?: Date; lte?: Date } {
  const bounds: { gte?: Date; lte?: Date } = {};
  if (startDate) bounds.gte = dateOnly(startDate, 'تاريخ البداية');
  if (endDate) bounds.lte = dateOnly(endDate, 'تاريخ النهاية');
  if (bounds.gte && bounds.lte && bounds.gte > bounds.lte) throw new BadRequestException('نطاق التاريخ معكوس');
  return bounds;
}

@Injectable()
export class OrdersV3ReportsService {
  constructor(private readonly prisma: TenantPrismaService) {}

  async summary(companyId: string, startDate?: string, endDate?: string) {
    const documents = await this.prisma.ordersV3Document.findMany({
      where: { companyId, status: 'posted', documentDate: rangeBounds(startDate, endDate) },
      select: { documentType: true, paymentMethod: true, totalAmount: true },
    });
    const zero = new Prisma.Decimal(0);
    const sum = (rows: typeof documents) => rows.reduce((total, row) => total.plus(row.totalAmount), zero).toDecimalPlaces(6);
    const purchases = documents.filter((row) => row.documentType === 'purchase');
    const registrations = documents.filter((row) => row.documentType === 'registration');
    return {
      purchaseCount: purchases.length,
      registrationCount: registrations.length,
      purchaseTotal: sum(purchases),
      registrationTotal: sum(registrations),
      externalTotal: sum(purchases.filter((row) => row.paymentMethod === 'external')),
      internalTotal: sum(purchases.filter((row) => row.paymentMethod === 'internal')),
      transferTotal: sum(purchases.filter((row) => row.paymentMethod === 'transfer')),
      kernelVersion: 3,
    };
  }

  async itemsReport(companyId: string, documentType?: OrdersV3DocumentType, startDate?: string, endDate?: string) {
    const lines = await this.prisma.ordersV3DocumentLine.findMany({
      where: {
        companyId,
        document: { status: 'posted', documentType: documentType || undefined, documentDate: rangeBounds(startDate, endDate) },
      },
      include: { item: { include: { category: true, baseUnit: true } } },
    });
    const byItem = new Map<string, {
      itemId: string; nameAr: string; categoryName: string; baseUnit: string;
      documentCount: Set<string>; baseQuantity: Prisma.Decimal; totalAmount: Prisma.Decimal;
    }>();
    for (const line of lines) {
      const current = byItem.get(line.itemId) ?? {
        itemId: line.itemId,
        nameAr: line.item.nameAr,
        categoryName: line.item.category?.nameAr ?? '',
        baseUnit: line.item.baseUnit.nameAr,
        documentCount: new Set<string>(),
        baseQuantity: new Prisma.Decimal(0),
        totalAmount: new Prisma.Decimal(0),
      };
      current.documentCount.add(line.documentId);
      current.baseQuantity = current.baseQuantity.plus(line.baseQuantity);
      current.totalAmount = current.totalAmount.plus(line.lineTotal);
      byItem.set(line.itemId, current);
    }
    return [...byItem.values()].map((row) => ({
      itemId: row.itemId,
      nameAr: row.nameAr,
      categoryName: row.categoryName,
      baseUnit: row.baseUnit,
      documentCount: row.documentCount.size,
      baseQuantity: row.baseQuantity.toDecimalPlaces(8),
      totalAmount: row.totalAmount.toDecimalPlaces(6),
      averageUnitCost: row.baseQuantity.isZero() ? new Prisma.Decimal(0) : row.totalAmount.div(row.baseQuantity).toDecimalPlaces(8),
    })).sort((a, b) => b.totalAmount.comparedTo(a.totalAmount));
  }

  async salesReport(companyId: string, startDate?: string, endDate?: string) {
    const bounds = rangeBounds(startDate, endDate);
    const [summary, byItem, documents] = await Promise.all([
      this.summary(companyId, startDate, endDate),
      this.itemsReport(companyId, 'registration', startDate, endDate),
      this.prisma.ordersV3Document.findMany({
        where: { companyId, documentType: 'registration', documentDate: bounds },
        include: { section: true, location: true, lines: { include: { item: true, inputUnit: true, priceUnit: true }, orderBy: { lineNumber: 'asc' } } },
        orderBy: [{ documentDate: 'desc' }, { createdAt: 'desc' }],
      }),
    ]);
    const bySection = new Map<string, { sectionId: string; sectionName: string; count: number; total: Prisma.Decimal }>();
    for (const document of documents.filter((row) => row.status === 'posted')) {
      const key = document.sectionId || 'unassigned';
      const current = bySection.get(key) ?? {
        sectionId: key,
        sectionName: document.section?.nameAr ?? 'غير محدد',
        count: 0,
        total: new Prisma.Decimal(0),
      };
      current.count += 1;
      current.total = current.total.plus(document.totalAmount);
      bySection.set(key, current);
    }
    return {
      summary: { count: summary.registrationCount, totalAmount: summary.registrationTotal },
      byItem,
      bySection: [...bySection.values()].map((row) => ({ ...row, totalAmount: row.total })),
      documents,
      kernelVersion: 3,
    };
  }
}
