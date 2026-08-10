import { Injectable } from '@nestjs/common';
import { toYmd } from '../common/utils/to-ymd.util';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
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
  constructor(private readonly prisma: TenantPrismaService) {}

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
}
