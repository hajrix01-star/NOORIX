import { BadRequestException, Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { toYmd } from '../common/utils/to-ymd.util';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { ReportsService } from '../reports/reports.service';
import { buildDashboardLedgerProjection, type DashboardLedgerProjectionRow } from './dashboard-ledger-projection.util';

type LedgerProjectionDbRow = {
  amount: string;
  reporting_class: string | null;
  reference_type: string;
  debit_type: string;
  debit_code: string;
  credit_type: string;
  credit_code: string;
};

@Injectable()
export class DashboardLedgerProjectionService {
  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly reportsService: ReportsService,
  ) {}

  /** Parallel read only; no dashboard UI cutover happens here. */
  async getPeriodProjection(companyId: string, startDateText: string, endDateText: string) {
    const startDate = new Date(`${toYmd(startDateText)}T00:00:00.000Z`);
    const endDate = new Date(`${toYmd(endDateText)}T23:59:59.999Z`);
    const rows = await this.prisma.withTenant((tx) => tx.$queryRaw<LedgerProjectionDbRow[]>`
      SELECT le.amount::text AS amount, le.reporting_class, le.reference_type,
        da.type AS debit_type, da.code AS debit_code, ca.type AS credit_type, ca.code AS credit_code
      FROM ledger_entries le
      JOIN accounts da ON da.id = le.debit_account_id
      JOIN accounts ca ON ca.id = le.credit_account_id
      WHERE le.company_id = ${companyId}
        AND le.status = 'active'
        AND le.transaction_date BETWEEN ${startDate} AND ${endDate}
        AND le.tenant_id = current_setting('app.current_tenant_id')
    `);
    return buildDashboardLedgerProjection(rows.map((row): DashboardLedgerProjectionRow => ({
      amount: row.amount, reportingClass: row.reporting_class, referenceType: row.reference_type,
      debitType: row.debit_type, debitCode: row.debit_code, creditType: row.credit_type, creditCode: row.credit_code,
    })));
  }

  /**
   * Owner-only, read-only preflight. It compares the current P&L contract with
   * the parallel reporting-class projection; it never mutates invoices or ledgers.
   */
  async getPeriodReconciliation(companyId: string, startDateText: string, endDateText: string) {
    const startDate = new Date(`${toYmd(startDateText)}T00:00:00.000Z`);
    const endDate = new Date(`${toYmd(endDateText)}T23:59:59.999Z`);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) {
      throw new BadRequestException('Invalid reconciliation date range');
    }

    const [currentProfitLoss, ledger] = await Promise.all([
      this.reportsService.getGeneralProfitLossPeriodTotals(companyId, toYmd(startDateText), toYmd(endDateText)),
      this.getPeriodProjection(companyId, startDateText, endDateText),
    ]);

    const ledgerExpenses = new Decimal(ledger.recurringExpenses)
      .plus(ledger.otherExpenses)
      .plus(ledger.payroll);
    const currentOperatingCosts = new Decimal(currentProfitLoss.purchases).plus(currentProfitLoss.expenses);
    const ledgerOperatingCosts = new Decimal(ledger.operatingCosts);
    const dimensions = [
      ['sales', currentProfitLoss.sales, ledger.sales],
      ['purchases', currentProfitLoss.purchases, ledger.purchases],
      ['expenses', currentProfitLoss.expenses, ledgerExpenses.toFixed(4)],
      ['operatingCosts', currentOperatingCosts.toFixed(4), ledgerOperatingCosts.toFixed(4)],
      ['operatingResult', new Decimal(currentProfitLoss.sales).minus(currentOperatingCosts).toFixed(4), ledger.operatingResult],
    ].map(([key, currentValue, ledgerValue]) => {
      const delta = new Decimal(String(ledgerValue)).minus(String(currentValue));
      return {
        key,
        currentValue: new Decimal(String(currentValue)).toFixed(4),
        ledgerValue: new Decimal(String(ledgerValue)).toFixed(4),
        delta: delta.toFixed(4),
        matches: delta.isZero(),
      };
    });

    return {
      source: 'read_only_ledger_reconciliation_v1' as const,
      period: { startDate: toYmd(startDateText), endDate: toYmd(endDateText) },
      currentProfitLoss,
      ledger,
      dimensions,
      readyForCutover: ledger.coverage.unclassifiedRowCount === 0 && dimensions.every((row) => row.matches),
    };
  }
}
