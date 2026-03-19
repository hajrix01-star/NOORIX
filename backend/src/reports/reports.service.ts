import { BadRequestException, Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

type GroupKey = 'sales' | 'purchases' | 'expenses';
type ReportRowKey = GroupKey | 'grossProfit' | 'netProfit';

const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const INCLUDED_KINDS = ['sale', 'purchase', 'expense', 'fixed_expense', 'hr_expense', 'salary'] as const;

const KIND_TO_GROUP: Record<string, GroupKey | null> = {
  sale: 'sales',
  purchase: 'purchases',
  expense: 'expenses',
  fixed_expense: 'expenses',
  hr_expense: 'expenses',
  salary: 'expenses',
  advance: null,
};

const KIND_LABELS: Record<string, { ar: string; en: string }> = {
  sale: { ar: 'المبيعات', en: 'Sales' },
  purchase: { ar: 'المشتريات', en: 'Purchases' },
  expense: { ar: 'مصروفات متغيرة', en: 'Variable expenses' },
  fixed_expense: { ar: 'مصروفات ثابتة', en: 'Fixed expenses' },
  hr_expense: { ar: 'مصروفات الموارد البشرية', en: 'HR expenses' },
  salary: { ar: 'الرواتب', en: 'Salaries' },
  advance: { ar: 'سلفية', en: 'Advance' },
  transfer: { ar: 'تحويل', en: 'Transfer' },
};

const GROUP_LABELS: Record<ReportRowKey, { ar: string; en: string }> = {
  sales: { ar: 'المبيعات', en: 'Sales' },
  purchases: { ar: 'المشتريات', en: 'Purchases' },
  expenses: { ar: 'المصاريف', en: 'Expenses' },
  grossProfit: { ar: 'الربح الإجمالي', en: 'Gross profit' },
  netProfit: { ar: 'الربح الصافي', en: 'Net profit' },
};

type ReportInvoice = {
  id: string;
  invoiceNumber: string;
  supplierInvoiceNumber: string | null;
  kind: string;
  totalAmount: Decimal.Value;
  netAmount: Decimal.Value;
  taxAmount: Decimal.Value;
  transactionDate: Date;
  notes: string | null;
  categoryId: string | null;
  supplier: { nameAr: string; nameEn: string | null } | null;
  expenseLine: { id: string; nameAr: string; nameEn: string | null; categoryId: string } | null;
  dailySalesSummary: {
    summaryNumber: string;
    channels: Array<{
      amount: Decimal.Value;
      vault: { id: string; nameAr: string; nameEn: string | null };
    }>;
  } | null;
};

type CategoryNode = {
  id: string;
  nameAr: string;
  nameEn: string | null;
  parentId: string | null;
  sortOrder: number;
  type?: string;
};

type ExpenseLineNode = {
  id: string;
  nameAr: string;
  nameEn: string | null;
  categoryId: string;
};

type ItemMeta = {
  key: string;
  labelAr: string;
  labelEn: string;
  sortOrder: number;
};

type AggregatedRow = {
  key: string;
  labelAr: string;
  labelEn: string;
  months: Decimal[];
  sortOrder: number;
  percentOfSalesMonths: Decimal[];
  percentOfSalesYear: Decimal;
};

type AggregatedGroup = {
  key: GroupKey;
  labelAr: string;
  labelEn: string;
  months: Decimal[];
  items: Map<string, AggregatedRow>;
};

type GeneralRowModel = {
  key: string;
  labelAr: string;
  labelEn: string;
  months: string[];
  total: string;
  percentOfSalesMonths: string[];
  percentOfSalesYear: string;
};

type ExpenseTreeNode = GeneralRowModel & { children?: ExpenseTreeNode[] };

type GeneralProfitLossModel = {
  months: Array<{ index: number; label: string }>;
  groups: Array<GeneralRowModel & {
    items: GeneralRowModel[] | ExpenseTreeNode[];
  }>;
  summaryRows: Array<GeneralRowModel>;
  cards: {
    sales: string;
    purchases: string;
    expenses: string;
    grossProfit: string;
    netProfit: string;
  };
};

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: TenantPrismaService) {}

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

    const { categories } = await this.loadAnnualInvoices(companyId, year);
    const title = this.resolveTitle(groupKey, itemKey, categories);

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

    if (itemKey?.startsWith('account:')) {
      detailItems = await this.loadDetailFromLedger(companyId, year, month, groupKey, itemKey);
    } else {
      const { invoices } = await this.loadAnnualInvoices(companyId, year);
      const categoryIdsForFilter =
        itemKey?.startsWith('category:') && groupKey === 'expenses'
          ? this.getCategoryAndDescendantIds(itemKey.replace('category:', ''), categories)
          : null;
      const filteredInvoices = invoices
        .filter((invoice) => this.resolveGroupKey(invoice.kind) === groupKey)
        .filter((invoice) => month == null || this.getMonthIndex(invoice.transactionDate) === month - 1)
        .filter((invoice) => {
          if (!itemKey) return true;
          const metaKey = this.resolveItemMeta(invoice, groupKey, categories).key;
          if (metaKey === itemKey) return true;
          if (categoryIdsForFilter) {
            const catId = invoice.categoryId || invoice.expenseLine?.categoryId;
            return catId != null && categoryIdsForFilter.has(catId);
          }
          return false;
        })
        .sort((a, b) => b.transactionDate.getTime() - a.transactionDate.getTime());

      detailItems = filteredInvoices.map((invoice) => {
        const itemMeta = this.resolveItemMeta(invoice, groupKey, categories);
        return {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          supplierInvoiceNumber: invoice.supplierInvoiceNumber,
          transactionDate: invoice.transactionDate.toISOString(),
          kind: invoice.kind,
          kindLabelAr: KIND_LABELS[invoice.kind]?.ar || invoice.kind,
          kindLabelEn: KIND_LABELS[invoice.kind]?.en || invoice.kind,
          categoryId: invoice.categoryId,
          itemKey: itemMeta.key,
          itemLabelAr: itemMeta.labelAr,
          itemLabelEn: itemMeta.labelEn,
          supplierNameAr: invoice.supplier?.nameAr || null,
          supplierNameEn: invoice.supplier?.nameEn || null,
          expenseLineNameAr: invoice.expenseLine?.nameAr || null,
          expenseLineNameEn: invoice.expenseLine?.nameEn || null,
          summaryNumber: invoice.dailySalesSummary?.summaryNumber || null,
          channelNames: (invoice.dailySalesSummary?.channels || []).map((channel) => ({
            nameAr: channel.vault.nameAr,
            nameEn: channel.vault.nameEn,
            amount: this.dec(channel.amount).toFixed(2),
          })),
          totalAmount: this.dec(invoice.totalAmount).toFixed(2),
          netAmount: this.dec(invoice.netAmount).toFixed(2),
          taxAmount: this.dec(invoice.taxAmount).toFixed(2),
          notes: invoice.notes || null,
        };
      });
    }

    const allGroup = report.groups.find((row) => row.key === groupKey);
    const selectedRow =
      itemKey && allGroup?.items
        ? groupKey === 'expenses'
          ? this.findInExpenseTree(allGroup.items as ExpenseTreeNode[], itemKey)
          : (allGroup.items as GeneralRowModel[]).find((row) => row.key === itemKey)
        : allGroup;
    const contextAmount = month != null
      ? selectedRow?.months[month - 1] ?? '0'
      : selectedRow?.total ?? '0';
    const contextPercentOfSales = month != null
      ? selectedRow?.percentOfSalesMonths[month - 1] ?? '0'
      : selectedRow?.percentOfSalesYear ?? '0';

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
      annualAmount: selectedRow?.total ?? '0',
      annualPercentOfSales: selectedRow?.percentOfSalesYear ?? '0',
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
          ? this.findInExpenseTree(group.items as ExpenseTreeNode[], itemKey)
          : (group.items as GeneralRowModel[]).find((entry) => entry.key === itemKey)
        : null;

    return {
      year,
      groupKey,
      itemKey: itemKey ?? null,
      labelAr: selectedItem?.labelAr || group?.labelAr || GROUP_LABELS[groupKey].ar,
      labelEn: selectedItem?.labelEn || group?.labelEn || GROUP_LABELS[groupKey].en,
      total: selectedItem?.total || group?.total || '0',
      percentOfSalesYear: selectedItem?.percentOfSalesYear || group?.percentOfSalesYear || '0',
      points: report.months.map((month, index) => ({
        month: month.index,
        label: month.label,
        amount: selectedItem?.months[index] || group?.months[index] || '0',
        salesAmount: salesGroup?.months[index] ?? '0',
        percentOfSales: selectedItem?.percentOfSalesMonths[index] || group?.percentOfSalesMonths[index] || '0',
      })),
    };
  }

  private async buildGeneralProfitLossModel(companyId: string, year: number): Promise<GeneralProfitLossModel> {
    const { entries, categories, expenseLines } = await this.loadAnnualLedgerAggregates(companyId, year);
    const groups = this.createGroupStates();

    for (const e of entries) {
      const { groupKey, monthIndex, amount, itemKey, labelAr, labelEn, sortOrder } = e;
      if (!groupKey) continue;

      const groupState = groups[groupKey];
      groupState.months[monthIndex] = groupState.months[monthIndex].plus(amount);

      const currentItem = groupState.items.get(itemKey) || {
        key: itemKey,
        labelAr,
        labelEn,
        months: this.zeroMonths(),
        sortOrder,
        percentOfSalesMonths: this.zeroMonths(),
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
    const totalSales = this.sumMonths(salesMonths);

    const groupRows = (Object.keys(groups) as GroupKey[]).map((groupKey) => {
      const groupState = groups[groupKey];
      const total = this.sumMonths(groupState.months);
      const percentOfSalesMonths = groupState.months.map((monthAmount, index) => this.percentOfSales(monthAmount, salesMonths[index]));
      const flatItems = Array.from(groupState.items.values())
        .map((item) => {
          const itemTotal = this.sumMonths(item.months);
          const itemPercentMonths = item.months.map((monthAmount, index) => this.percentOfSales(monthAmount, salesMonths[index]));
          const itemPercentYear = this.percentOfSales(itemTotal, totalSales);
          return {
            key: item.key,
            labelAr: item.labelAr,
            labelEn: item.labelEn,
            months: item.months.map((month) => month.toFixed(2)),
            total: itemTotal.toFixed(2),
            percentOfSalesMonths: itemPercentMonths.map((value) => value.toFixed(2)),
            percentOfSalesYear: itemPercentYear.toFixed(2),
            sortOrder: item.sortOrder,
          };
        });

      const items =
        groupKey === 'expenses' && flatItems.some((i) => i.key.startsWith('category:') || i.key.startsWith('expense-line:'))
          ? this.buildExpenseHierarchy(flatItems, categories, expenseLines, salesMonths, totalSales)
          : flatItems
              .sort((a, b) => a.sortOrder - b.sortOrder || a.labelAr.localeCompare(b.labelAr))
              .map(({ sortOrder: _sortOrder, ...item }) => item);

      return {
        key: groupState.key,
        labelAr: groupState.labelAr,
        labelEn: groupState.labelEn,
        months: groupState.months.map((month) => month.toFixed(2)),
        total: total.toFixed(2),
        percentOfSalesMonths: percentOfSalesMonths.map((value) => value.toFixed(2)),
        percentOfSalesYear: this.percentOfSales(total, totalSales).toFixed(2),
        items,
      };
    });

    return {
      months: EN_MONTHS.map((label, index) => ({ index: index + 1, label })),
      groups: groupRows,
      summaryRows: [
        {
          key: 'grossProfit',
          labelAr: GROUP_LABELS.grossProfit.ar,
          labelEn: GROUP_LABELS.grossProfit.en,
          months: grossProfitMonths.map((month) => month.toFixed(2)),
          total: this.sumMonths(grossProfitMonths).toFixed(2),
          percentOfSalesMonths: grossProfitMonths.map((month, index) => this.percentOfSales(month, salesMonths[index]).toFixed(2)),
          percentOfSalesYear: this.percentOfSales(this.sumMonths(grossProfitMonths), totalSales).toFixed(2),
        },
        {
          key: 'netProfit',
          labelAr: GROUP_LABELS.netProfit.ar,
          labelEn: GROUP_LABELS.netProfit.en,
          months: netProfitMonths.map((month) => month.toFixed(2)),
          total: this.sumMonths(netProfitMonths).toFixed(2),
          percentOfSalesMonths: netProfitMonths.map((month, index) => this.percentOfSales(month, salesMonths[index]).toFixed(2)),
          percentOfSalesYear: this.percentOfSales(this.sumMonths(netProfitMonths), totalSales).toFixed(2),
        },
      ],
      cards: {
        sales: totalSales.toFixed(2),
        purchases: this.sumMonths(purchasesMonths).toFixed(2),
        expenses: this.sumMonths(expensesMonths).toFixed(2),
        grossProfit: this.sumMonths(grossProfitMonths).toFixed(2),
        netProfit: this.sumMonths(netProfitMonths).toFixed(2),
      },
    };
  }

  /**
   * تجميع P&L من Ledger (مصدر الحقيقة المحاسبي) + الفواتير (للتفصيل بالفئات).
   * نهج هجين: الأرقام من Ledger، التفصيل بالفئات من الفواتير عند توفرها.
   */
  private async loadAnnualLedgerAggregates(companyId: string, year: number) {
    const startDate = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

    const [ledgerEntries, categories, expenseLines] = await Promise.all([
      this.prisma.ledgerEntry.findMany({
        where: {
          companyId,
          status: 'active',
          transactionDate: { gte: startDate, lte: endDate },
        },
        select: {
          amount: true,
          transactionDate: true,
          debitAccountId: true,
          creditAccountId: true,
          referenceType: true,
          referenceId: true,
          debitAccount: { select: { id: true, code: true, type: true, nameAr: true, nameEn: true } },
          creditAccount: { select: { id: true, code: true, type: true, nameAr: true, nameEn: true } },
        },
      }),
      this.prisma.category.findMany({
        where: { companyId, isActive: true },
        select: { id: true, nameAr: true, nameEn: true, parentId: true, sortOrder: true, type: true },
      }),
      this.prisma.expenseLine.findMany({
        where: { companyId, isActive: true },
        select: { id: true, nameAr: true, nameEn: true, categoryId: true },
      }),
    ]);

    const invoiceRefIds = ledgerEntries
      .filter((e) => ['invoice', 'salary', 'advance'].includes(e.referenceType))
      .map((e) => e.referenceId);
    const saleSummaryIds = ledgerEntries
      .filter((e) => e.referenceType === 'sale')
      .map((e) => e.referenceId);
    const invoiceIds = [...new Set(invoiceRefIds)];
    const summaryIds = [...new Set(saleSummaryIds)];

    const orConditions = [
      ...(invoiceIds.length ? [{ id: { in: invoiceIds } }] : []),
      ...(summaryIds.length ? [{ dailySalesSummaryId: { in: summaryIds } }] : []),
    ];
    const invoices = orConditions.length
      ? await this.prisma.invoice.findMany({
          where: { companyId, OR: orConditions },
          select: {
            id: true,
            kind: true,
            categoryId: true,
            dailySalesSummaryId: true,
            expenseLine: { select: { id: true, nameAr: true, nameEn: true, categoryId: true } },
            dailySalesSummary: {
              select: {
                channels: {
                  select: {
                    vault: { select: { id: true, nameAr: true, nameEn: true } },
                  },
                },
              },
            },
          },
        })
      : [];

    const invMap = new Map(invoices.map((i) => [i.id, i]));
    const invBySummaryId = new Map(
      invoices.filter((i) => i.dailySalesSummaryId).map((i) => [i.dailySalesSummaryId!, i]),
    );

    const catMap = new Map(categories.map((c) => [c.id, { ...c } as CategoryNode]));

    const entries: Array<{
      groupKey: GroupKey | null;
      monthIndex: number;
      amount: Decimal;
      itemKey: string;
      labelAr: string;
      labelEn: string;
      sortOrder: number;
    }> = [];

    for (const le of ledgerEntries) {
      const amount = this.dec(le.amount);
      const monthIndex = new Date(le.transactionDate).getUTCMonth();
      const da = le.debitAccount;
      const ca = le.creditAccount;

      if (ca.type === 'revenue') {
        const inv = le.referenceType === 'sale' ? invBySummaryId.get(le.referenceId) : null;
        if (inv) {
          const meta = this.resolveItemMeta(inv as unknown as ReportInvoice, 'sales', catMap);
          entries.push({
            groupKey: 'sales',
            monthIndex,
            amount,
            itemKey: meta.key,
            labelAr: meta.labelAr,
            labelEn: meta.labelEn,
            sortOrder: meta.sortOrder,
          });
        } else {
          entries.push({
            groupKey: 'sales',
            monthIndex,
            amount,
            itemKey: `account:${ca.id}`,
            labelAr: ca.nameAr,
            labelEn: ca.nameEn || ca.nameAr,
            sortOrder: ca.code === 'REV-001' ? 0 : 999,
          });
        }
      } else if (da.type === 'expense') {
        const isPurchase = da.code.startsWith('PUR');
        const groupKey: GroupKey = isPurchase ? 'purchases' : 'expenses';
        const inv = ['invoice', 'salary', 'advance'].includes(le.referenceType!)
          ? invMap.get(le.referenceId)
          : null;
        if (inv) {
          const meta = this.resolveItemMeta(inv as unknown as ReportInvoice, groupKey, catMap);
          entries.push({
            groupKey,
            monthIndex,
            amount,
            itemKey: meta.key,
            labelAr: meta.labelAr,
            labelEn: meta.labelEn,
            sortOrder: meta.sortOrder,
          });
        } else {
          const sortOrder = isPurchase
            ? da.code === 'PUR-001'
              ? 0
              : 999
            : parseInt(da.code.replace(/\D/g, '') || '999', 10);
          entries.push({
            groupKey,
            monthIndex,
            amount,
            itemKey: `account:${da.id}`,
            labelAr: da.nameAr,
            labelEn: da.nameEn || da.nameAr,
            sortOrder,
          });
        }
      }
    }

    return {
      entries,
      categories: catMap,
      expenseLines: expenseLines as ExpenseLineNode[],
    };
  }

  /**
   * تفاصيل التقرير من Ledger — عند النقر على حساب (account:xxx)
   */
  private async loadDetailFromLedger(
    companyId: string,
    year: number,
    month: number | undefined,
    groupKey: GroupKey,
    itemKey: string,
  ) {
    const accountId = itemKey.replace('account:', '');
    const startDate = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
    const monthFilter =
      month != null
        ? {
            gte: new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0)),
            lte: new Date(Date.UTC(year, month - 1, 31, 23, 59, 59, 999)),
          }
        : undefined;

    const isSales = groupKey === 'sales';
    const where = {
      companyId,
      status: 'active',
      transactionDate: monthFilter ? monthFilter : { gte: startDate, lte: endDate },
      ...(isSales ? { creditAccountId: accountId } : { debitAccountId: accountId }),
    };

    const entries = await this.prisma.ledgerEntry.findMany({
      where,
      orderBy: { transactionDate: 'desc' },
      select: {
        id: true,
        amount: true,
        transactionDate: true,
        referenceType: true,
        referenceId: true,
      },
    });

    const invoiceRefIds = entries
      .filter((e) => ['invoice', 'salary', 'advance'].includes(e.referenceType))
      .map((e) => e.referenceId);
    const saleSummaryIds = entries
      .filter((e) => e.referenceType === 'sale')
      .map((e) => e.referenceId);
    const invoiceIds = [...new Set(invoiceRefIds)];
    const summaryIds = [...new Set(saleSummaryIds)];

    const orConditions = [
      ...(invoiceIds.length ? [{ id: { in: invoiceIds } }] : []),
      ...(summaryIds.length ? [{ dailySalesSummaryId: { in: summaryIds } }] : []),
    ];
    const invoices = await this.prisma.invoice.findMany({
      where: {
        companyId,
        OR: orConditions.length ? orConditions : [{ id: { in: [] } }],
      },
      select: {
        id: true,
        dailySalesSummaryId: true,
        invoiceNumber: true,
        supplierInvoiceNumber: true,
        kind: true,
        totalAmount: true,
        netAmount: true,
        taxAmount: true,
        notes: true,
        supplier: { select: { nameAr: true, nameEn: true } },
        expenseLine: { select: { nameAr: true, nameEn: true } },
        dailySalesSummary: {
          select: {
            summaryNumber: true,
            channels: { select: { amount: true, vault: { select: { nameAr: true, nameEn: true } } } },
          },
        },
      },
    });
    const invMap = new Map(invoices.map((i) => [i.id, i]));
    const invBySummaryId = new Map(
      invoices.filter((i) => i.dailySalesSummaryId).map((i) => [i.dailySalesSummaryId!, i]),
    );

    const result: Array<{
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
    }> = [];

    for (const e of entries) {
      const inv = invMap.get(e.referenceId) ?? invBySummaryId.get(e.referenceId);
      const amt = this.dec(e.amount);
      const kind = inv?.kind || e.referenceType || '—';
      result.push({
        id: e.id,
        invoiceNumber: inv?.invoiceNumber || e.referenceId?.slice(0, 12) || '—',
        supplierInvoiceNumber: inv?.supplierInvoiceNumber || null,
        transactionDate: e.transactionDate.toISOString(),
        kind,
        kindLabelAr: KIND_LABELS[kind]?.ar || kind,
        kindLabelEn: KIND_LABELS[kind]?.en || kind,
        categoryId: null,
        itemKey,
        itemLabelAr: '',
        itemLabelEn: '',
        supplierNameAr: inv?.supplier?.nameAr || null,
        supplierNameEn: inv?.supplier?.nameEn || null,
        expenseLineNameAr: inv?.expenseLine?.nameAr || null,
        expenseLineNameEn: inv?.expenseLine?.nameEn || null,
        summaryNumber: inv?.dailySalesSummary?.summaryNumber || null,
        channelNames: (inv?.dailySalesSummary?.channels || []).map((ch) => ({
          nameAr: ch.vault.nameAr,
          nameEn: ch.vault.nameEn,
          amount: this.dec(ch.amount).toFixed(2),
        })),
        totalAmount: amt.toFixed(2),
        netAmount: amt.toFixed(2),
        taxAmount: '0',
        notes: inv?.notes || null,
      });
    }

    return result;
  }

  private async loadAnnualInvoices(companyId: string, year: number) {
    const startDate = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

    const [invoices, categories, expenseLines] = await Promise.all([
      this.prisma.invoice.findMany({
        where: {
          companyId,
          status: 'active',
          kind: { in: [...INCLUDED_KINDS] },
          transactionDate: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: [{ transactionDate: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          invoiceNumber: true,
          supplierInvoiceNumber: true,
          kind: true,
          totalAmount: true,
          netAmount: true,
          taxAmount: true,
          transactionDate: true,
          notes: true,
          categoryId: true,
          supplier: { select: { nameAr: true, nameEn: true } },
          expenseLine: { select: { id: true, nameAr: true, nameEn: true, categoryId: true } },
          dailySalesSummary: {
            select: {
              summaryNumber: true,
              channels: {
                select: {
                  amount: true,
                  vault: { select: { id: true, nameAr: true, nameEn: true } },
                },
              },
            },
          },
        },
      }),
      this.prisma.category.findMany({
        where: { companyId, isActive: true },
        select: { id: true, nameAr: true, nameEn: true, parentId: true, sortOrder: true, type: true },
      }),
      this.prisma.expenseLine.findMany({
        where: { companyId, isActive: true },
        select: { id: true, nameAr: true, nameEn: true, categoryId: true },
      }),
    ]);

    return {
      invoices: invoices as ReportInvoice[],
      categories: new Map(categories.map((c) => [c.id, { ...c } as CategoryNode])),
      expenseLines: expenseLines as ExpenseLineNode[],
    };
  }

  private createGroupStates(): Record<GroupKey, AggregatedGroup> {
    return {
      sales: {
        key: 'sales',
        labelAr: GROUP_LABELS.sales.ar,
        labelEn: GROUP_LABELS.sales.en,
        months: this.zeroMonths(),
        items: new Map(),
      },
      purchases: {
        key: 'purchases',
        labelAr: GROUP_LABELS.purchases.ar,
        labelEn: GROUP_LABELS.purchases.en,
        months: this.zeroMonths(),
        items: new Map(),
      },
      expenses: {
        key: 'expenses',
        labelAr: GROUP_LABELS.expenses.ar,
        labelEn: GROUP_LABELS.expenses.en,
        months: this.zeroMonths(),
        items: new Map(),
      },
    };
  }

  private resolveGroupKey(kind: string): GroupKey | null {
    return KIND_TO_GROUP[kind] ?? null;
  }

  private getCategoryAndDescendantIds(categoryId: string, categories: Map<string, CategoryNode>): Set<string> {
    const set = new Set<string>([categoryId]);
    for (const cat of categories.values()) {
      if (cat.parentId === categoryId) {
        set.add(cat.id);
        for (const id of this.getCategoryAndDescendantIds(cat.id, categories)) set.add(id);
      }
    }
    return set;
  }

  private findInExpenseTree(items: ExpenseTreeNode[], key: string): ExpenseTreeNode | null {
    for (const item of items) {
      if (item.key === key) return item;
      if (item.children) {
        const found = this.findInExpenseTree(item.children, key);
        if (found) return found;
      }
    }
    return null;
  }

  private buildExpenseHierarchy(
    flatItems: Array<GeneralRowModel & { sortOrder?: number }>,
    categories: Map<string, CategoryNode>,
    expenseLines: ExpenseLineNode[],
    salesMonths: Decimal[],
    totalSales: Decimal,
  ): ExpenseTreeNode[] {
    const itemMap = new Map(flatItems.map((item) => [item.key, item]));
    const expenseCats = Array.from(categories.values()).filter((c) => c.type === 'expense');
    const roots = expenseCats.filter((c) => !c.parentId).sort((a, b) => a.sortOrder - b.sortOrder);
    const childrenByParent = new Map<string, CategoryNode[]>();
    for (const c of expenseCats) {
      if (c.parentId) {
        const list = childrenByParent.get(c.parentId) ?? [];
        list.push(c);
        childrenByParent.set(c.parentId, list);
      }
    }
    for (const list of childrenByParent.values()) {
      list.sort((a, b) => a.sortOrder - b.sortOrder);
    }
    const linesByCategory = new Map<string, ExpenseLineNode[]>();
    for (const el of expenseLines) {
      const list = linesByCategory.get(el.categoryId) ?? [];
      list.push(el);
      linesByCategory.set(el.categoryId, list);
    }

    const zeroArr = () => Array.from({ length: 12 }, () => '0');
    const toNode = (key: string, labelAr: string, labelEn: string, months: string[], total: string, percentOfSalesMonths: string[], percentOfSalesYear: string): ExpenseTreeNode => ({
      key,
      labelAr,
      labelEn,
      months,
      total,
      percentOfSalesMonths,
      percentOfSalesYear,
    });

    const buildCategoryNode = (cat: CategoryNode): ExpenseTreeNode | null => {
      const key = `category:${cat.id}`;
      const direct = itemMap.get(key);
      const childCats = childrenByParent.get(cat.id) ?? [];
      const lines = linesByCategory.get(cat.id) ?? [];
      const childNodes: ExpenseTreeNode[] = [];
      let monthsSum = direct?.months.map((v, i) => parseFloat(v || '0')) ?? Array(12).fill(0);
      let totalSum = parseFloat(direct?.total || '0');

      for (const child of childCats) {
        const node = buildCategoryNode(child);
        if (node) {
          childNodes.push(node);
          for (let i = 0; i < 12; i++) monthsSum[i] += parseFloat(node.months[i] || '0');
          totalSum += parseFloat(node.total || '0');
        }
      }
      for (const el of lines) {
        const elKey = `expense-line:${el.id}`;
        const elItem = itemMap.get(elKey);
        if (elItem) {
          childNodes.push(toNode(elKey, el.nameAr, el.nameEn || el.nameAr, elItem.months, elItem.total, elItem.percentOfSalesMonths, elItem.percentOfSalesYear));
          for (let i = 0; i < 12; i++) monthsSum[i] += parseFloat(elItem.months[i] || '0');
          totalSum += parseFloat(elItem.total || '0');
        }
      }

      const hasData = totalSum > 0.0001 || childNodes.length > 0;
      if (!hasData && childNodes.length === 0) return null;

      const months = monthsSum.map((v) => v.toFixed(2));
      const total = totalSum.toFixed(2);
      const pctMonths = monthsSum.map((v, i) => (parseFloat(salesMonths[i]?.toString() || '0') ? ((v / parseFloat(salesMonths[i].toString())) * 100).toFixed(2) : '0'));
      const pctYear = totalSales.eq(0) ? '0' : new Decimal(total).div(totalSales).mul(100).toFixed(2);

      const node: ExpenseTreeNode = toNode(key, cat.nameAr, cat.nameEn || cat.nameAr, months, total, pctMonths, pctYear);
      if (childNodes.length > 0) node.children = childNodes;
      return node;
    };

    const result: ExpenseTreeNode[] = [];
    for (const root of roots) {
      const node = buildCategoryNode(root);
      if (node) result.push(node);
    }

    const kindItems = flatItems.filter((i) => i.key.startsWith('kind:'));
    for (const k of kindItems) {
      result.push(toNode(k.key, k.labelAr, k.labelEn, k.months, k.total, k.percentOfSalesMonths, k.percentOfSalesYear));
    }
    return result;
  }

  private resolveItemMeta(invoice: ReportInvoice, groupKey: GroupKey, categories: Map<string, CategoryNode>): ItemMeta {
    if (groupKey === 'sales') {
      const channel = invoice.dailySalesSummary?.channels?.[0]?.vault;
      if (channel) {
        return {
          key: `sales-channel:${channel.id}`,
          labelAr: channel.nameAr,
          labelEn: channel.nameEn || channel.nameAr,
          sortOrder: 0,
        };
      }
      return {
        key: 'kind:sale',
        labelAr: 'المبيعات',
        labelEn: 'Sales',
        sortOrder: 0,
      };
    }

    if (invoice.expenseLine) {
      const category = categories.get(invoice.expenseLine.categoryId);
      const parent = category?.parentId ? categories.get(category.parentId) : null;
      return {
        key: `expense-line:${invoice.expenseLine.id}`,
        labelAr: parent
          ? `${parent.nameAr} / ${invoice.expenseLine.nameAr}`
          : invoice.expenseLine.nameAr,
        labelEn: parent
          ? `${parent.nameEn || parent.nameAr} / ${invoice.expenseLine.nameEn || invoice.expenseLine.nameAr}`
          : (invoice.expenseLine.nameEn || invoice.expenseLine.nameAr),
        sortOrder: (parent?.sortOrder ?? category?.sortOrder ?? 0) * 1000 + 10,
      };
    }

    const categoryId = invoice.categoryId || null;
    const category = categoryId ? categories.get(categoryId) : null;
    const parent = category?.parentId ? categories.get(category.parentId) : null;

    if (category) {
      return {
        key: `category:${category.id}`,
        labelAr: parent ? `${parent.nameAr} / ${category.nameAr}` : category.nameAr,
        labelEn: parent
          ? `${parent.nameEn || parent.nameAr} / ${category.nameEn || category.nameAr}`
          : (category.nameEn || category.nameAr),
        sortOrder: (parent?.sortOrder ?? 0) * 1000 + category.sortOrder,
      };
    }

    const kindLabel = KIND_LABELS[invoice.kind] || { ar: invoice.kind, en: invoice.kind };
    return {
      key: `kind:${invoice.kind}`,
      labelAr: kindLabel.ar,
      labelEn: kindLabel.en,
      sortOrder: 999999,
    };
  }

  private resolveTitle(groupKey: ReportRowKey, itemKey: string | undefined, categories: Map<string, CategoryNode>) {
    if (!itemKey) {
      return { labelAr: GROUP_LABELS[groupKey].ar, labelEn: GROUP_LABELS[groupKey].en };
    }

    if (itemKey.startsWith('account:')) {
      return { labelAr: 'تفاصيل الحساب', labelEn: 'Account details' };
    }

    if (itemKey.startsWith('expense-line:')) {
      return { labelAr: 'تفاصيل البند', labelEn: 'Item details' };
    }
    if (itemKey.startsWith('sales-channel:')) {
      return { labelAr: 'تفاصيل قناة البيع', labelEn: 'Sales channel details' };
    }
    if (itemKey.startsWith('category:')) {
      const categoryId = itemKey.replace('category:', '');
      const category = categories.get(categoryId);
      const parent = category?.parentId ? categories.get(category.parentId) : null;
      if (category) {
        return {
          labelAr: parent ? `${parent.nameAr} / ${category.nameAr}` : category.nameAr,
          labelEn: parent
            ? `${parent.nameEn || parent.nameAr} / ${category.nameEn || category.nameAr}`
            : (category.nameEn || category.nameAr),
        };
      }
    }
    if (itemKey.startsWith('kind:')) {
      const kind = itemKey.replace('kind:', '');
      return { labelAr: KIND_LABELS[kind]?.ar || kind, labelEn: KIND_LABELS[kind]?.en || kind };
    }

    return { labelAr: GROUP_LABELS[groupKey].ar, labelEn: GROUP_LABELS[groupKey].en };
  }

  private getMonthIndex(date: Date) {
    return date.getUTCMonth();
  }

  private zeroMonths() {
    return Array.from({ length: 12 }, () => new Decimal(0));
  }

  private sumMonths(months: Decimal[]) {
    return months.reduce((sum, month) => sum.plus(month), new Decimal(0));
  }

  private percentOfSales(value: Decimal, salesAmount: Decimal) {
    if (!salesAmount || salesAmount.eq(0)) return new Decimal(0);
    return value.div(salesAmount).mul(100);
  }

  private dec(value: Decimal.Value) {
    return new Decimal(value || 0);
  }

  /**
   * تقرير الضرائب — تجميع مخرجات ومدخلات ضريبة القيمة المضافة من الفواتير
   */
  async getTaxVatReport(companyId: string, year: number, period: string) {
    let startMonth: number;
    let endMonth: number;
    if (period.startsWith('Q')) {
      const q = parseInt(period.slice(1), 10);
      startMonth = (q - 1) * 3;
      endMonth = startMonth + 2;
    } else if (period.startsWith('M')) {
      startMonth = endMonth = parseInt(period.slice(1), 10) - 1;
    } else {
      throw new BadRequestException('Invalid period');
    }
    const startDate = new Date(Date.UTC(year, startMonth, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, endMonth + 1, 0, 23, 59, 59, 999));

    const invoices = await this.prisma.invoice.findMany({
      where: {
        companyId,
        status: 'active',
        kind: { in: ['sale', 'purchase', 'expense', 'fixed_expense'] },
        transactionDate: { gte: startDate, lte: endDate },
      },
      select: { kind: true, netAmount: true, taxAmount: true },
    });

    const standard_sales = { amount: new Decimal(0), vat: new Decimal(0) };
    const exempt_sales = { amount: new Decimal(0), vat: new Decimal(0) };
    const standard_purchases = { amount: new Decimal(0), vat: new Decimal(0) };
    const exempt_purchases = { amount: new Decimal(0), vat: new Decimal(0) };

    for (const inv of invoices) {
      const net = this.dec(inv.netAmount);
      const tax = this.dec(inv.taxAmount);
      if (inv.kind === 'sale') {
        if (tax.gt(0)) {
          standard_sales.amount = standard_sales.amount.plus(net);
          standard_sales.vat = standard_sales.vat.plus(tax);
        } else if (net.gt(0)) {
          exempt_sales.amount = exempt_sales.amount.plus(net);
        }
      } else {
        if (tax.gt(0)) {
          standard_purchases.amount = standard_purchases.amount.plus(net);
          standard_purchases.vat = standard_purchases.vat.plus(tax);
        } else if (net.gt(0)) {
          exempt_purchases.amount = exempt_purchases.amount.plus(net);
        }
      }
    }

    return {
      success: true,
      data: {
        standard_sales: { amount: standard_sales.amount.toNumber(), adjustment: 0, vat: standard_sales.vat.toNumber() },
        special_sales: { amount: 0, adjustment: 0, vat: 0 },
        zero_rated_domestic: { amount: 0, adjustment: 0, vat: 0 },
        exports: { amount: 0, adjustment: 0, vat: 0 },
        exempt_sales: { amount: exempt_sales.amount.toNumber(), adjustment: 0, vat: 0 },
        standard_purchases: { amount: standard_purchases.amount.toNumber(), adjustment: 0, vat: standard_purchases.vat.toNumber() },
        imports_customs: { amount: 0, adjustment: 0, vat: 0 },
        reverse_charge: { amount: 0, adjustment: 0, vat: 0 },
        exempt_purchases: { amount: exempt_purchases.amount.toNumber(), adjustment: 0, vat: 0 },
      },
    };
  }

  /**
   * ملخص خفيف للفترة: إجمالي حسب نوع الفاتورة + أعلى موردين مصروف/مشتريات.
   */
  async getPeriodAnalytics(companyId: string, startDateStr: string, endDateStr: string) {
    const start = new Date(`${String(startDateStr).slice(0, 10)}T00:00:00.000Z`);
    const end = new Date(`${String(endDateStr).slice(0, 10)}T23:59:59.999Z`);
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

    return {
      startDate: String(startDateStr).slice(0, 10),
      endDate: String(endDateStr).slice(0, 10),
      totalsByKind,
      topSuppliers,
    };
  }
}
