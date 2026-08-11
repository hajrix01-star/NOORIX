import { Prisma } from '@prisma/client';
import Decimal from 'decimal.js';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import {
  KIND_LABELS,
  KIND_TO_GROUP,
  type CategoryNode,
  type GroupKey,
  type ReportInvoice,
} from './reports-general-profit-loss-model.util';
import { getCategoryAndDescendantIds } from './reports-category-descendants.util';
import { plDec } from './reports-pl-math.util';
import { resolvePlCategoryMeta, resolvePlItemMeta } from './reports-pl-item-meta.util';
import { formatReportMoneyInteger, formatReportTaxAmount } from '../common/utils/report-display-format.util';

type PlInvoiceDetailPrisma = {
  ledgerEntry: Pick<TenantPrismaService['ledgerEntry'], 'findMany'>;
  invoice: Pick<TenantPrismaService['invoice'], 'findMany'>;
  dailySalesChannel: Pick<TenantPrismaService['dailySalesChannel'], 'findMany'>;
};

function salesChannelVaultId(itemKey: string | undefined): string | null {
  return itemKey?.startsWith('sales-channel:') ? itemKey.replace('sales-channel:', '') : null;
}

function allocateInvoicePart(
  amount: Decimal,
  invoiceTotal: Decimal,
  invoicePart: Decimal,
): Decimal {
  if (invoiceTotal.lte(0) || amount.lte(0) || invoicePart.lte(0)) return new Decimal(0);
  return invoicePart.mul(amount).div(invoiceTotal);
}

/**
 * تفاصيل التقرير من Ledger — عند النقر على حساب (account:xxx)
 */
export async function loadPlDetailFromLedger(
  prisma: PlInvoiceDetailPrisma,
  companyId: string,
  year: number,
  month: number | undefined,
  groupKey: GroupKey,
  itemKey: string,
  categories?: Map<string, CategoryNode>,
) {
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
  const accountId = itemKey.replace('account:', '');
  const where = {
    companyId,
    status: 'active',
    transactionDate: monthFilter ? monthFilter : { gte: startDate, lte: endDate },
    ...(isSales ? { creditAccountId: accountId } : { debitAccountId: accountId }),
  };

  const entries = await prisma.ledgerEntry.findMany({
    where,
    orderBy: { transactionDate: 'desc' },
    take: 500,
    select: {
      id: true,
      amount: true,
      transactionDate: true,
      referenceType: true,
      referenceId: true,
      employee: { select: { name: true } },
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
  const invoices = await prisma.invoice.findMany({
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
      categoryId: true,
      supplier: { select: { nameAr: true, nameEn: true, supplierCategoryId: true } },
      expenseLine: { select: { id: true, nameAr: true, nameEn: true, categoryId: true } },
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
    sourceReferenceId: string;
    sourceItemKey: string;
    reportAmount: string;
    totalAmount: string;
    netAmount: string;
    taxAmount: string;
    notes: string | null;
  }> = [];

  const accountCategory = categories
    ? [...categories.values()].find((category) => category.accountId === accountId && !category.parentId)
    : null;

  for (const e of entries) {
    const inv = invMap.get(e.referenceId) ?? invBySummaryId.get(e.referenceId);
    const ledgerAmt = plDec(e.amount);
    /**
     * هذا الصف يشرح مساهمة قيد محدد في بند التقرير، لا قيمة الفاتورة كاملة.
     * استخدام إجمالي الفاتورة هنا كان يجعل جدول المستندات يختلف عن الملخص
     * عندما تحتوي الفاتورة على أكثر من حساب/بند محاسبي.
     */
    const displayTotal = ledgerAmt;
    const displayNet = ledgerAmt;
    const displayTax = plDec(0);
    const kind = inv?.kind || e.referenceType || '—';
    const isAdvanceSettlement = e.referenceType === 'advance_settlement';
    const kindLabelAr = isAdvanceSettlement ? 'تسوية سلفة مع راتب' : (KIND_LABELS[kind]?.ar || kind);
    const kindLabelEn = isAdvanceSettlement ? 'Payroll advance settlement' : (KIND_LABELS[kind]?.en || kind);
    const resolvedItemMeta = inv && categories
      ? resolvePlItemMeta(inv as unknown as ReportInvoice, groupKey, categories)
      : null;
    const sourceItemMeta = resolvedItemMeta?.key.startsWith('kind:') && accountCategory && categories
      ? resolvePlCategoryMeta(accountCategory, categories)
      : resolvedItemMeta;
    result.push({
      id: e.id,
      invoiceNumber: isAdvanceSettlement
        ? `تسوية سلفة — ${e.employee?.name || 'موظف'}`
        : (inv?.invoiceNumber || e.referenceId?.slice(0, 12) || '—'),
      supplierInvoiceNumber: inv?.supplierInvoiceNumber || null,
      transactionDate: e.transactionDate.toISOString(),
      kind,
      kindLabelAr,
      kindLabelEn,
      categoryId: null,
      itemKey,
      itemLabelAr: '',
      itemLabelEn: '',
      supplierNameAr: isAdvanceSettlement ? (e.employee?.name || null) : (inv?.supplier?.nameAr || null),
      supplierNameEn: isAdvanceSettlement ? (e.employee?.name || null) : (inv?.supplier?.nameEn || null),
      expenseLineNameAr: inv?.expenseLine?.nameAr || null,
      expenseLineNameEn: inv?.expenseLine?.nameEn || null,
      summaryNumber: inv?.dailySalesSummary?.summaryNumber || null,
      channelNames: (inv?.dailySalesSummary?.channels || []).map((ch) => ({
        nameAr: ch.vault.nameAr,
        nameEn: ch.vault.nameEn,
        amount: formatReportMoneyInteger(plDec(ch.amount)),
      })),
      sourceReferenceId: e.referenceId,
      sourceItemKey: sourceItemMeta?.key || itemKey,
      reportAmount: displayTotal.toFixed(4),
      totalAmount: formatReportMoneyInteger(displayTotal),
      netAmount: formatReportMoneyInteger(displayNet),
      taxAmount: formatReportTaxAmount(displayTax),
      notes: isAdvanceSettlement ? 'تسوية سلفة موظف ضمن مسير الرواتب دون حركة نقدية جديدة.' : (inv?.notes || null),
    });
  }

  return result;
}

/**
 * فلتر فواتير تقرير ربح وخسارة — نفس منطق التفاصيل والاتجاه (إجمالي الفاتورة شامل الضريبة).
 */
export function buildPlInvoiceWhere(
  companyId: string,
  year: number,
  month: number | undefined,
  groupKey: GroupKey,
  itemKey: string | undefined,
  categories: Map<string, CategoryNode>,
): Prisma.InvoiceWhereInput {
  const startDate = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

  const kindsForGroup = (Object.entries(KIND_TO_GROUP) as Array<[string, GroupKey | null]>)
    .filter(([, g]) => g === groupKey)
    .map(([k]) => k);

  const dateFilter =
    month != null
      ? {
          gte: new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0)),
          lte: new Date(Date.UTC(year, month - 1, 31, 23, 59, 59, 999)),
        }
      : { gte: startDate, lte: endDate };

  let where: Prisma.InvoiceWhereInput = {
    companyId,
    status: 'active',
    kind: { in: kindsForGroup },
    transactionDate: dateFilter,
  };

  if (itemKey?.startsWith('kind:')) {
    where = { ...where, kind: itemKey.replace('kind:', '') };
  } else if (itemKey?.startsWith('expense-line:')) {
    where = { ...where, expenseLineId: itemKey.replace('expense-line:', '') };
  } else if (itemKey?.startsWith('category:')) {
    const catIds = getCategoryAndDescendantIds(itemKey.replace('category:', ''), categories);
    const categoryOr: Prisma.InvoiceWhereInput[] = [
      { categoryId: { in: [...catIds] } },
      { expenseLine: { categoryId: { in: [...catIds] } } },
    ];
    if (groupKey === 'purchases' || groupKey === 'expenses') {
      categoryOr.push({ supplier: { supplierCategoryId: { in: [...catIds] } } });
    }
    where = {
      ...where,
      OR: categoryOr,
    };
  } else if (itemKey?.startsWith('sales-channel:')) {
    where = {
      ...where,
      dailySalesSummary: { channels: { some: { vaultId: itemKey.replace('sales-channel:', '') } } },
    };
  }

  return where;
}

/** مجموع إجمالي الفاتورة (شامل الضريبة) لكل شهر من السنة للبند */
export async function sumInvoiceTotalAmountByMonth(
  prisma: PlInvoiceDetailPrisma,
  companyId: string,
  year: number,
  groupKey: GroupKey,
  itemKey: string | undefined,
  categories: Map<string, CategoryNode>,
): Promise<Decimal[]> {
  const channelVaultId = salesChannelVaultId(itemKey);
  if (groupKey === 'sales' && channelVaultId) {
    const startDate = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
    const rows = await prisma.dailySalesChannel.findMany({
      where: {
        vaultId: channelVaultId,
        summary: {
          companyId,
          status: 'active',
          transactionDate: { gte: startDate, lte: endDate },
        },
      },
      select: {
        amount: true,
        summary: { select: { transactionDate: true } },
      },
    });
    const months = Array.from({ length: 12 }, () => new Decimal(0));
    for (const r of rows) {
      const m = r.summary.transactionDate.getUTCMonth();
      months[m] = months[m].plus(plDec(r.amount));
    }
    return months;
  }

  const where = buildPlInvoiceWhere(companyId, year, undefined, groupKey, itemKey, categories);
  const rows = await prisma.invoice.findMany({
    where,
    select: { transactionDate: true, totalAmount: true },
  });
  const months = Array.from({ length: 12 }, () => new Decimal(0));
  for (const r of rows) {
    const m = r.transactionDate.getUTCMonth();
    months[m] = months[m].plus(plDec(r.totalAmount));
  }
  return months;
}

/**
 * استعلام مستهدف لتفاصيل التقرير — يُفلتر في SQL بدلاً من تحميل كل الفواتير.
 * الحد الأقصى 500 فاتورة لكل طلب تفاصيل.
 */
export async function loadPlDetailInvoices(
  prisma: PlInvoiceDetailPrisma,
  companyId: string,
  year: number,
  month: number | undefined,
  groupKey: GroupKey,
  itemKey: string | undefined,
  categories: Map<string, CategoryNode>,
) {
  const where = buildPlInvoiceWhere(companyId, year, month, groupKey, itemKey, categories);
  const channelVaultId = groupKey === 'sales' ? salesChannelVaultId(itemKey) : null;

  const invoices = await prisma.invoice.findMany({
    where,
    orderBy: { transactionDate: 'desc' },
    take: 500,
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
      supplier: { select: { nameAr: true, nameEn: true, supplierCategoryId: true } },
      expenseLine: { select: { id: true, nameAr: true, nameEn: true, categoryId: true } },
      dailySalesSummary: {
        select: {
          summaryNumber: true,
          channels: {
            select: { amount: true, vault: { select: { id: true, nameAr: true, nameEn: true } } },
          },
        },
      },
    },
  });

  return invoices.map((invoice) => {
    const selectedChannel =
      channelVaultId != null
        ? invoice.dailySalesSummary?.channels.find((ch) => ch.vault.id === channelVaultId) ?? null
        : null;
    const itemMeta = selectedChannel
      ? {
          key: `sales-channel:${selectedChannel.vault.id}`,
          labelAr: selectedChannel.vault.nameAr,
          labelEn: selectedChannel.vault.nameEn || selectedChannel.vault.nameAr,
        }
      : resolvePlItemMeta(invoice, groupKey, categories);
    const channelGross =
      selectedChannel != null ? selectedChannel.amount : null;
    const displayTotal = channelGross != null ? plDec(channelGross) : plDec(invoice.totalAmount);
    const invoiceTotal = plDec(invoice.totalAmount);
    const displayNet =
      channelGross != null
        ? allocateInvoicePart(displayTotal, invoiceTotal, plDec(invoice.netAmount))
        : plDec(invoice.netAmount);
    const displayTax =
      channelGross != null
        ? allocateInvoicePart(displayTotal, invoiceTotal, plDec(invoice.taxAmount))
        : plDec(invoice.taxAmount);
    const channelNames = (invoice.dailySalesSummary?.channels || [])
      .filter((ch) => channelVaultId == null || ch.vault.id === channelVaultId)
      .map((ch) => ({
        nameAr: ch.vault.nameAr,
        nameEn: ch.vault.nameEn,
        amount: formatReportMoneyInteger(plDec(ch.amount)),
      }));

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
      channelNames,
      sourceReferenceId: invoice.id,
      sourceItemKey: itemMeta.key,
      reportAmount: displayTotal.toFixed(4),
      totalAmount: formatReportMoneyInteger(displayTotal),
      netAmount: formatReportMoneyInteger(displayNet),
      taxAmount: formatReportTaxAmount(displayTax),
      notes: invoice.notes || null,
    };
  });
}
