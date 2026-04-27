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
import { resolvePlItemMeta } from './reports-pl-item-meta.util';

/**
 * تفاصيل التقرير من Ledger — عند النقر على حساب (account:xxx)
 */
export async function loadPlDetailFromLedger(
  prisma: TenantPrismaService,
  companyId: string,
  year: number,
  month: number | undefined,
  groupKey: GroupKey,
  itemKey: string,
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
    const amt = plDec(e.amount);
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
        amount: plDec(ch.amount).toFixed(2),
      })),
      totalAmount: amt.toFixed(2),
      netAmount: amt.toFixed(2),
      taxAmount: '0',
      notes: inv?.notes || null,
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
  prisma: TenantPrismaService,
  companyId: string,
  year: number,
  groupKey: GroupKey,
  itemKey: string | undefined,
  categories: Map<string, CategoryNode>,
): Promise<Decimal[]> {
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
  prisma: TenantPrismaService,
  companyId: string,
  year: number,
  month: number | undefined,
  groupKey: GroupKey,
  itemKey: string | undefined,
  categories: Map<string, CategoryNode>,
) {
  const where = buildPlInvoiceWhere(companyId, year, month, groupKey, itemKey, categories);

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
    const itemMeta = resolvePlItemMeta(invoice as unknown as ReportInvoice, groupKey, categories);
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
      channelNames: (invoice.dailySalesSummary?.channels || []).map((ch) => ({
        nameAr: ch.vault.nameAr,
        nameEn: ch.vault.nameEn,
        amount: plDec(ch.amount).toFixed(2),
      })),
      totalAmount: plDec(invoice.totalAmount).toFixed(2),
      netAmount: plDec(invoice.netAmount).toFixed(2),
      taxAmount: plDec(invoice.taxAmount).toFixed(2),
      notes: invoice.notes || null,
    };
  });
}
