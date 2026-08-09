import { BadRequestException, Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { toYmd } from '../common/utils/to-ymd.util';
import {
  RECURRING_HR_SERVICE_CATEGORIES,
} from '../hr/constants/employee-hr-service-categories';

type PurchaseCategoryBreakdownRow = {
  id?: string | null;
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

    const recurringHrWhere = {
      ...baseWhere,
      kind: 'hr_expense',
      employeeResidency: {
        is: { serviceCategory: { in: [...RECURRING_HR_SERVICE_CATEGORIES] } },
      },
    };
    const [byKind, recurringHrAggregate, directRecurringGroups, otherExpenseGroups, payrollItemsAggregate, payrollRunsCount] = await Promise.all([
      this.prisma.invoice.groupBy({
        by: ['kind'],
        where: baseWhere,
        _sum: { totalAmount: true },
        _count: { _all: true },
      }),
      this.prisma.invoice.aggregate({
        where: recurringHrWhere,
        _sum: { totalAmount: true },
        _count: { _all: true },
      }),
      this.prisma.invoice.groupBy({
        by: ['expenseLineId'],
        where: { ...baseWhere, kind: 'fixed_expense' },
        _sum: { totalAmount: true },
      }),
      this.prisma.invoice.groupBy({
        by: ['categoryId'],
        where: {
          ...baseWhere,
          OR: [
            { kind: 'expense' },
            { kind: 'hr_expense', employeeResidency: { is: null } },
            {
              kind: 'hr_expense',
              employeeResidency: {
                is: { serviceCategory: { notIn: [...RECURRING_HR_SERVICE_CATEGORIES] } },
              },
            },
          ],
        },
        _sum: { totalAmount: true },
      }),
      // مصدر تكلفة الرواتب هو المسير: السلفة تخفّض النقد المدفوع فقط ولا تخفّض
      // أجور الفترة. نقرأ التكلفة قبل السلف من سطور المسير المركزية.
      this.prisma.payrollRunItem.aggregate({
        where: {
          payrollRun: {
            companyId,
            status: 'completed',
            payrollMonth: { gte: start, lte: end },
          },
        },
        _sum: { grossSalary: true, allowancesAdd: true, deductions: true },
      }),
      this.prisma.payrollRun.count({
        where: {
          companyId,
          status: 'completed',
          payrollMonth: { gte: start, lte: end },
        },
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
    const salaryTotal = new Decimal(payrollItemsAggregate._sum.grossSalary?.toString() ?? 0)
      .plus(payrollItemsAggregate._sum.allowancesAdd?.toString() ?? 0)
      .minus(payrollItemsAggregate._sum.deductions?.toString() ?? 0);
    const fixedExpenseTotal = directFixedTotal.plus(recurringHrTotal).plus(salaryTotal);
    const fixedExpenseInvoiceCount =
      (totalsByKind.fixed_expense?.invoiceCount ?? 0) + recurringHrAggregate._count._all + payrollRunsCount;
    const directRecurringLineIds = directRecurringGroups
      .map((group) => group.expenseLineId)
      .filter((id): id is string => id != null);
    const otherExpenseCategoryIds = otherExpenseGroups
      .map((group) => group.categoryId)
      .filter((id): id is string => id != null);
    const [directRecurringLines, otherExpenseCategories] = await Promise.all([
      directRecurringLineIds.length
        ? this.prisma.expenseLine.findMany({
          where: { id: { in: directRecurringLineIds }, companyId },
          select: { id: true, nameAr: true, nameEn: true },
        })
        : [],
      otherExpenseCategoryIds.length
        ? this.prisma.category.findMany({
          where: { id: { in: otherExpenseCategoryIds }, companyId },
          select: { id: true, nameAr: true, nameEn: true },
        })
        : [],
    ]);
    const recurringLineById = new Map(directRecurringLines.map((line) => [line.id, line]));
    const otherExpenseCategoryById = new Map(otherExpenseCategories.map((category) => [category.id, category]));

    let recurringCostCategoryBreakdown: PurchaseCategoryBreakdownRow[] = directRecurringGroups.map((group) => {
      const amount = new Decimal(group._sum.totalAmount?.toString() ?? 0);
      const line = group.expenseLineId ? recurringLineById.get(group.expenseLineId) : null;
      return {
        id: group.expenseLineId,
        categoryId: null,
        nameAr: line?.nameAr ?? 'غير مصنف',
        nameEn: line?.nameEn ?? 'Uncategorized',
        amount: amount.toFixed(4),
      };
    });
    if (recurringHrTotal.gt(0)) {
      recurringCostCategoryBreakdown.push({
        id: 'recurring-hr-services', categoryId: null,
        nameAr: 'خدمات الموظفين الدورية', nameEn: 'Recurring employee services',
        amount: recurringHrTotal.toFixed(4),
      });
    }
    if (salaryTotal.gt(0)) {
      recurringCostCategoryBreakdown.push({
        id: 'payroll', categoryId: null,
        nameAr: 'الرواتب والأجور', nameEn: 'Payroll and wages',
        amount: salaryTotal.toFixed(4),
      });
    }
    recurringCostCategoryBreakdown = recurringCostCategoryBreakdown
      .filter((row) => new Decimal(row.amount).gt(0))
      .sort((a, b) => new Decimal(b.amount).cmp(a.amount))
      .map((row) => ({
        ...row,
        sharePct: fixedExpenseTotal.gt(0) ? new Decimal(row.amount).div(fixedExpenseTotal).mul(100).toNumber() : null,
      }));

    let otherExpenseCategoryBreakdown: PurchaseCategoryBreakdownRow[] = otherExpenseGroups.map((group) => {
      const amount = new Decimal(group._sum.totalAmount?.toString() ?? 0);
      const category = group.categoryId ? otherExpenseCategoryById.get(group.categoryId) : null;
      return {
        id: group.categoryId,
        categoryId: group.categoryId,
        nameAr: category?.nameAr ?? 'غير مصنف',
        nameEn: category?.nameEn ?? 'Uncategorized',
        amount: amount.toFixed(4),
      };
    });
    otherExpenseCategoryBreakdown = otherExpenseCategoryBreakdown
      .filter((row) => new Decimal(row.amount).gt(0))
      .sort((a, b) => new Decimal(b.amount).cmp(a.amount));
    const otherExpenseTotalDecimal = otherExpenseCategoryBreakdown.reduce(
      (sum, row) => sum.plus(new Decimal(row.amount)),
      new Decimal(0),
    );
    otherExpenseCategoryBreakdown = otherExpenseCategoryBreakdown.map((row) => ({
      ...row,
      sharePct: otherExpenseTotalDecimal.gt(0)
        ? new Decimal(row.amount).div(otherExpenseTotalDecimal).mul(100).toNumber()
        : null,
    }));

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
      recurringCostCategoryBreakdown,
      otherExpenseCategoryBreakdown,
      otherExpenseTotal: otherExpenseTotalDecimal.toFixed(4),
    };
  }
}
