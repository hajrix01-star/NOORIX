/**
 * Reporting classes written with each financial ledger entry.
 * They are the source for the parallel ledger projection; document correction
 * remains a separate audited workflow until outflow edits become append-only.
 */
export const LEDGER_REPORTING_CLASSES = [
  'operating_revenue',
  'operating_purchase',
  'operating_recurring_expense',
  'operating_other_expense',
  'operating_payroll',
  'non_operating_advance',
  'non_operating_payroll_payment',
  'non_operating_loan',
  'internal_transfer',
  'tax_collected',
  'unclassified',
] as const;

export type LedgerReportingClass = (typeof LEDGER_REPORTING_CLASSES)[number];

export function reportingClassForOutflowKind(kind: string): LedgerReportingClass {
  switch (kind) {
    case 'purchase': return 'operating_purchase';
    case 'fixed_expense': return 'operating_recurring_expense';
    case 'salary': return 'operating_payroll';
    case 'advance': return 'non_operating_advance';
    case 'payroll_payment': return 'non_operating_payroll_payment';
    case 'expense':
    case 'hr_expense': return 'operating_other_expense';
    default: return 'unclassified';
  }
}

/** Classifies an HR service without coupling the financial core to the HR module. */
export function reportingClassForHrServiceCategory(category: string | null | undefined): LedgerReportingClass {
  return ['iqama_renewal', 'medical_insurance', 'health_certificate'].includes(category ?? '')
    ? 'operating_recurring_expense'
    : 'operating_other_expense';
}

/** Safe fallback for pre-classification backup snapshots. */
export function reportingClassForHistoricalLedgerEntry(
  referenceType: string,
  options: {
    invoiceKind?: string | null;
    creditAccountCode?: string | null;
    hrServiceCategory?: string | null;
  } = {},
): LedgerReportingClass {
  const creditCode = options.creditAccountCode?.toUpperCase() ?? '';
  if (referenceType === 'sale') {
    return /^TAX(?:-|$)/.test(creditCode) ? 'tax_collected' : 'operating_revenue';
  }
  if (referenceType === 'invoice' && options.hrServiceCategory) {
    return reportingClassForHrServiceCategory(options.hrServiceCategory);
  }
  if (referenceType === 'invoice' && options.invoiceKind) {
    return reportingClassForOutflowKind(options.invoiceKind);
  }
  return reportingClassForReferenceType(referenceType);
}

export function reportingClassForReferenceType(
  referenceType: string,
  options: { isVat?: boolean } = {},
): LedgerReportingClass {
  if (options.isVat) return 'tax_collected';
  switch (referenceType) {
    case 'sale': return 'operating_revenue';
    case 'salary':
    case 'advance_settlement': return 'operating_payroll';
    case 'payroll_accrual': return 'operating_payroll';
    case 'payroll_payment': return 'non_operating_payroll_payment';
    case 'advance': return 'non_operating_advance';
    case 'loan_opening':
    case 'loan_payment':
    case 'loan_payment_reversal': return 'non_operating_loan';
    case 'transfer': return 'internal_transfer';
    default: return 'unclassified';
  }
}
