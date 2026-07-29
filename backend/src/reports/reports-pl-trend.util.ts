import Decimal from 'decimal.js';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { formatReportMoneyInteger, formatReportPercentNumber } from '../common/utils/report-display-format.util';
import { resolveExpenseTreeNode } from './reports-expense-tree.util';
import {
  GROUP_LABELS,
  type CategoryNode,
  type ExpenseTreeNode,
  type GeneralProfitLossModel,
  type GeneralRowModel,
  type GroupKey,
  type ReportRowKey,
} from './reports-general-profit-loss-model.util';
import { sumInvoiceTotalAmountByMonth } from './reports-pl-invoice-detail.util';

function resolveCategoryLedgerAccountItemKey(
  categories: Map<string, CategoryNode>,
  itemKey?: string,
): string | null {
  if (!itemKey?.startsWith('category:')) return null;
  const category = categories.get(itemKey.replace('category:', ''));
  return category?.accountId ? `account:${category.accountId}` : null;
}

export async function buildGeneralProfitLossTrend(
  prisma: TenantPrismaService,
  report: GeneralProfitLossModel,
  companyId: string,
  year: number,
  groupKey: ReportRowKey,
  itemKey?: string,
) {
  const salesGroup = report.groups.find((row) => row.key === 'sales');

  if (groupKey === 'grossProfit' || groupKey === 'netProfit') {
    const row = report.summaryRows.find((entry) => entry.key === groupKey);
    return {
      year,
      groupKey,
      itemKey: itemKey ?? null,
      labelAr: GROUP_LABELS[groupKey].ar,
      labelEn: GROUP_LABELS[groupKey].en,
      total: row?.total ?? '0',
      percentOfSalesYear: row?.percentOfSalesYear ?? '0',
      points: report.months.map((month, index) => ({
        month: month.index,
        label: month.label,
        amount: row?.months[index] ?? '0',
        salesAmount: salesGroup?.months[index] ?? '0',
        percentOfSales: row?.percentOfSalesMonths[index] ?? '0',
      })),
    };
  }

  const group = report.groups.find((entry) => entry.key === groupKey);
  const selectedItem =
    itemKey && group?.items
      ? groupKey === 'expenses'
        ? resolveExpenseTreeNode(group.items as ExpenseTreeNode[], itemKey)
        : (group.items as GeneralRowModel[]).find((entry) => entry.key === itemKey)
      : null;

  const useInvoiceGross = itemKey && !itemKey.startsWith('account:');
  let invoiceMonths: Decimal[] | null = null;
  if (useInvoiceGross) {
    const catRows = await prisma.category.findMany({
      where: { companyId, isActive: true },
      select: { id: true, nameAr: true, nameEn: true, parentId: true, sortOrder: true, type: true, accountId: true },
    });
    const categories = new Map(catRows.map((category) => [category.id, { ...category } as CategoryNode]));
    if (!resolveCategoryLedgerAccountItemKey(categories, itemKey)) {
      invoiceMonths = await sumInvoiceTotalAmountByMonth(prisma, companyId, year, groupKey as GroupKey, itemKey, categories);
    }
  }

  const monthRow = (index: number) => {
    if (invoiceMonths) {
      return formatReportMoneyInteger(invoiceMonths[index]);
    }
    if (itemKey) {
      return selectedItem?.months?.[index] ?? '0';
    }
    return group?.months?.[index] ?? '0';
  };

  const pctRow = (index: number) => {
    if (invoiceMonths) {
      const salesM = parseFloat(salesGroup?.months?.[index] ?? '0');
      const amt = invoiceMonths[index];
      return salesM > 0.0001 ? formatReportPercentNumber(amt.div(salesM).mul(100)) : '0';
    }
    if (itemKey) {
      return selectedItem?.percentOfSalesMonths?.[index] ?? '0';
    }
    return group?.percentOfSalesMonths?.[index] ?? '0';
  };

  const itemYearTotal = invoiceMonths
    ? invoiceMonths.reduce((a, b) => a.plus(b), new Decimal(0))
    : new Decimal(itemKey ? selectedItem?.total ?? '0' : group?.total ?? '0');
  const salesYearTotal = parseFloat(salesGroup?.total ?? '0');
  const totalStr = invoiceMonths ? formatReportMoneyInteger(itemYearTotal) : itemKey ? (selectedItem?.total ?? '0') : (group?.total ?? '0');
  const percentOfSalesYearStr = invoiceMonths
    ? salesYearTotal > 0.0001
      ? formatReportPercentNumber(itemYearTotal.div(salesYearTotal).mul(100))
      : '0'
    : itemKey
      ? (selectedItem?.percentOfSalesYear ?? '0')
      : (group?.percentOfSalesYear ?? '0');

  return {
    year,
    groupKey,
    itemKey: itemKey ?? null,
    labelAr: (itemKey ? selectedItem?.labelAr : group?.labelAr) || GROUP_LABELS[groupKey].ar,
    labelEn: (itemKey ? selectedItem?.labelEn : group?.labelEn) || GROUP_LABELS[groupKey].en,
    total: totalStr,
    percentOfSalesYear: percentOfSalesYearStr,
    points: report.months.map((month, index) => ({
      month: month.index,
      label: month.label,
      amount: monthRow(index),
      salesAmount: salesGroup?.months?.[index] ?? '0',
      percentOfSales: pctRow(index),
    })),
  };
}
