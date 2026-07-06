const EMPTY_EXECUTIVE_VALUE = '\u2014';

export type InvoiceExecutiveNumber = number | string | null | undefined;

export type InvoiceExecutiveTotals = {
  total?: InvoiceExecutiveNumber;
  count?: InvoiceExecutiveNumber;
  net?: InvoiceExecutiveNumber;
  tax?: InvoiceExecutiveNumber;
};

export type InvoiceExecutiveOutflowSummary = {
  purchasesTotal?: InvoiceExecutiveNumber;
  expensesTotal?: InvoiceExecutiveNumber;
};

export type InvoiceExecutiveVaultFlowRow = {
  vaultId?: string | null;
  total?: InvoiceExecutiveNumber;
  outflow?: InvoiceExecutiveNumber;
  remainder?: InvoiceExecutiveNumber;
};

export type InvoiceExecutiveVaultFlowViewRow = {
  key: string;
  label: string;
  inflow: number;
  outflow: number;
  remainder: number;
  remainderToneClass: string;
};

export function asInvoiceExecutiveNumber(value: InvoiceExecutiveNumber) {
  return Number(value ?? 0);
}

export function asInvoiceExecutiveCount(value: InvoiceExecutiveNumber) {
  return value ?? 0;
}

export function getInvoiceExecutiveEmptyValue() {
  return EMPTY_EXECUTIVE_VALUE;
}

export function getInvoiceExecutiveRemainderToneClass(remainder: number) {
  if (remainder > 0) return 'text-nx-profit';
  if (remainder < 0) return 'text-nx-expenses';
  return 'text-noorix-muted';
}

export function mapInvoiceExecutiveVaultRows(input: {
  rows?: InvoiceExecutiveVaultFlowRow[] | null;
  labelForRow: (row: InvoiceExecutiveVaultFlowRow) => string;
}) {
  return (input.rows ?? []).map<InvoiceExecutiveVaultFlowViewRow>((row, index) => {
    const remainder = asInvoiceExecutiveNumber(row.remainder);
    return {
      key: row.vaultId || `vault-flow-${index}`,
      label: input.labelForRow(row) || EMPTY_EXECUTIVE_VALUE,
      inflow: asInvoiceExecutiveNumber(row.total),
      outflow: asInvoiceExecutiveNumber(row.outflow),
      remainder,
      remainderToneClass: getInvoiceExecutiveRemainderToneClass(remainder),
    };
  });
}
