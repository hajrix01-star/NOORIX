import Decimal from 'decimal.js';
import {
  type CategoryNode,
  type ExpenseLineNode,
  type GroupKey,
  type ReportInvoice,
} from './reports-general-profit-loss-model.util';
import { plDec } from './reports-pl-math.util';
import { resolvePlCategoryMeta, resolvePlItemMeta } from './reports-pl-item-meta.util';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

/**
 * تجميع P&L بأسلوب مُحسَّن: استعلامان مُجمَّعان بدلاً من تحميل كل الصفوف الفردية.
 * القيود المحاسبية (ledger) مصدر الأرقام؛ قنوات البيع مصدر التفصيل للمبيعات.
 * النتيجة: ~100-500 صف بدلاً من عشرات الآلاف.
 */
export async function loadAnnualLedgerAggregates(prisma: TenantPrismaService, companyId: string, year: number) {
  const startDate = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

  type LedgerAggRow = {
    debit_type: string;
    debit_code: string;
    debit_account_id: string;
    debit_name_ar: string;
    debit_name_en: string | null;
    credit_type: string;
    credit_account_id: string;
    credit_name_ar: string;
    credit_name_en: string | null;
    inv_kind: string | null;
    category_id: string | null;
    supplier_id: string | null;
    supplier_category_id: string | null;
    expense_line_id: string | null;
    el_name_ar: string | null;
    el_name_en: string | null;
    el_category_id: string | null;
    month: number;
    amount: string;
  };

  type ChannelAggRow = {
    vault_id: string;
    vault_name_ar: string;
    vault_name_en: string | null;
    month: number;
    amount: string;
  };

  const [ledgerRows, channelRows, categories, expenseLines] = await Promise.all([
    prisma.$queryRaw<LedgerAggRow[]>`
        SELECT
          da.type            AS debit_type,
          da.code            AS debit_code,
          da.id              AS debit_account_id,
          da.name_ar         AS debit_name_ar,
          da.name_en         AS debit_name_en,
          ca.type            AS credit_type,
          ca.id              AS credit_account_id,
          ca.name_ar         AS credit_name_ar,
          ca.name_en         AS credit_name_en,
          i.kind             AS inv_kind,
          i.category_id,
          i.supplier_id,
          sup.supplier_category_id AS supplier_category_id,
          i.expense_line_id,
          el.name_ar         AS el_name_ar,
          el.name_en         AS el_name_en,
          el.category_id     AS el_category_id,
          EXTRACT(MONTH FROM le.transaction_date)::int AS month,
          SUM(le.amount)::text AS amount
        FROM ledger_entries le
        JOIN accounts da ON da.id = le.debit_account_id
        JOIN accounts ca ON ca.id = le.credit_account_id
        LEFT JOIN invoices i ON (
          i.company_id = le.company_id
          AND (
            (le.reference_type IN ('invoice', 'salary', 'advance') AND i.id = le.reference_id)
            OR (le.reference_type = 'sale' AND i.daily_sales_summary_id = le.reference_id)
          )
        )
        LEFT JOIN suppliers sup ON sup.id = i.supplier_id AND sup.company_id = i.company_id
        LEFT JOIN expense_lines el ON el.id = i.expense_line_id
        WHERE le.company_id = ${companyId}
          AND le.status = 'active'
          AND le.transaction_date BETWEEN ${startDate} AND ${endDate}
        GROUP BY
          da.type, da.code, da.id, da.name_ar, da.name_en,
          ca.type, ca.id, ca.name_ar, ca.name_en,
          i.kind, i.category_id, i.supplier_id, sup.supplier_category_id, i.expense_line_id,
          el.name_ar, el.name_en, el.category_id,
          month
      `,
    prisma.$queryRaw<ChannelAggRow[]>`
        SELECT
          v.id        AS vault_id,
          v.name_ar   AS vault_name_ar,
          v.name_en   AS vault_name_en,
          EXTRACT(MONTH FROM dss.transaction_date)::int AS month,
          SUM(dsc.amount)::text AS amount
        FROM daily_sales_channels dsc
        JOIN daily_sales_summaries dss ON dsc.summary_id = dss.id
        JOIN vaults v ON dsc.vault_id = v.id
        WHERE dss.company_id = ${companyId}
          AND dss.status = 'active'
          AND dss.transaction_date BETWEEN ${startDate} AND ${endDate}
        GROUP BY v.id, v.name_ar, v.name_en, month
      `,
    prisma.category.findMany({
      where: { companyId, isActive: true },
      select: { id: true, nameAr: true, nameEn: true, parentId: true, sortOrder: true, type: true, accountId: true },
    }),
    prisma.expenseLine.findMany({
      where: { companyId, isActive: true },
      select: { id: true, nameAr: true, nameEn: true, categoryId: true },
    }),
  ]);

  const catMap = new Map(categories.map((c) => [c.id, { ...c } as CategoryNode]));
  const accountToCategory = new Map<string, CategoryNode>();
  for (const cat of categories) {
    if (cat.accountId && !cat.parentId) accountToCategory.set(cat.accountId, cat as CategoryNode);
  }

  const entries: Array<{
    groupKey: GroupKey | null;
    monthIndex: number;
    amount: Decimal;
    itemKey: string;
    labelAr: string;
    labelEn: string;
    sortOrder: number;
  }> = [];

  for (const row of ledgerRows) {
    const amount = plDec(row.amount);
    const monthIndex = Number(row.month) - 1;

    if (row.credit_type === 'revenue') {
      if (row.inv_kind !== 'sale') {
        entries.push({
          groupKey: 'sales',
          monthIndex,
          amount,
          itemKey: `account:${row.credit_account_id}`,
          labelAr: row.credit_name_ar,
          labelEn: row.credit_name_en || row.credit_name_ar,
          sortOrder: 999,
        });
      }
    } else if (row.debit_type === 'expense') {
      const isPurchase = row.debit_code.startsWith('PUR');
      const groupKey: GroupKey = isPurchase ? 'purchases' : 'expenses';

      if (row.inv_kind !== null) {
        const pseudoInvoice = {
          kind: row.inv_kind,
          categoryId: row.category_id,
          expenseLine: row.expense_line_id
            ? {
                id: row.expense_line_id,
                nameAr: row.el_name_ar || row.expense_line_id,
                nameEn: row.el_name_en,
                categoryId: row.el_category_id || '',
              }
            : null,
          dailySalesSummary: null,
          supplier: row.supplier_id ? { supplierCategoryId: row.supplier_category_id ?? null } : null,
        };
        const meta = resolvePlItemMeta(pseudoInvoice as unknown as ReportInvoice, groupKey, catMap);
        const finalMeta = meta.key.startsWith('kind:') && accountToCategory.has(row.debit_account_id)
          ? resolvePlCategoryMeta(accountToCategory.get(row.debit_account_id)!, catMap)
          : meta;
        entries.push({ groupKey, monthIndex, amount, itemKey: finalMeta.key, labelAr: finalMeta.labelAr, labelEn: finalMeta.labelEn, sortOrder: finalMeta.sortOrder });
      } else {
        const linkedCat = accountToCategory.get(row.debit_account_id);
        if (linkedCat) {
          const meta = resolvePlCategoryMeta(linkedCat, catMap);
          entries.push({ groupKey, monthIndex, amount, itemKey: meta.key, labelAr: meta.labelAr, labelEn: meta.labelEn, sortOrder: meta.sortOrder });
        } else {
          const sortOrder = isPurchase ? (row.debit_code === 'PUR-001' ? 0 : 999) : parseInt(row.debit_code.replace(/\D/g, '') || '999', 10);
          entries.push({
            groupKey,
            monthIndex,
            amount,
            itemKey: `account:${row.debit_account_id}`,
            labelAr: row.debit_name_ar,
            labelEn: row.debit_name_en || row.debit_name_ar,
            sortOrder,
          });
        }
      }
    }
  }

  for (const ch of channelRows) {
    entries.push({
      groupKey: 'sales',
      monthIndex: Number(ch.month) - 1,
      amount: plDec(ch.amount),
      itemKey: `sales-channel:${ch.vault_id}`,
      labelAr: ch.vault_name_ar,
      labelEn: ch.vault_name_en || ch.vault_name_ar,
      sortOrder: 0,
    });
  }

  return { entries, categories: catMap, expenseLines: expenseLines as ExpenseLineNode[] };
}
