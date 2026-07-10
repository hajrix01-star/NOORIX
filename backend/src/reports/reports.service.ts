import { BadRequestException, Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { ReportsPeriodAnalyticsService } from './reports-period-analytics.service';
import { ReportsTaxVatService } from './reports-tax-vat.service';
import {
  EN_MONTHS,
  GROUP_LABELS,
  type CategoryNode,
  type ExpenseTreeNode,
  type GeneralProfitLossModel,
  type GeneralRowModel,
  type GroupKey,
  type ReportRowKey,
} from './reports-general-profit-loss-model.util';
import { plDec, plPercentOfSales, plSumMonths, plZeroMonths } from './reports-pl-math.util';
import { buildPlCategoryHierarchy } from './reports-pl-category-hierarchy.util';
import { loadPlDetailFromLedger, loadPlDetailInvoices, sumInvoiceTotalAmountByMonth } from './reports-pl-invoice-detail.util';
import { resolvePlDetailTitle } from './reports-pl-item-meta.util';
import { loadAnnualLedgerAggregates } from './reports-pl-ledger-aggregates.util';
import { GENERAL_PNL_AMOUNT_BASIS } from './reports-pl-contract.util';
import { createPlGroupStates } from './reports-pl-group-states.util';
import { resolveExpenseTreeNode } from './reports-expense-tree.util';
import { formatReportMoneyInteger, formatReportPercentNumber } from '../common/utils/report-display-format.util';

function resolveCategoryLedgerAccountItemKey(
  categories: Map<string, CategoryNode>,
  itemKey?: string,
): string | null {
  if (!itemKey?.startsWith('category:')) return null;
  const category = categories.get(itemKey.replace('category:', ''));
  return category?.accountId ? `account:${category.accountId}` : null;
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly periodAnalytics: ReportsPeriodAnalyticsService,
    private readonly taxVat: ReportsTaxVatService,
  ) {}

  async getGeneralProfitLoss(companyId: string, year: number): Promise<GeneralProfitLossModel> {
    return this.buildGeneralProfitLossModel(companyId, year);
  }

  async getGeneralProfitLossDetails(
    companyId: string,
    year: number,
    month: number | undefined,
    groupKey: ReportRowKey,
    itemKey?: string,
  ) {
    if (month != null && (month < 1 || month > 12)) {
      throw new BadRequestException('الشهر يجب أن يكون بين 1 و 12');
    }

    const report = await this.buildGeneralProfitLossModel(companyId, year);
    const monthLabel = month ? EN_MONTHS[month - 1] : null;
    const salesGroup = report.groups.find((row) => row.key === 'sales');
    const purchasesGroup = report.groups.find((row) => row.key === 'purchases');
    const expensesGroup = report.groups.find((row) => row.key === 'expenses');

    if (groupKey === 'grossProfit' || groupKey === 'netProfit') {
      const grossRow = report.summaryRows.find((row) => row.key === 'grossProfit');
      const netRow = report.summaryRows.find((row) => row.key === 'netProfit');
      const contextIndex = month ? month - 1 : null;
      return {
        kind: 'derived',
        month: month ?? null,
        monthLabel,
        year,
        groupKey,
        itemKey: itemKey ?? null,
        titleAr: groupKey === 'grossProfit' ? 'تفاصيل الربح الإجمالي' : 'تفاصيل الربح الصافي',
        titleEn: groupKey === 'grossProfit' ? 'Gross profit details' : 'Net profit details',
        contextAmount: contextIndex != null
          ? (groupKey === 'grossProfit' ? grossRow?.months[contextIndex] : netRow?.months[contextIndex]) ?? '0'
          : (groupKey === 'grossProfit' ? grossRow?.total : netRow?.total) ?? '0',
        items: groupKey === 'grossProfit'
          ? [
              { key: 'sales', labelAr: 'المبيعات', labelEn: 'Sales', amount: contextIndex != null ? (salesGroup?.months[contextIndex] ?? '0') : (salesGroup?.total ?? '0') },
              { key: 'purchases', labelAr: 'المشتريات', labelEn: 'Purchases', amount: contextIndex != null ? (purchasesGroup?.months[contextIndex] ?? '0') : (purchasesGroup?.total ?? '0') },
              { key: 'grossProfit', labelAr: 'الربح الإجمالي', labelEn: 'Gross profit', amount: contextIndex != null ? (grossRow?.months[contextIndex] ?? '0') : (grossRow?.total ?? '0') },
            ]
          : [
              { key: 'sales', labelAr: 'المبيعات', labelEn: 'Sales', amount: contextIndex != null ? (salesGroup?.months[contextIndex] ?? '0') : (salesGroup?.total ?? '0') },
              { key: 'purchases', labelAr: 'المشتريات', labelEn: 'Purchases', amount: contextIndex != null ? (purchasesGroup?.months[contextIndex] ?? '0') : (purchasesGroup?.total ?? '0') },
              { key: 'expenses', labelAr: 'المصاريف', labelEn: 'Expenses', amount: contextIndex != null ? (expensesGroup?.months[contextIndex] ?? '0') : (expensesGroup?.total ?? '0') },
              { key: 'netProfit', labelAr: 'الربح الصافي', labelEn: 'Net profit', amount: contextIndex != null ? (netRow?.months[contextIndex] ?? '0') : (netRow?.total ?? '0') },
            ],
      };
    }

    const catRows = await this.prisma.category.findMany({
      where: { companyId, isActive: true },
      select: { id: true, nameAr: true, nameEn: true, parentId: true, sortOrder: true, type: true, accountId: true },
    });
    const categories = new Map(catRows.map((c) => [c.id, { ...c } as CategoryNode]));
    const title = resolvePlDetailTitle(groupKey, itemKey, categories);
    const ledgerAccountItemKey = resolveCategoryLedgerAccountItemKey(categories, itemKey);

    let detailItems: Array<{
      id: string;
      invoiceNumber: string;
      supplierInvoiceNumber: string | null;
      transactionDate: string;
      kind: string;
      kindLabelAr: string;
      kindLabelEn: string;
      categoryId: string | null;
      itemKey: string;
      itemLabelAr: string;
      itemLabelEn: string;
      supplierNameAr: string | null;
      supplierNameEn: string | null;
      expenseLineNameAr: string | null;
      expenseLineNameEn: string | null;
      summaryNumber: string | null;
      channelNames: Array<{ nameAr: string; nameEn: string | null; amount: string }>;
      totalAmount: string;
      netAmount: string;
      taxAmount: string;
      notes: string | null;
    }>;

    const useInvoiceGross = !!itemKey && !itemKey.startsWith('account:') && !ledgerAccountItemKey;
    let invoiceGrossMonths: Decimal[] | null = null;

    if (itemKey?.startsWith('account:')) {
      detailItems = await loadPlDetailFromLedger(this.prisma, companyId, year, month, groupKey as GroupKey, itemKey);
    } else if (ledgerAccountItemKey) {
      detailItems = await loadPlDetailFromLedger(this.prisma, companyId, year, month, groupKey as GroupKey, ledgerAccountItemKey);
    } else {
      const [detailResult, grossMonths] = await Promise.all([
        loadPlDetailInvoices(this.prisma, companyId, year, month, groupKey, itemKey, categories),
        useInvoiceGross
          ? sumInvoiceTotalAmountByMonth(this.prisma, companyId, year, groupKey as GroupKey, itemKey, categories)
          : Promise.resolve(null),
      ]);
      detailItems = detailResult;
      invoiceGrossMonths = grossMonths;
    }

    const allGroup = report.groups.find((row) => row.key === groupKey);
    const selectedRow =
      itemKey && allGroup?.items
        ? groupKey === 'expenses'
          ? resolveExpenseTreeNode(allGroup.items as ExpenseTreeNode[], itemKey)
          : (allGroup.items as GeneralRowModel[]).find((row) => row.key === itemKey)
        : allGroup;
    let contextAmount =
      month != null
        ? selectedRow?.months?.[month - 1] ?? '0'
        : selectedRow?.total ?? '0';
    let contextPercentOfSales =
      month != null
        ? selectedRow?.percentOfSalesMonths?.[month - 1] ?? '0'
        : selectedRow?.percentOfSalesYear ?? '0';
    let annualAmount = selectedRow?.total ?? '0';
    let annualPercentOfSales = selectedRow?.percentOfSalesYear ?? '0';

    /** إجمالي الفاتورة (شامل الضريبة) عند تفصيل بند من الفواتير — يتوافق مع جدول التفاصيل */
    if (useInvoiceGross && invoiceGrossMonths) {
      const yVal = invoiceGrossMonths.reduce((sum, value) => sum.plus(value), new Decimal(0));
      annualAmount = formatReportMoneyInteger(yVal);
      const salesYear = parseFloat(salesGroup?.total ?? '0');
      annualPercentOfSales = salesYear > 0.0001 ? formatReportPercentNumber(yVal.div(salesYear).mul(100)) : '0';
      if (month != null) {
        const mVal = invoiceGrossMonths[month - 1] ?? new Decimal(0);
        contextAmount = formatReportMoneyInteger(mVal);
        const salesM = parseFloat(salesGroup?.months?.[month - 1] ?? '0');
        contextPercentOfSales = salesM > 0.0001 ? formatReportPercentNumber(mVal.div(salesM).mul(100)) : '0';
      } else {
        contextAmount = formatReportMoneyInteger(yVal);
        contextPercentOfSales = annualPercentOfSales;
      }
    }

    const finalTitle =
      itemKey?.startsWith('account:') && selectedRow
        ? { labelAr: selectedRow.labelAr, labelEn: selectedRow.labelEn || selectedRow.labelAr }
        : title;

    return {
      kind: 'invoices',
      month: month ?? null,
      monthLabel,
      year,
      groupKey,
      itemKey: itemKey ?? null,
      titleAr: finalTitle.labelAr,
      titleEn: finalTitle.labelEn,
      contextAmount,
      contextPercentOfSales,
      annualAmount,
      annualPercentOfSales,
      invoiceCount: detailItems.length,
      items: detailItems,
    };
  }

  async getGeneralProfitLossTrend(companyId: string, year: number, groupKey: ReportRowKey, itemKey?: string) {
    const report = await this.buildGeneralProfitLossModel(companyId, year);
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
      const catRows = await this.prisma.category.findMany({
        where: { companyId, isActive: true },
        select: { id: true, nameAr: true, nameEn: true, parentId: true, sortOrder: true, type: true, accountId: true },
      });
      const categories = new Map(catRows.map((c) => [c.id, { ...c } as CategoryNode]));
      if (!resolveCategoryLedgerAccountItemKey(categories, itemKey)) {
        invoiceMonths = await sumInvoiceTotalAmountByMonth(this.prisma, companyId, year, groupKey as GroupKey, itemKey, categories);
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

  private async buildGeneralProfitLossModel(companyId: string, year: number): Promise<GeneralProfitLossModel> {
    const { entries, categories, expenseLines } = await loadAnnualLedgerAggregates(this.prisma, companyId, year);
    const groups = createPlGroupStates();

    for (const e of entries) {
      const { groupKey, monthIndex, amount, itemKey, labelAr, labelEn, sortOrder } = e;
      if (!groupKey) continue;

      const groupState = groups[groupKey];
      groupState.months[monthIndex] = groupState.months[monthIndex].plus(amount);

      const currentItem = groupState.items.get(itemKey) || {
        key: itemKey,
        labelAr,
        labelEn,
        months: plZeroMonths(),
        sortOrder,
        percentOfSalesMonths: plZeroMonths(),
        percentOfSalesYear: new Decimal(0),
      };
      currentItem.months[monthIndex] = currentItem.months[monthIndex].plus(amount);
      groupState.items.set(itemKey, currentItem);
    }

    const salesMonths = groups.sales.months;
    const purchasesMonths = groups.purchases.months;
    const expensesMonths = groups.expenses.months;
    const grossProfitMonths = salesMonths.map((amount, index) => amount.minus(purchasesMonths[index]));
    const netProfitMonths = grossProfitMonths.map((amount, index) => amount.minus(expensesMonths[index]));
    const totalSales = plSumMonths(salesMonths);

    const groupRows = (Object.keys(groups) as GroupKey[]).map((groupKey) => {
      const groupState = groups[groupKey];
      const total = plSumMonths(groupState.months);
      const percentOfSalesMonths = groupState.months.map((monthAmount, index) => plPercentOfSales(monthAmount, salesMonths[index]));
      const flatItems = Array.from(groupState.items.values())
        .map((item) => {
          const itemTotal = plSumMonths(item.months);
          const itemPercentMonths = item.months.map((monthAmount, index) => plPercentOfSales(monthAmount, salesMonths[index]));
          const itemPercentYear = plPercentOfSales(itemTotal, totalSales);
          return {
            key: item.key,
            labelAr: item.labelAr,
            labelEn: item.labelEn,
            months: item.months.map((month) => formatReportMoneyInteger(month)),
            total: formatReportMoneyInteger(itemTotal),
            percentOfSalesMonths: itemPercentMonths.map((value) => formatReportPercentNumber(value)),
            percentOfSalesYear: formatReportPercentNumber(itemPercentYear),
            sortOrder: item.sortOrder,
          };
        });

      const hasCategoryItems =
        groupKey !== 'sales' &&
        flatItems.some((i) => i.key.startsWith('category:') || i.key.startsWith('expense-line:'));
      const items = hasCategoryItems
        ? buildPlCategoryHierarchy(groupKey, flatItems, categories, expenseLines, salesMonths, totalSales)
        : flatItems
            .sort((a, b) => a.sortOrder - b.sortOrder || a.labelAr.localeCompare(b.labelAr))
            .map(({ sortOrder: _sortOrder, ...item }) => item);

      return {
        key: groupState.key,
        labelAr: groupState.labelAr,
        labelEn: groupState.labelEn,
        months: groupState.months.map((month) => formatReportMoneyInteger(month)),
        total: formatReportMoneyInteger(total),
        percentOfSalesMonths: percentOfSalesMonths.map((value) => formatReportPercentNumber(value)),
        percentOfSalesYear: formatReportPercentNumber(plPercentOfSales(total, totalSales)),
        items,
      };
    });

    return {
      amountBasis: GENERAL_PNL_AMOUNT_BASIS,
      months: EN_MONTHS.map((label, index) => ({ index: index + 1, label })),
      groups: groupRows,
      summaryRows: [
        {
          key: 'grossProfit',
          labelAr: GROUP_LABELS.grossProfit.ar,
          labelEn: GROUP_LABELS.grossProfit.en,
          months: grossProfitMonths.map((month) => formatReportMoneyInteger(month)),
          total: formatReportMoneyInteger(plSumMonths(grossProfitMonths)),
          percentOfSalesMonths: grossProfitMonths.map((month, index) =>
            formatReportPercentNumber(plPercentOfSales(month, salesMonths[index])),
          ),
          percentOfSalesYear: formatReportPercentNumber(plPercentOfSales(plSumMonths(grossProfitMonths), totalSales)),
        },
        {
          key: 'netProfit',
          labelAr: GROUP_LABELS.netProfit.ar,
          labelEn: GROUP_LABELS.netProfit.en,
          months: netProfitMonths.map((month) => formatReportMoneyInteger(month)),
          total: formatReportMoneyInteger(plSumMonths(netProfitMonths)),
          percentOfSalesMonths: netProfitMonths.map((month, index) =>
            formatReportPercentNumber(plPercentOfSales(month, salesMonths[index])),
          ),
          percentOfSalesYear: formatReportPercentNumber(plPercentOfSales(plSumMonths(netProfitMonths), totalSales)),
        },
      ],
      cards: {
        sales: formatReportMoneyInteger(totalSales),
        purchases: formatReportMoneyInteger(plSumMonths(purchasesMonths)),
        expenses: formatReportMoneyInteger(plSumMonths(expensesMonths)),
        grossProfit: formatReportMoneyInteger(plSumMonths(grossProfitMonths)),
        netProfit: formatReportMoneyInteger(plSumMonths(netProfitMonths)),
      },
    };
  }

  async getTaxVatReport(
    companyId: string,
    year: number,
    period: string,
    salesAmountIncludesVat = false,
  ) {
    return this.taxVat.getTaxVatReport(companyId, year, period, salesAmountIncludesVat);
  }

  async getPeriodAnalytics(companyId: string, startDateStr: string, endDateStr: string) {
    return this.periodAnalytics.getPeriodAnalytics(companyId, startDateStr, endDateStr);
  }
}
