import { BadRequestException, Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { toYmd } from '../common/utils/to-ymd.util';

@Injectable()
export class ReportsPeriodAnalyticsService {
  constructor(private readonly prisma: TenantPrismaService) {}

  /**
   * ملخص خفيف للفترة: إجمالي حسب نوع الفاتورة + أعلى موردين مصروف/مشتريات.
   */
  async getPeriodAnalytics(companyId: string, startDateStr: string, endDateStr: string) {
    const start = new Date(`${toYmd(startDateStr)}T00:00:00.000Z`);
    const end = new Date(`${toYmd(endDateStr)}T23:59:59.999Z`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('تواريخ غير صالحة');
    }
    if (start > end) {
      throw new BadRequestException('startDate يجب أن يسبق endDate');
    }

    const baseWhere = {
      companyId,
      status: 'active' as const,
      transactionDate: { gte: start, lte: end },
    };

    const byKind = await this.prisma.invoice.groupBy({
      by: ['kind'],
      where: baseWhere,
      _sum: { totalAmount: true },
      _count: { _all: true },
    });

    const totalsByKind: Record<string, { totalAmount: string; invoiceCount: number }> = {};
    for (const row of byKind) {
      totalsByKind[row.kind] = {
        totalAmount: row._sum.totalAmount?.toString() ?? '0',
        invoiceCount: row._count._all,
      };
    }

    const outflowKinds = ['purchase', 'expense', 'fixed_expense', 'hr_expense'] as const;
    const topGroups = await this.prisma.invoice.groupBy({
      by: ['supplierId'],
      where: {
        ...baseWhere,
        supplierId: { not: null },
        kind: { in: [...outflowKinds] },
      },
      _sum: { totalAmount: true },
      _count: { _all: true },
      orderBy: { _sum: { totalAmount: 'desc' } },
      take: 5,
    });

    const supplierIds = topGroups.map((g) => g.supplierId).filter((id): id is string => id != null);
    const suppliers = supplierIds.length
      ? await this.prisma.supplier.findMany({
          where: { id: { in: supplierIds }, companyId, isDeleted: false },
          select: { id: true, nameAr: true, nameEn: true },
        })
      : [];
    const nameById = new Map(suppliers.map((s) => [s.id, s.nameAr || s.nameEn || s.id]));

    const topSuppliers = topGroups.map((g) => ({
      supplierId: g.supplierId as string,
      nameAr: nameById.get(g.supplierId as string) ?? '—',
      totalAmount: g._sum.totalAmount?.toString() ?? '0',
      invoiceCount: g._count._all,
    }));

    const distinctSupplierRows = await this.prisma.invoice.findMany({
      where: {
        ...baseWhere,
        supplierId: { not: null },
        kind: { in: [...outflowKinds] },
      },
      select: { supplierId: true },
      distinct: ['supplierId'],
    });
    const supplierIdsInPeriod = distinctSupplierRows.map((r) => r.supplierId as string);

    let supplierCategoryBreakdown: { categoryId: string | null; nameAr: string; nameEn: string | null; count: number }[] = [];
    if (supplierIdsInPeriod.length > 0) {
      const supsForCat = await this.prisma.supplier.findMany({
        where: { id: { in: supplierIdsInPeriod }, companyId, isDeleted: false },
        select: {
          id: true,
          supplierCategoryId: true,
          supplierCategory: { select: { nameAr: true, nameEn: true } },
        },
      });
      const countByCat = new Map<string | null, number>();
      for (const s of supsForCat) {
        const cid = s.supplierCategoryId;
        countByCat.set(cid, (countByCat.get(cid) ?? 0) + 1);
      }
      const foundIds = new Set(supsForCat.map((s) => s.id));
      const orphanCount = supplierIdsInPeriod.filter((id) => !foundIds.has(id)).length;
      if (orphanCount > 0) {
        countByCat.set(null, (countByCat.get(null) ?? 0) + orphanCount);
      }
      supplierCategoryBreakdown = Array.from(countByCat.entries()).map(([categoryId, count]) => {
        if (categoryId === null) {
          return { categoryId: null, nameAr: 'غير مصنّف', nameEn: 'Uncategorized', count };
        }
        const sample = supsForCat.find((x) => x.supplierCategoryId === categoryId);
        return {
          categoryId,
          nameAr: sample?.supplierCategory?.nameAr ?? '—',
          nameEn: sample?.supplierCategory?.nameEn ?? null,
          count,
        };
      });
      supplierCategoryBreakdown.sort((a, b) => b.count - a.count);
    }

    const purchaseCategoryGroups = await this.prisma.invoice.groupBy({
      by: ['categoryId'],
      where: {
        ...baseWhere,
        kind: 'purchase',
      },
      _sum: { totalAmount: true },
    });

    const purchaseCatIds = purchaseCategoryGroups
      .map((g) => g.categoryId)
      .filter((id): id is string => id != null);
    const purchaseCategoriesMeta =
      purchaseCatIds.length > 0
        ? await this.prisma.category.findMany({
            where: { id: { in: purchaseCatIds }, companyId },
            select: { id: true, nameAr: true, nameEn: true },
          })
        : [];
    const purchaseCatNameById = new Map(purchaseCategoriesMeta.map((c) => [c.id, c]));

    let purchaseCategoryBreakdown: { categoryId: string | null; nameAr: string; nameEn: string | null; amount: string }[] =
      purchaseCategoryGroups.map((g) => {
        const amtStr = g._sum.totalAmount?.toString() ?? '0';
        if (g.categoryId == null) {
          return {
            categoryId: null,
            nameAr: 'غير مصنّف',
            nameEn: 'Uncategorized',
            amount: new Decimal(amtStr).toFixed(4),
          };
        }
        const cat = purchaseCatNameById.get(g.categoryId);
        return {
          categoryId: g.categoryId,
          nameAr: cat?.nameAr ?? '—',
          nameEn: cat?.nameEn ?? null,
          amount: new Decimal(amtStr).toFixed(4),
        };
      });
    purchaseCategoryBreakdown = purchaseCategoryBreakdown
      .filter((row) => new Decimal(row.amount).gt(0))
      .sort((a, b) => new Decimal(b.amount).cmp(a.amount));

    const purchaseCategoryTotal = purchaseCategoryBreakdown
      .reduce((s, row) => s.plus(new Decimal(row.amount)), new Decimal(0))
      .toFixed(4);

    return {
      startDate: toYmd(startDateStr),
      endDate: toYmd(endDateStr),
      totalsByKind,
      topSuppliers,
      supplierCategoryBreakdown,
      suppliersInPeriodCount: supplierIdsInPeriod.length,
      purchaseCategoryBreakdown,
      purchaseCategoryTotal,
    };
  }
}
