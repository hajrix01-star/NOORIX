import { BadRequestException, Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { toYmd } from '../common/utils/to-ymd.util';
import {
  RECURRING_HR_SERVICE_CATEGORIES,
} from '../hr/constants/employee-hr-service-categories';

type PurchaseCategoryBreakdownRow = {
  categoryId: string | null;
  nameAr: string;
  nameEn: string | null;
  amount: string;
  sharePct?: number | null;
};

type FixedExpenseDetailRow = {
  invoiceId: string;
  invoiceNumber: string;
  transactionDate: string;
  nameAr: string;
  nameEn: string | null;
  sourceAr: string | null;
  sourceEn: string | null;
  amount: string;
  sharePct: number | null;
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

    const recurringHrWhere = {
      ...baseWhere,
      kind: 'hr_expense',
      employeeResidency: {
        is: { serviceCategory: { in: [...RECURRING_HR_SERVICE_CATEGORIES] } },
      },
    };
    const fixedExpenseSelect = {
      id: true,
      invoiceNumber: true,
      kind: true,
      transactionDate: true,
      totalAmount: true,
      notes: true,
      expenseLine: { select: { nameAr: true, nameEn: true } },
      supplier: { select: { nameAr: true, nameEn: true } },
      employeeResidency: {
        select: { serviceCategory: true },
      },
    } as const;
    const [byKind, directFixedInvoices, recurringHrInvoices, recurringHrAggregate, salaryInvoices] = await Promise.all([
      this.prisma.invoice.groupBy({
        by: ['kind'],
        where: baseWhere,
        _sum: { totalAmount: true },
        _count: { _all: true },
      }),
      this.prisma.invoice.findMany({
        where: { ...baseWhere, kind: 'fixed_expense' },
        orderBy: [{ transactionDate: 'desc' }, { invoiceNumber: 'desc' }],
        take: 100,
        select: fixedExpenseSelect,
      }),
      this.prisma.invoice.findMany({
        where: recurringHrWhere,
        orderBy: [{ transactionDate: 'desc' }, { invoiceNumber: 'desc' }],
        take: 100,
        select: fixedExpenseSelect,
      }),
      this.prisma.invoice.aggregate({
        where: recurringHrWhere,
        _sum: { totalAmount: true },
        _count: { _all: true },
      }),
      this.prisma.invoice.findMany({
        where: { ...baseWhere, kind: 'salary' },
        orderBy: [{ transactionDate: 'desc' }, { invoiceNumber: 'desc' }],
        take: 100,
        select: fixedExpenseSelect,
      }),
    ]);

    const totalsByKind: Record<string, { totalAmount: string; invoiceCount: number }> = {};
    for (const row of byKind) {
      totalsByKind[row.kind] = {
        totalAmount: row._sum.totalAmount?.toString() ?? '0',
        invoiceCount: row._count._all,
      };
    }

    const directFixedTotal = new Decimal(totalsByKind.fixed_expense?.totalAmount ?? 0);
    const recurringHrTotal = new Decimal(recurringHrAggregate._sum.totalAmount?.toString() ?? 0);
    const salaryTotal = new Decimal(totalsByKind.salary?.totalAmount ?? 0);
    const fixedExpenseTotal = directFixedTotal.plus(recurringHrTotal).plus(salaryTotal);
    const fixedExpenseInvoiceCount =
      (totalsByKind.fixed_expense?.invoiceCount ?? 0) + recurringHrAggregate._count._all + (totalsByKind.salary?.invoiceCount ?? 0);
    const fixedExpenseDetails: FixedExpenseDetailRow[] = [...directFixedInvoices, ...recurringHrInvoices, ...salaryInvoices]
      .sort((a, b) => b.transactionDate.getTime() - a.transactionDate.getTime() || b.invoiceNumber.localeCompare(a.invoiceNumber))
      .slice(0, 100)
      .map((invoice) => {
      const amount = new Decimal(invoice.totalAmount?.toString() ?? 0);
      const isPayroll = invoice.kind === 'salary';
      const fallbackName = invoice.notes?.trim() || invoice.invoiceNumber;
      return {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        transactionDate: toYmd(invoice.transactionDate),
        nameAr: isPayroll ? 'الرواتب والأجور' : invoice.expenseLine?.nameAr || fallbackName,
        nameEn: isPayroll ? 'Payroll and wages' : invoice.expenseLine?.nameEn || invoice.expenseLine?.nameAr || fallbackName,
        sourceAr: isPayroll ? 'مسير الرواتب' : invoice.supplier?.nameAr || invoice.supplier?.nameEn || null,
        sourceEn: isPayroll ? 'Payroll run' : invoice.supplier?.nameEn || invoice.supplier?.nameAr || null,
        amount: amount.toFixed(4),
        sharePct: fixedExpenseTotal.gt(0) ? amount.div(fixedExpenseTotal).mul(100).toNumber() : null,
      };
    });

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
      fixedExpenseTotal: fixedExpenseTotal.toFixed(4),
      fixedExpenseInvoiceCount,
      fixedExpenseDetails,
      fixedExpenseDetailsLimited: fixedExpenseInvoiceCount > fixedExpenseDetails.length,
    };
  }
}
