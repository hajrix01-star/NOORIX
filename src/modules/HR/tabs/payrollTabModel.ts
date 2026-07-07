import { formatSaudiDate, toYmd } from '../../../utils/saudiDate';
import { hrFmt } from '../utils/hrFmt';
import { computePayrollRunTotals } from '../utils/hrCalculations/payroll';

export type PayrollRunSource = {
  id: string;
  runNumber?: string | null;
  payrollMonth?: string | null;
  totalAmount?: number | string | null;
  status?: string | null;
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
    netTotal: Number(run.totalAmount ?? 0),
    status: String(run.status ?? ''),
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

function htmlCell(value: unknown): string {
  return String(value ?? '-').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function buildPayrollRunPrintTable(
  rows: PayrollRunRow[],
  payrollStatusMap: Record<string, { label?: string }>,
  t: Translate,
): string {
  const bodyRows = rows
    .map((row) =>
      `<tr><td>${htmlCell(row.runNumber)}</td><td>${htmlCell(row.month)}</td><td>${htmlCell(hrFmt(row.grossTotal))}</td><td>${htmlCell(hrFmt(row.netTotal))}</td><td>${htmlCell(payrollRunExportStatusLabel(row, payrollStatusMap, t))}</td><td>${htmlCell(row.issuedInvoiceNumber)}</td></tr>`,
    )
    .join('');

  return `<table><thead><tr><th>${htmlCell(t('payrollRunNumber'))}</th><th>${htmlCell(t('payrollMonth'))}</th><th>${htmlCell(t('payrollGross'))}</th><th>${htmlCell(t('payrollNet'))}</th><th>${htmlCell(t('payrollStatus'))}</th><th>${htmlCell(t('payrollIssuedInvoiceNumber'))}</th></tr></thead><tbody>${bodyRows || `<tr><td colspan="6">${htmlCell(t('noDataInPeriod'))}</td></tr>`}</tbody></table>`;
}
