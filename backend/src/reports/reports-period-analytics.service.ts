import { BadRequestException, Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { toYmd } from '../common/utils/to-ymd.util';

type PurchaseCategoryBreakdownRow = {
  categoryId: string | null;
  nameAr: string;
  nameEn: string | null;
  amount: string;
  sharePct?: number | null;
};

@Injectable()
export class ReportsPeriodAnalyticsService {
  constructor(private readonly prisma: TenantPrismaService) {}

  async getPeriodAnalytics(companyId: string, startDateStr: string, endDateStr: string) {
    const start = new Date(`${toYmd(startDateStr)}T00:00:00.000Z`);
    const end = new Date(`${toYmd(endDateStr)}T23:59:59.999Z`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date range');
    }
    if (start > end) {
      throw new BadRequestException('startDate must be before endDate');
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

    const supplierIds = topGroups.map((group) => group.supplierId).filter((id): id is string => id != null);
    const suppliers = supplierIds.length
      ? await this.prisma.supplier.findMany({
          where: { id: { in: supplierIds }, companyId, isDeleted: false },
          select: { id: true, nameAr: true, nameEn: true },
        })
      : [];
    const nameById = new Map(suppliers.map((supplier) => [supplier.id, supplier.nameAr || supplier.nameEn || supplier.id]));

    const topSuppliersTotal = topGroups.reduce(
      (sum, group) => sum.plus(new Decimal(group._sum.totalAmount?.toString() ?? '0')),
      new Decimal(0),
    );
    const topSuppliers = topGroups.map((group) => {
      const amount = new Decimal(group._sum.totalAmount?.toString() ?? '0');
      return {
        supplierId: group.supplierId as string,
        nameAr: nameById.get(group.supplierId as string) ?? '-',
        totalAmount: amount.toFixed(4),
        invoiceCount: group._count._all,
        sharePct: topSuppliersTotal.gt(0) ? amount.div(topSuppliersTotal).mul(100).toNumber() : null,
      };
    });

    const distinctSupplierRows = await this.prisma.invoice.findMany({
      where: {
        ...baseWhere,
        supplierId: { not: null },
        kind: { in: [...outflowKinds] },
      },
      select: { supplierId: true },
      distinct: ['supplierId'],
    });
    const supplierIdsInPeriod = distinctSupplierRows.map((row) => row.supplierId as string);

    let supplierCategoryBreakdown: { categoryId: string | null; nameAr: string; nameEn: string | null; count: number }[] = [];
    if (supplierIdsInPeriod.length > 0) {
      const suppliersForCategory = await this.prisma.supplier.findMany({
        where: { id: { in: supplierIdsInPeriod }, companyId, isDeleted: false },
        select: {
          id: true,
          supplierCategoryId: true,
          supplierCategory: { select: { nameAr: true, nameEn: true } },
        },
      });
      const countByCategory = new Map<string | null, number>();
      for (const supplier of suppliersForCategory) {
        const categoryId = supplier.supplierCategoryId;
        countByCategory.set(categoryId, (countByCategory.get(categoryId) ?? 0) + 1);
      }
      const foundIds = new Set(suppliersForCategory.map((supplier) => supplier.id));
      const orphanCount = supplierIdsInPeriod.filter((id) => !foundIds.has(id)).length;
      if (orphanCount > 0) {
        countByCategory.set(null, (countByCategory.get(null) ?? 0) + orphanCount);
      }
      supplierCategoryBreakdown = Array.from(countByCategory.entries()).map(([categoryId, count]) => {
        if (categoryId === null) {
          return { categoryId: null, nameAr: 'غير مصنف', nameEn: 'Uncategorized', count };
        }
        const sample = suppliersForCategory.find((supplier) => supplier.supplierCategoryId === categoryId);
        return {
          categoryId,
          nameAr: sample?.supplierCategory?.nameAr ?? '-',
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

    const purchaseCategoryIds = purchaseCategoryGroups
      .map((group) => group.categoryId)
      .filter((id): id is string => id != null);
    const purchaseCategoriesMeta =
      purchaseCategoryIds.length > 0
        ? await this.prisma.category.findMany({
            where: { id: { in: purchaseCategoryIds }, companyId },
            select: { id: true, nameAr: true, nameEn: true },
          })
        : [];
    const purchaseCategoryNameById = new Map(purchaseCategoriesMeta.map((category) => [category.id, category]));

    let purchaseCategoryBreakdown: PurchaseCategoryBreakdownRow[] = purchaseCategoryGroups.map((group) => {
      const amountText = group._sum.totalAmount?.toString() ?? '0';
      if (group.categoryId == null) {
        return {
          categoryId: null,
          nameAr: 'غير مصنف',
          nameEn: 'Uncategorized',
          amount: new Decimal(amountText).toFixed(4),
        };
      }
      const category = purchaseCategoryNameById.get(group.categoryId);
      return {
        categoryId: group.categoryId,
        nameAr: category?.nameAr ?? '-',
        nameEn: category?.nameEn ?? null,
        amount: new Decimal(amountText).toFixed(4),
      };
    });

    purchaseCategoryBreakdown = purchaseCategoryBreakdown
      .filter((row) => new Decimal(row.amount).gt(0))
      .sort((a, b) => new Decimal(b.amount).cmp(a.amount));

    const purchaseCategoryTotalDecimal = purchaseCategoryBreakdown.reduce(
      (sum, row) => sum.plus(new Decimal(row.amount)),
      new Decimal(0),
    );
    const purchaseCategoryTotal = purchaseCategoryTotalDecimal.toFixed(4);
    purchaseCategoryBreakdown = purchaseCategoryBreakdown.map((row) => {
      const amount = new Decimal(row.amount);
      return {
        ...row,
        sharePct: purchaseCategoryTotalDecimal.gt(0) ? amount.div(purchaseCategoryTotalDecimal).mul(100).toNumber() : null,
      };
    });

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
