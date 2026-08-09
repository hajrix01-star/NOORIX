import { formatSaudiDate, toYmd } from '../../../utils/saudiDate';
import { buildPrintHtmlTable } from '../../../utils/printTableHtml';
import { hrFmt } from '../utils/hrFmt';
import { computePayrollRunTotals } from '../utils/hrCalculations/payroll';

export type PayrollRunSource = {
  id: string;
  runNumber?: string | null;
  payrollMonth?: string | null;
  totalAmount?: number | string | null;
  payableAmount?: number | string | null;
  status?: string | null;
  kind?: string | null;
  issuedSalaryInvoiceNumber?: string | null;
  items?: Array<Record<string, unknown>>;
};

export type PayrollRunRow = {
  id: string;
  runNumber: string;
  month: string | null;
  monthRaw: string | null;
  grossTotal: number;
  netTotal: number;
  status: string;
  kind: string;
  issuedInvoiceNumber: string | null;
  itemsCount: number;
};

export type PayrollStatusMutation = {
  id: string;
  status: string;
};

export type PayrollVaultSplit = {
  vaultId: string;
  amount?: number;
};

export type PayrollIssuePaymentMutation = {
  id: string;
  transactionDate?: string;
  vaultSplits?: PayrollVaultSplit[];
};

export type PayrollPayModalRun = Pick<PayrollRunRow, 'id' | 'runNumber' | 'month' | 'netTotal'>;

type Translate = (key: string) => string;

export function lastDayOfPayrollMonth(monthRaw: unknown): string | null {
  if (!monthRaw) return null;
  const s = toYmd(monthRaw);
  const [y, m] = s.split('-').map((x) => parseInt(x, 10));
  if (!y || !m || m < 1 || m > 12) return null;
  const last = new Date(Date.UTC(y, m, 0));
  const dd = String(last.getUTCDate()).padStart(2, '0');
  const mm2 = String(last.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${mm2}-${dd}`;
}

export function toPayrollRunRow(run: PayrollRunSource): PayrollRunRow {
  const grossTotal = Array.isArray(run.items)
    ? computePayrollRunTotals(run.items).grossSalary
    : Number(run.totalAmount ?? 0);

  return {
    id: run.id,
    runNumber: String(run.runNumber ?? ''),
    month: run.payrollMonth ? formatSaudiDate(run.payrollMonth) : null,
    monthRaw: run.payrollMonth ?? null,
    grossTotal,
    netTotal: Number(run.payableAmount ?? run.totalAmount ?? 0),
    status: String(run.status ?? ''),
    kind: String(run.kind ?? 'regular'),
    issuedInvoiceNumber: run.issuedSalaryInvoiceNumber ?? null,
    itemsCount: run.items?.length ?? 0,
  };
}

export function payrollRunExportStatusLabel(
  row: PayrollRunRow,
  payrollStatusMap: Record<string, { label?: string }>,
  t: Translate,
): string {
  const st = String(row?.status || '').toLowerCase();
  if (st === 'completed' && row?.issuedInvoiceNumber) return t('payrollPaid');
  if (st === 'completed') return t('payrollApproved');
  return payrollStatusMap[row.status]?.label ?? row.status ?? '';
}

export function buildPayrollRunExportRows(
  rows: PayrollRunRow[],
  payrollStatusMap: Record<string, { label?: string }>,
  t: Translate,
) {
  return rows.map((row) => ({
    runNumber: row.runNumber,
    month: row.month,
    grossTotal: hrFmt(row.grossTotal),
    netTotal: hrFmt(row.netTotal),
    status: payrollRunExportStatusLabel(row, payrollStatusMap, t),
    issuedInvoiceNumber: row.issuedInvoiceNumber || '-',
  }));
}

export function buildPayrollRunPrintTable(
  rows: PayrollRunRow[],
  payrollStatusMap: Record<string, { label?: string }>,
  t: Translate,
): string {
  return buildPrintHtmlTable({
    wrapperClassName: null,
    emptyMessage: t('noDataInPeriod'),
    emptyColSpan: 6,
    headerRows: [{
      cells: [
        { value: t('payrollRunNumber') },
        { value: t('payrollMonth') },
        { value: t('payrollGross'), align: 'end' },
        { value: t('payrollNet'), align: 'end' },
        { value: t('payrollStatus') },
        { value: t('payrollIssuedInvoiceNumber') },
      ],
    }],
    bodyRows: rows.map((row) => ({
      cells: [
        { value: row.runNumber },
        { value: row.month },
        { value: hrFmt(row.grossTotal), align: 'end' },
        { value: hrFmt(row.netTotal), align: 'end' },
        { value: payrollRunExportStatusLabel(row, payrollStatusMap, t) },
        { value: row.issuedInvoiceNumber },
      ],
    })),
  });
}
