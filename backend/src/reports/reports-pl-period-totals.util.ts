import Decimal from 'decimal.js';
import { toYmd } from '../common/utils/to-ymd.util';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

type LedgerPeriodTotalsRow = {
  expenses: string;
  other_sales: string;
  purchases: string;
};

type SalesPeriodTotalsRow = {
  sales: string;
};

export async function loadPlPeriodTotals(
  prisma: TenantPrismaService,
  companyId: string,
  startDateText: string,
  endDateText: string,
) {
  const startDate = new Date(`${toYmd(startDateText)}T00:00:00.000Z`);
  const endDate = new Date(`${toYmd(endDateText)}T23:59:59.999Z`);

  const [ledgerRows, salesRows] = await Promise.all([
    prisma.$queryRaw<LedgerPeriodTotalsRow[]>`
      SELECT
        COALESCE(SUM(
          CASE
            WHEN da.type = 'expense' AND da.code LIKE 'PUR%' THEN le.amount
            ELSE 0
          END
        ), 0)::text AS purchases,
        COALESCE(SUM(
          CASE
            WHEN da.type = 'expense' AND da.code NOT LIKE 'PUR%' THEN le.amount
            ELSE 0
          END
        ), 0)::text AS expenses,
        COALESCE(SUM(
          CASE
            WHEN ca.type = 'revenue' AND (i.kind IS NULL OR i.kind <> 'sale') THEN le.amount
            ELSE 0
          END
        ), 0)::text AS other_sales
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
      WHERE le.company_id = ${companyId}
        AND le.status = 'active'
        AND le.transaction_date BETWEEN ${startDate} AND ${endDate}
    `,
    prisma.$queryRaw<SalesPeriodTotalsRow[]>`
      SELECT COALESCE(SUM(dsc.amount), 0)::text AS sales
      FROM daily_sales_channels dsc
      JOIN daily_sales_summaries dss ON dsc.summary_id = dss.id
      WHERE dss.company_id = ${companyId}
        AND dss.status = 'active'
        AND dss.transaction_date BETWEEN ${startDate} AND ${endDate}
    `,
  ]);

  const ledger = ledgerRows[0] ?? {
    expenses: '0',
    other_sales: '0',
    purchases: '0',
  };
  const channelSales = salesRows[0]?.sales ?? '0';
  return {
    expenses: new Decimal(ledger.expenses).toFixed(4),
    purchases: new Decimal(ledger.purchases).toFixed(4),
    sales: new Decimal(channelSales).plus(ledger.other_sales).toFixed(4),
  };
}
