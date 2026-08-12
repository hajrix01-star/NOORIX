import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

type ReconciliationRow = {
  source: 'structured' | 'documented_historical_repair' | 'legacy_ledger' | 'direct_advance_invoice_duplicate' | 'salary_invoice' | 'historical_standalone_salary' | 'historical_part_time_payroll' | 'unexplained_payroll_ledger' | 'payroll_run';
  id: string;
  date: string;
  employeeId: string | null;
  employeeName: string | null;
  runId: string | null;
  runNumber: string | null;
  payrollItemId: string | null;
  advanceInvoiceId: string | null;
  advanceInvoiceNumber: string | null;
  deductionId: string | null;
  ledgerEntryId: string | null;
  amount: number;
  status: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
};

const money = (value: Prisma.Decimal | number | string | null | undefined) =>
  Number(new Prisma.Decimal(value ?? 0).toDecimalPlaces(2));
const key = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
const ymd = (date: Date) => date.toISOString().slice(0, 10);
const ADVANCE_PAYROLL_NOTE_RE = /(?:^|\r?\n)\[ADV_PAYROLL\]\s*run=([^,\s]+),\s*amount=([0-9]+(?:\.[0-9]{1,2})?),\s*date=\d{4}-\d{2}-\d{2}\s*$/;
const LEGACY_SETTLEMENT_NOTE_RE = /^خصم سلفة تلقائي من مسير\s+(.+?)\s*-\s*سلفة\s+(.+)$/;

@Injectable()
export class HrPayrollReconciliationService {
  constructor(private readonly prisma: TenantPrismaService) {}

  async getYear(companyId: string, year: number, includeRows = false) {
    const from = new Date(Date.UTC(year, 0, 1));
    const to = new Date(Date.UTC(year + 1, 0, 1));
    const salaryExpense = await this.prisma.account.findFirst({
      where: { companyId, code: 'EXP-004', type: 'expense' },
      select: { id: true },
    });

    const runs = await this.prisma.payrollRun.findMany({
      where: { companyId, payrollMonth: { gte: from, lt: to }, status: 'completed' },
      include: { items: { include: { employee: { select: { id: true, name: true } } } } },
      orderBy: { payrollMonth: 'asc' },
    });
    const yearRunIds = runs.map((run) => run.id);
    const [salaryInvoices, settlements, salaryLedger, historicalPartTimeLinks] = await Promise.all([
      this.prisma.invoice.findMany({
        where: {
          companyId,
          kind: 'salary',
          status: 'active',
          OR: [
            { batchId: { in: yearRunIds } },
            { transactionDate: { gte: from, lt: to } },
          ],
        },
        select: { id: true, batchId: true, invoiceNumber: true, invoiceDate: true, transactionDate: true, totalAmount: true, employeeId: true, employee: { select: { name: true } } },
      }),
      this.prisma.payrollAdvanceSettlement.findMany({
        where: { companyId, settlementDate: { gte: from, lt: to } },
        include: {
          employee: { select: { name: true } },
          payrollRun: { select: { id: true, runNumber: true, payrollMonth: true } },
          advanceInvoice: { select: { invoiceNumber: true } },
        },
      }),
      this.prisma.ledgerEntry.findMany({
        where: {
          companyId,
          debitAccountId: salaryExpense?.id ?? '__missing_salary_expense__',
          status: 'active',
          transactionDate: { gte: from, lt: to },
        },
        include: { employee: { select: { name: true } } },
      }),
      this.prisma.historicalPartTimePayrollLink.findMany({
        where: { companyId, status: 'active', payrollMonth: { gte: from, lt: to } },
        include: {
          employee: { select: { name: true } },
          ledgerEntry: { select: { id: true, amount: true, status: true, transactionDate: true, employeeId: true } },
        },
      }),
    ]);

    const linkedLedgerIds = new Set(settlements.map((row) => row.ledgerEntryId).filter(Boolean));
    const advanceLedger = salaryLedger.filter((row) => row.referenceType === 'advance_settlement' && !linkedLedgerIds.has(row.id));
    const advanceDeductionIds = advanceLedger.map((row) => row.referenceId);
    const historicalDeductions = advanceDeductionIds.length
      ? await this.prisma.employeeDeduction.findMany({
          where: { companyId, id: { in: advanceDeductionIds }, deductionType: 'advance' },
          select: { id: true, employeeId: true, notes: true },
        })
      : [];
    const deductionById = new Map(historicalDeductions.map((row) => [row.id, row]));
    const runById = new Map(runs.map((run) => [run.id, run]));
    const itemContext = new Map(runs.flatMap((run) => run.items.map((item) => [item.id, {
      runId: run.id, runNumber: run.runNumber, employeeId: item.employee.id,
    }] as const)));
    const documentedRepairContext = new Map<string, { runId: string; runNumber: string; payrollItemId: string }>();
    for (const ledger of advanceLedger) {
      const deduction = deductionById.get(ledger.referenceId);
      const match = String(deduction?.notes ?? '').match(
        /^\[(?:PAYROLL_COST_GAP_REPAIR_V2|PAYROLL_ADVANCE_RECONCILIATION)\]\s*run=([^,\s]+),\s*payrollItem=([^,\s]+)/,
      );
      if (!deduction || !match) continue;
      const item = itemContext.get(match[2]);
      if (!item || item.runNumber !== match[1] || item.employeeId !== deduction.employeeId || ledger.employeeId !== deduction.employeeId) continue;
      documentedRepairContext.set(ledger.id, { runId: item.runId, runNumber: item.runNumber, payrollItemId: match[2] });
    }
    const documentedHistoricalRepairLedger = advanceLedger.filter((row) => documentedRepairContext.has(row.id));
    const legacyLedger = advanceLedger.filter((row) => !documentedRepairContext.has(row.id));
    const legacySettlementContext = new Map<string, { runNumber: string; advanceInvoiceNumber: string }>();
    for (const ledger of legacyLedger) {
      const note = String(deductionById.get(ledger.referenceId)?.notes ?? '').trim();
      const match = note.match(LEGACY_SETTLEMENT_NOTE_RE);
      if (!match) continue;
      legacySettlementContext.set(ledger.id, {
        runNumber: match[1].trim(),
        advanceInvoiceNumber: match[2].trim(),
      });
    }

    const directAdvanceInvoiceLedgers = salaryLedger.filter((row) => row.referenceType === 'invoice');
    const directAdvanceInvoices = directAdvanceInvoiceLedgers.length
      ? await this.prisma.invoice.findMany({
          where: { companyId, id: { in: directAdvanceInvoiceLedgers.map((row) => row.referenceId) }, kind: 'advance', status: 'active' },
          select: { id: true, employeeId: true, invoiceNumber: true, totalAmount: true, notes: true },
        })
      : [];
    const directAdvanceInvoiceById = new Map(directAdvanceInvoices.map((row) => [row.id, row]));
    const directAdvanceContext = new Map<string, { runId: string; runNumber: string; payrollItemId: string; advanceInvoiceId: string; advanceInvoiceNumber: string }>();
    for (const ledger of directAdvanceInvoiceLedgers) {
      const advance = directAdvanceInvoiceById.get(ledger.referenceId);
      const tag = String(advance?.notes ?? '').match(ADVANCE_PAYROLL_NOTE_RE);
      const run = tag ? runs.find((row) => row.runNumber === tag[1]) : undefined;
      const item = advance?.employeeId ? run?.items.find((row) => row.employeeId === advance.employeeId) : undefined;
      if (!advance || !tag || !run || !item || !advance.employeeId || (ledger.employeeId && ledger.employeeId !== advance.employeeId)) continue;
      if (
        money(ledger.amount) !== money(advance.totalAmount)
        || money(ledger.amount) !== money(item.advancesDeduct)
        || Number(tag[2]) !== money(ledger.amount)
      ) continue;
      directAdvanceContext.set(ledger.id, {
        runId: run.id, runNumber: run.runNumber, payrollItemId: item.id,
        advanceInvoiceId: advance.id, advanceInvoiceNumber: advance.invoiceNumber,
      });
    }

    const months = Array.from({ length: 12 }, (_, index) => {
      const month = `${year}-${String(index + 1).padStart(2, '0')}`;
      const monthRuns = runs.filter((run) => key(run.payrollMonth) === month);
      const runIds = new Set(monthRuns.map((run) => run.id));
      const monthInvoices = salaryInvoices.filter((invoice) => invoice.batchId && runIds.has(invoice.batchId));
      const monthStandaloneSalaryInvoices = salaryInvoices.filter((invoice) =>
        key(invoice.transactionDate) === month && (!invoice.batchId || !runById.has(invoice.batchId)),
      );
      const monthSettlements = settlements.filter((row) => key(row.payrollRun?.payrollMonth ?? row.settlementDate) === month);
      const monthLedger = salaryLedger.filter((row) => key(row.transactionDate) === month);
      const monthLegacy = legacyLedger.filter((row) => key(row.transactionDate) === month);
      const monthDocumentedRepairs = documentedHistoricalRepairLedger.filter((row) => key(row.transactionDate) === month);
      const monthPartTimeLinks = historicalPartTimeLinks.filter((row) =>
        key(row.payrollMonth) === month && row.ledgerEntry.status === 'active',
      );
      const partTimeLedgerIds = new Set(monthPartTimeLinks.map((row) => row.ledgerEntryId));
      const expectedSalaryInvoiceIds = new Set([
        ...monthInvoices,
        ...monthStandaloneSalaryInvoices,
      ].map((invoice) => invoice.id));
      const monthUnexplainedPayrollLedger = monthLedger.filter((row) =>
        row.referenceType !== 'advance_settlement'
        && !partTimeLedgerIds.has(row.id)
        && !(row.referenceType === 'payroll_accrual' && runIds.has(row.referenceId))
        && !(row.referenceType === 'salary' && expectedSalaryInvoiceIds.has(row.referenceId)),
      );

      // Expected payroll cost follows the exact current accrual formula: net payable
      // plus advance deductions. This avoids comparing payroll cost with cash payments.
      const payrollRunsTotal = monthRuns.reduce(
        (sum, run) => sum.plus(run.totalAmount).plus(run.items.reduce((s, item) => s.plus(item.advancesDeduct ?? 0), new Prisma.Decimal(0))),
        new Prisma.Decimal(0),
      );
      const structuredAdvanceSettlementsTotal = monthSettlements
        .filter((row) => row.status === 'active')
        .reduce((sum, row) => sum.plus(row.amount), new Prisma.Decimal(0));
      const salaryInvoicesTotal = monthInvoices.reduce((sum, row) => sum.plus(row.totalAmount), new Prisma.Decimal(0));
      const standaloneSalaryPaymentsTotal = monthStandaloneSalaryInvoices.reduce(
        (sum, row) => sum.plus(row.totalAmount),
        new Prisma.Decimal(0),
      );
      const legacyAdvanceSettlementLedgerTotal = monthLegacy.reduce((sum, row) => sum.plus(row.amount), new Prisma.Decimal(0));
      const documentedHistoricalRepairTotal = monthDocumentedRepairs.reduce((sum, row) => sum.plus(row.amount), new Prisma.Decimal(0));
      const unexplainedPayrollLedgerTotal = monthUnexplainedPayrollLedger.reduce(
        (sum, row) => sum.plus(row.amount),
        new Prisma.Decimal(0),
      );
      const historicalPartTimePayrollTotal = monthPartTimeLinks.reduce(
        (sum, row) => sum.plus(row.ledgerEntry.amount), new Prisma.Decimal(0),
      );
      const ledgerPayrollCostTotal = monthLedger.reduce((sum, row) => sum.plus(row.amount), new Prisma.Decimal(0));
      const payrollExpectedCostTotal = payrollRunsTotal
        .plus(standaloneSalaryPaymentsTotal)
        .plus(historicalPartTimePayrollTotal);
      const difference = ledgerPayrollCostTotal.minus(payrollExpectedCostTotal);
      const structuredExpected = monthRuns.reduce(
        (sum, run) => sum.plus(run.items.reduce((s, item) => s.plus(item.advancesDeduct ?? 0), new Prisma.Decimal(0))),
        new Prisma.Decimal(0),
      );
      const structuredMatched = structuredAdvanceSettlementsTotal
        .plus(documentedHistoricalRepairTotal)
        .minus(structuredExpected)
        .abs()
        .lte(0.02);
      const matched = difference.abs().lte(0.02) && structuredMatched;
      const confidence: 'high' | 'medium' | 'low' = matched
        ? (monthRuns.length && monthSettlements.length ? 'high' : 'medium')
        : 'low';

      const rows: ReconciliationRow[] = [];
      if (includeRows) {
        for (const run of monthRuns) rows.push({
          source: 'payroll_run', id: run.id, date: ymd(run.payrollMonth), employeeId: null, employeeName: null,
          runId: run.id, runNumber: run.runNumber, payrollItemId: null, advanceInvoiceId: null,
          advanceInvoiceNumber: null, deductionId: null, ledgerEntryId: null,
          amount: money(new Prisma.Decimal(run.totalAmount).plus(run.items.reduce((s, item) => s.plus(item.advancesDeduct ?? 0), new Prisma.Decimal(0)))),
          status: run.status, confidence: 'high', reason: 'Structured payroll expected cost',
        });
        for (const row of monthSettlements) rows.push({
          source: 'structured', id: row.id, date: ymd(row.settlementDate), employeeId: row.employeeId,
          employeeName: row.employee.name, runId: row.payrollRunId, runNumber: row.payrollRun?.runNumber ?? null,
          payrollItemId: row.payrollRunItemId, advanceInvoiceId: row.advanceInvoiceId,
          advanceInvoiceNumber: row.advanceInvoice.invoiceNumber, deductionId: row.deductionId,
          ledgerEntryId: row.ledgerEntryId, amount: money(row.amount), status: row.status,
          confidence: 'high', reason: 'Direct payroll item and advance link',
        });
        for (const row of monthLegacy) rows.push({
          source: 'legacy_ledger', id: row.id, date: ymd(row.transactionDate), employeeId: row.employeeId,
          employeeName: row.employee?.name ?? null, runId: null,
          runNumber: legacySettlementContext.get(row.id)?.runNumber ?? null, payrollItemId: null,
          advanceInvoiceId: null, advanceInvoiceNumber: legacySettlementContext.get(row.id)?.advanceInvoiceNumber ?? null, deductionId: row.referenceId,
          ledgerEntryId: row.id, amount: money(row.amount), status: row.status,
          confidence: 'low', reason: 'Legacy text/reference link requires review',
        });
        for (const row of monthDocumentedRepairs) {
          const context = documentedRepairContext.get(row.id)!;
          rows.push({
            source: 'documented_historical_repair', id: row.id, date: ymd(row.transactionDate), employeeId: row.employeeId,
            employeeName: row.employee?.name ?? null, runId: context.runId, runNumber: context.runNumber,
            payrollItemId: context.payrollItemId, advanceInvoiceId: null, advanceInvoiceNumber: null,
            deductionId: row.referenceId, ledgerEntryId: row.id, amount: money(row.amount), status: row.status,
            confidence: 'medium', reason: 'Exact historical repair marker linked to payroll item; advance invoice is unavailable',
          });
        }
        for (const row of monthInvoices) rows.push({
          source: 'salary_invoice', id: row.id, date: ymd(row.transactionDate), employeeId: row.employeeId,
          employeeName: row.employee?.name ?? null, runId: row.batchId, runNumber: row.batchId ? runById.get(row.batchId)?.runNumber ?? null : null,
          payrollItemId: null, advanceInvoiceId: null, advanceInvoiceNumber: null, deductionId: null,
          ledgerEntryId: null, amount: money(row.totalAmount), status: 'active', confidence: row.batchId && runIds.has(row.batchId) ? 'high' : 'medium',
          reason: 'Salary cash-payment invoice; diagnostic only',
        });
        for (const row of monthStandaloneSalaryInvoices) rows.push({
          source: 'historical_standalone_salary', id: row.id, date: ymd(row.transactionDate), employeeId: row.employeeId,
          employeeName: row.employee?.name ?? null, runId: null, runNumber: null,
          payrollItemId: null, advanceInvoiceId: null, advanceInvoiceNumber: null, deductionId: null,
          ledgerEntryId: null, amount: money(row.totalAmount), status: 'active', confidence: 'medium',
          reason: 'Historical standalone salary payment included in expected payroll cost',
        });
        for (const row of monthPartTimeLinks) rows.push({
          source: 'historical_part_time_payroll', id: row.id, date: ymd(row.ledgerEntry.transactionDate),
          employeeId: row.employeeId, employeeName: row.employee?.name ?? 'بدون اسم موظف',
          runId: null, runNumber: 'دوام جزئي تاريخي', payrollItemId: null,
          advanceInvoiceId: null, advanceInvoiceNumber: null, deductionId: null,
          ledgerEntryId: row.ledgerEntryId, amount: money(row.ledgerEntry.amount), status: row.status,
          confidence: 'high', reason: `Historical part-time payroll link (${row.employeeMatchSource})`,
        });
        for (const row of monthUnexplainedPayrollLedger) rows.push({
          source: directAdvanceContext.has(row.id) ? 'direct_advance_invoice_duplicate' : 'unexplained_payroll_ledger',
          id: row.id, date: ymd(row.transactionDate), employeeId: row.employeeId,
          employeeName: row.employee?.name ?? null, runId: directAdvanceContext.get(row.id)?.runId ?? null,
          runNumber: directAdvanceContext.get(row.id)?.runNumber ?? null,
          payrollItemId: directAdvanceContext.get(row.id)?.payrollItemId ?? null,
          advanceInvoiceId: directAdvanceContext.get(row.id)?.advanceInvoiceId ?? null,
          advanceInvoiceNumber: directAdvanceContext.get(row.id)?.advanceInvoiceNumber ?? null, deductionId: null,
          ledgerEntryId: row.id, amount: money(row.amount), status: row.status,
          confidence: directAdvanceContext.has(row.id) ? 'high' : 'low',
          reason: directAdvanceContext.has(row.id)
            ? 'Direct advance invoice was also posted as payroll cost; server confirmation is required before cancellation'
            : `Unlinked payroll-cost ledger entry (reference: ${row.referenceType || 'none'})`,
        });
      }

      return {
        month,
        payrollRunsTotal: money(payrollRunsTotal),
        standaloneSalaryPaymentsTotal: money(standaloneSalaryPaymentsTotal),
        historicalPartTimePayrollTotal: money(historicalPartTimePayrollTotal),
        unexplainedPayrollLedgerTotal: money(unexplainedPayrollLedgerTotal),
        payrollExpectedCostTotal: money(payrollExpectedCostTotal),
        salaryInvoicesTotal: money(salaryInvoicesTotal),
        structuredAdvanceSettlementsTotal: money(structuredAdvanceSettlementsTotal),
        legacyAdvanceSettlementLedgerTotal: money(legacyAdvanceSettlementLedgerTotal),
        documentedHistoricalRepairTotal: money(documentedHistoricalRepairTotal),
        ledgerPayrollCostTotal: money(ledgerPayrollCostTotal),
        difference: money(difference),
        confidence,
        reviewStatus: matched ? 'matched' as const : 'needs_review' as const,
        ...(includeRows ? { rows } : {}),
      };
    });

    return { companyId, year, months };
  }
}
