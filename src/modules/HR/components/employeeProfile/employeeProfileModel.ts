import { toYmd } from '../../../../utils/saudiDate';
import type { HrCompensationSnapshot } from '../../../../types/api';
import { getAdvanceBalanceParts } from '../../utils/advanceBalance';
import { hrFmt } from '../../utils/hrFmt';

export const TYPE_MAP = { annual: 'leaveAnnual', sick: 'leaveSick', unpaid: 'leaveUnpaid', other: 'leaveOther' };

type TranslationFn = (key: string, ...args: unknown[]) => string;
type MoneyLike = string | number | null | undefined;

export type ProfileRecord = {
  id?: string | null;
  invoiceId?: string | null;
  kind?: string | null;
  status?: string | null;
  movementType?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  [key: string]: unknown;
};

export type CareerMovementRecord = ProfileRecord & {
  previousValue?: MoneyLike;
  newValue?: MoneyLike;
  amount?: MoneyLike;
  effectiveDate?: string | null;
  notes?: string | null;
};

export type CareerTableRow = {
  id?: string;
  movementType?: string | null;
  effectiveDate?: string | null;
  typeLabel: string;
  changeSummary: string;
  notes: string;
};

type FinancialInvoiceRecord = ProfileRecord & {
  transactionDate?: string | Date | null;
  notes?: string | null;
  totalAmount?: MoneyLike;
  netAmount?: MoneyLike;
  settledAt?: string | null;
};

type DeductionRecord = ProfileRecord & {
  transactionDate?: string | Date | null;
  amount?: MoneyLike;
  notes?: string | null;
  deductionType?: string | null;
};

type ResidencyRecord = {
  id?: string | null;
  invoiceId?: string | null;
};

type FinancialRecordsSource = {
  items?: FinancialInvoiceRecord[];
};

type SalaryRowsSnapshot = Pick<HrCompensationSnapshot, 'salaryPackage' | 'customAllowances'>;

export type SalaryRow = {
  label: string;
  amount: number;
  strong?: boolean;
  total?: boolean;
};

export type FinancialRecordRow = {
  id?: string | null;
  date: string;
  type: string;
  typeLabel: string;
  amount: number;
  notes: string;
  source: 'invoice' | 'deduction';
  kind?: string | null;
  status?: string | null;
  settledAt?: string | null;
  deductionType?: string | null;
  residencyId?: string | null;
};

export type PayrollProfileItem = ProfileRecord & {
  grossSalary?: MoneyLike;
  deductions?: MoneyLike;
  advancesDeduct?: MoneyLike;
  netSalary?: MoneyLike;
  notes?: string | null;
  payrollRun?: {
    runNumber?: string | number | null;
    payrollMonth?: string | Date | null;
    status?: string | null;
    issuedSalaryInvoiceNumber?: string | number | null;
  } | null;
};

export type AdvanceProfileRow = ProfileRecord & {
  totalAmount?: MoneyLike;
  totalAmountNum?: number;
  transactionDate?: string | Date | null;
  settledAmount?: MoneyLike;
  settledAmountNum?: number;
  remainingAmount?: number;
  installmentCount?: number;
  installmentAmount?: MoneyLike;
  settlementStatus?: string | null;
  notes?: string | null;
};

export type EmployeeProfileSummary = {
  totalSalary: number;
  activeAdvances: number;
  pendingAdvanceAmount: number;
  payrollRuns: number;
  openLeaves: number;
  services: number;
  documents: number;
  careerMovements: number;
};

export function getInitials(name: unknown) {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] || '') + (parts[1][0] || '');
  return (parts[0] || '').slice(0, 2) || '?';
}

export function buildCareerTableRows(movements: CareerMovementRecord[], t: TranslationFn) {
  const labelFor = (mt: unknown) => {
    if (mt === 'promotion') return t('movementTypePromotion');
    if (mt === 'raise') return t('movementTypeRaise');
    return t('movementTypeOther');
  };
  return movements.map((m): CareerTableRow => {
    let changeSummary = '-';
    if (m.movementType === 'promotion') {
      const previousValue = m.previousValue || '-';
      const newValue = m.newValue || '-';
      changeSummary = `${previousValue} -> ${newValue}`;
    } else if (m.movementType === 'raise') {
      const previousValue =
        m.previousValue != null && String(m.previousValue).trim() !== ''
          ? hrFmt(Number(m.previousValue))
          : '-';
      const newValue =
        m.newValue != null && String(m.newValue).trim() !== ''
          ? hrFmt(Number(m.newValue))
          : '-';
      const increase = m.amount != null && Number(m.amount) > 0 ? ` (+${hrFmt(Number(m.amount))})` : '';
      changeSummary = `${previousValue} -> ${newValue}${increase}`;
    } else {
      const parts = [m.previousValue, m.newValue].filter(Boolean);
      changeSummary =
        parts.length > 0
          ? parts.join(' -> ')
          : m.amount != null
            ? hrFmt(Number(m.amount))
            : '-';
    }
    return {
      id: m.id ? String(m.id) : undefined,
      movementType: m.movementType,
      effectiveDate: m.effectiveDate,
      typeLabel: labelFor(m.movementType),
      changeSummary,
      notes: m.notes || '-',
    };
  });
}

export function buildFinancialRecords(
  hrInvoicesData: FinancialRecordsSource | null | undefined,
  deductions: DeductionRecord[] = [],
  t: TranslationFn,
  residencies: ResidencyRecord[] = [],
) {
  const records: FinancialRecordRow[] = [];
  const residencyByInvoiceId = new Map(
    (residencies || [])
      .filter((residency) => residency.invoiceId)
      .map((residency) => [residency.invoiceId, residency.id]),
  );
  const hrInvoices = (hrInvoicesData?.items ?? []).filter((invoice) => invoice.status !== 'cancelled');
  for (const invoice of hrInvoices) {
    const date = toYmd(invoice.transactionDate);
    let type = 'opAdvance';
    let typeLabel = t('opAdvance');
    if (invoice.kind === 'salary') {
      type = 'opSalary';
      typeLabel = t('opSalary');
    } else if (invoice.kind === 'hr_expense') {
      type = 'invoiceKindHrExpense';
      typeLabel = t('invoiceKindHrExpense');
    }
    let notes = invoice.notes || '';
    const advanceBalance = invoice.kind === 'advance' ? getAdvanceBalanceParts(invoice) : null;
    if (invoice.kind === 'advance' && invoice.settledAt) {
      notes = (notes ? `${notes} - ` : '') + (t('advanceSettled') || 'Settled');
    }
    records.push({
      id: invoice.id,
      date,
      type,
      typeLabel,
      amount: advanceBalance ? advanceBalance.remainingAmount : Number(invoice.totalAmount ?? invoice.netAmount ?? 0),
      notes,
      source: 'invoice',
      kind: invoice.kind,
      status: advanceBalance?.settlementStatus ?? invoice.status,
      settledAt: invoice.settledAt,
      residencyId: invoice.kind === 'hr_expense' ? residencyByInvoiceId.get(invoice.id) : undefined,
    });
  }
  for (const deduction of deductions) {
    const date = toYmd(deduction.transactionDate);
    records.push({
      id: deduction.id,
      date,
      type: 'payrollDeductions',
      typeLabel: t('payrollDeductions'),
      amount: -Number(deduction.amount ?? 0),
      notes: deduction.notes || '',
      source: 'deduction',
      deductionType: deduction.deductionType,
    });
  }
  records.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return records;
}

export function buildSalaryRows(compensationSnapshot: SalaryRowsSnapshot | null | undefined, t: TranslationFn) {
  const breakdown = compensationSnapshot?.salaryPackage;
  if (!breakdown) return [];
  const rows: SalaryRow[] = [{ label: t('basicSalary'), amount: breakdown.basicSalary, strong: true }];
  if (breakdown.housingAllowance > 0) rows.push({ label: t('housingAllowance'), amount: breakdown.housingAllowance });
  if (breakdown.transportAllowance > 0) rows.push({ label: t('transportAllowance'), amount: breakdown.transportAllowance });
  if (breakdown.otherAllowance > 0) rows.push({ label: t('otherAllowance'), amount: breakdown.otherAllowance });
  for (const allowance of compensationSnapshot?.customAllowances?.items ?? []) {
    rows.push({ label: allowance.nameAr || t('customAllowanceName'), amount: Number(allowance.amount ?? 0) });
  }
  if (breakdown.overtimePay > 0) {
    rows.push({
      label:
        breakdown.overtimeHoursPerDay > 0
          ? `${t('salaryCalcOvertimePay')} (${hrFmt(breakdown.overtimeHoursPerDay)} h/day)`
          : t('salaryCalcOvertimePay'),
      amount: breakdown.overtimePay,
    });
  }
  rows.push({ label: t('totalSalary'), amount: breakdown.total, total: true });
  return rows;
}

export function buildEmployeeProfileSummary({
  compensationSnapshot,
  advances,
  payrollItems,
  leaves,
  residencies,
  documents,
  careerTableRows,
}: {
  compensationSnapshot: SalaryRowsSnapshot;
  advances: AdvanceProfileRow[];
  payrollItems: PayrollProfileItem[];
  leaves: ProfileRecord[];
  residencies: ProfileRecord[];
  documents: ProfileRecord[];
  careerTableRows: CareerTableRow[];
}): EmployeeProfileSummary {
  const pendingAdvanceAmount = advances.reduce(
    (sum, advance) => sum + Math.max(0, Number(advance.remainingAmount ?? 0)),
    0,
  );
  return {
    totalSalary: compensationSnapshot.salaryPackage.total,
    activeAdvances: advances.filter((advance) => Number(advance.remainingAmount ?? 0) > 0).length,
    pendingAdvanceAmount,
    payrollRuns: payrollItems.length,
    openLeaves: leaves.filter((leave) => !['rejected', 'cancelled'].includes(String(leave.status ?? '').toLowerCase())).length,
    services: residencies.length,
    documents: documents.length,
    careerMovements: careerTableRows.length,
  };
}
