export type PayrollReconciliationConfidence = 'high' | 'medium' | 'low' | 'unknown';
export type PayrollReconciliationReviewStatus = 'matched' | 'needs_review' | 'reviewed' | 'unknown';

export type PayrollReconciliationRow = {
  id: string;
  date: string | null;
  employeeName: string;
  runNumber: string;
  advanceInvoiceNumber: string;
  amount: number;
  source: string;
  status: string;
  confidence: PayrollReconciliationConfidence;
  reason: string;
};

export type PayrollReconciliationMonth = {
  month: string;
  payrollRunsTotal: number;
  standaloneSalaryPaymentsTotal: number;
  unexplainedPayrollLedgerTotal: number;
  payrollExpectedCostTotal: number;
  salaryInvoicesTotal: number;
  structuredAdvanceSettlementsTotal: number;
  documentedHistoricalRepairTotal: number;
  legacyAdvanceSettlementLedgerTotal: number;
  advanceSettlementsTotal: number;
  ledgerPayrollCostTotal: number;
  difference: number;
  confidence: PayrollReconciliationConfidence;
  reviewStatus: PayrollReconciliationReviewStatus;
  rows: PayrollReconciliationRow[];
};

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : {};
}

function asNumber(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function asText(value: unknown): string {
  return value == null ? '' : String(value).trim();
}

function normalizeConfidence(value: unknown): PayrollReconciliationConfidence {
  const normalized = asText(value).toLowerCase();
  if (normalized === 'high' || normalized === 'medium' || normalized === 'low') return normalized;
  return 'unknown';
}

function normalizeReviewStatus(value: unknown, difference: number): PayrollReconciliationReviewStatus {
  const normalized = asText(value).toLowerCase().replaceAll('-', '_');
  if (normalized === 'matched' || normalized === 'needs_review' || normalized === 'reviewed') return normalized;
  return Math.abs(difference) < 0.005 ? 'matched' : 'needs_review';
}

function normalizeRow(value: unknown, index: number): PayrollReconciliationRow {
  const row = asRecord(value);
  return {
    id: asText(row.id || row.ledgerEntryId || row.deductionId) || `reconciliation-row-${index}`,
    date: asText(row.date) || null,
    employeeName: asText(row.employeeName) || '—',
    runNumber: asText(row.runNumber) || '—',
    advanceInvoiceNumber: asText(row.advanceInvoiceNumber) || '—',
    amount: asNumber(row.amount),
    source: asText(row.source),
    status: asText(row.status),
    confidence: normalizeConfidence(row.confidence),
    reason: asText(row.reason),
  };
}

function normalizeMonth(value: unknown): PayrollReconciliationMonth | null {
  const row = asRecord(value);
  const month = asText(row.month || row.payrollMonth);
  if (!month) return null;

  const structuredAdvanceSettlementsTotal = asNumber(
    row.structuredAdvanceSettlementsTotal ?? row.advanceSettlementsTotal ?? row.settlementsTotal,
  );
  const legacyAdvanceSettlementLedgerTotal = asNumber(
    row.legacyAdvanceSettlementLedgerTotal ?? row.legacySettlementsTotal,
  );
  const documentedHistoricalRepairTotal = asNumber(
    row.documentedHistoricalRepairTotal
      ?? row.linkedHistoricalSettlementLedgerTotal
      ?? row.historicalRepairTotal,
  );
  const salaryInvoicesTotal = asNumber(row.salaryInvoicesTotal ?? row.invoiceTotal);
  const standaloneSalaryPaymentsTotal = asNumber(row.standaloneSalaryPaymentsTotal);
  const unexplainedPayrollLedgerTotal = asNumber(row.unexplainedPayrollLedgerTotal);
  const ledgerPayrollCostTotal = asNumber(row.ledgerPayrollCostTotal ?? row.ledgerCostTotal);
  const payrollRunsTotal = asNumber(row.payrollRunsTotal ?? row.runTotal);
  const payrollExpectedCostTotal = asNumber(row.payrollExpectedCostTotal ?? (payrollRunsTotal + standaloneSalaryPaymentsTotal));
  const suppliedDifference = row.difference;
  const difference = suppliedDifference == null
    ? ledgerPayrollCostTotal - payrollExpectedCostTotal
    : asNumber(suppliedDifference);
  const rawRows = Array.isArray(row.rows) ? row.rows : [];

  return {
    month,
    payrollRunsTotal,
    standaloneSalaryPaymentsTotal,
    unexplainedPayrollLedgerTotal,
    payrollExpectedCostTotal,
    salaryInvoicesTotal,
    structuredAdvanceSettlementsTotal,
    documentedHistoricalRepairTotal,
    legacyAdvanceSettlementLedgerTotal,
    advanceSettlementsTotal:
      structuredAdvanceSettlementsTotal + documentedHistoricalRepairTotal + legacyAdvanceSettlementLedgerTotal,
    ledgerPayrollCostTotal,
    difference,
    confidence: normalizeConfidence(row.confidence),
    reviewStatus: normalizeReviewStatus(row.reviewStatus, difference),
    rows: rawRows.map(normalizeRow),
  };
}

export function normalizePayrollReconciliationResponse(value: unknown): PayrollReconciliationMonth[] {
  const envelope = asRecord(value);
  const nestedData = asRecord(envelope.data);
  const rows = Array.isArray(value)
    ? value
    : Array.isArray(envelope.months)
      ? envelope.months
      : Array.isArray(envelope.rows)
        ? envelope.rows
        : Array.isArray(nestedData.months)
          ? nestedData.months
          : Array.isArray(nestedData.rows)
            ? nestedData.rows
            : [];

  return rows
    .map(normalizeMonth)
    .filter((month): month is PayrollReconciliationMonth => month !== null)
    .sort((a, b) => b.month.localeCompare(a.month));
}
