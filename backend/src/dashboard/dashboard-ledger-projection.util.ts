import Decimal from 'decimal.js';

export type DashboardLedgerReportingClass =
  | 'operating_revenue' | 'operating_purchase' | 'operating_recurring_expense'
  | 'operating_other_expense' | 'operating_payroll' | 'non_operating_advance'
  | 'non_operating_loan' | 'internal_transfer' | 'tax_collected' | 'unclassified';

export type DashboardLedgerProjectionRow = {
  amount: string | number;
  reportingClass: string | null;
  referenceType: string;
  debitType: string;
  debitCode: string;
  creditType: string;
  creditCode: string;
};

export type DashboardLedgerProjectionClass = DashboardLedgerReportingClass | 'fallback_derived';
type ProjectionBucket = 'sales' | 'purchases' | 'recurringExpenses' | 'otherExpenses' | 'payroll' | 'excludedNonOperating' | 'taxCollected' | 'unclassified';

export type DashboardLedgerProjection = {
  source: 'ledger_parallel_reporting_class_v1';
  sales: string;
  purchases: string;
  recurringExpenses: string;
  otherExpenses: string;
  payroll: string;
  operatingCosts: string;
  operatingResult: string;
  excludedNonOperating: string;
  taxCollected: string;
  unclassified: string;
  coverage: {
    persistedClassifiedAmount: string;
    fallbackClassifiedAmount: string;
    totalAmount: string;
    classifiedPct: number | null;
    rowCount: number;
    persistedClassifiedRowCount: number;
    fallbackClassifiedRowCount: number;
    unclassifiedRowCount: number;
  };
  reportingClassCounts: Record<DashboardLedgerProjectionClass, number>;
};

const PERSISTED_CLASSES = new Set<DashboardLedgerReportingClass>([
  'operating_revenue', 'operating_purchase', 'operating_recurring_expense',
  'operating_other_expense', 'operating_payroll', 'non_operating_advance',
  'non_operating_loan', 'internal_transfer', 'tax_collected',
]);

function fixed(value: Decimal): string { return value.toFixed(4); }

function bucketForReportingClass(value: DashboardLedgerReportingClass): ProjectionBucket {
  switch (value) {
    case 'operating_revenue': return 'sales';
    case 'operating_purchase': return 'purchases';
    case 'operating_recurring_expense': return 'recurringExpenses';
    case 'operating_other_expense': return 'otherExpenses';
    case 'operating_payroll': return 'payroll';
    case 'non_operating_advance':
    case 'non_operating_loan':
    case 'internal_transfer': return 'excludedNonOperating';
    case 'tax_collected': return 'taxCollected';
    case 'unclassified': return 'unclassified';
  }
}

/** Temporary historical fallback, using ledger metadata only. */
export function fallbackReportingClassForLedgerRow(row: DashboardLedgerProjectionRow): DashboardLedgerReportingClass {
  switch (row.referenceType) {
    case 'sale': return 'operating_revenue';
    case 'salary':
    case 'advance_settlement': return 'operating_payroll';
    case 'advance': return 'non_operating_advance';
    case 'loan_opening':
    case 'loan_payment':
    case 'loan_payment_reversal': return 'non_operating_loan';
    case 'transfer': return 'internal_transfer';
    default:
      if (row.creditType === 'revenue') return 'operating_revenue';
      if (row.debitType !== 'expense') return 'unclassified';
      if (row.debitCode.startsWith('PUR')) return 'operating_purchase';
      if (row.debitCode === 'EXP-003') return 'operating_recurring_expense';
      if (row.debitCode === 'EXP-004') return 'operating_payroll';
      if (/^EXP-00[2-8]$/.test(row.debitCode)) return 'operating_other_expense';
      return 'unclassified';
  }
}

export function buildDashboardLedgerProjection(rows: readonly DashboardLedgerProjectionRow[]): DashboardLedgerProjection {
  const zero = () => new Decimal(0);
  const totals: Record<ProjectionBucket, Decimal> = {
    sales: zero(), purchases: zero(), recurringExpenses: zero(), otherExpenses: zero(),
    payroll: zero(), excludedNonOperating: zero(), taxCollected: zero(), unclassified: zero(),
  };
  const reportingClassCounts: Record<DashboardLedgerProjectionClass, number> = {
    operating_revenue: 0, operating_purchase: 0, operating_recurring_expense: 0,
    operating_other_expense: 0, operating_payroll: 0, non_operating_advance: 0,
    non_operating_loan: 0, internal_transfer: 0, tax_collected: 0, unclassified: 0,
    fallback_derived: 0,
  };
  let persistedClassifiedAmount = zero();
  let fallbackClassifiedAmount = zero();
  let persistedClassifiedRowCount = 0;
  let fallbackClassifiedRowCount = 0;

  for (const row of rows) {
    const amount = new Decimal(row.amount ?? 0).abs();
    const persisted = PERSISTED_CLASSES.has(row.reportingClass as DashboardLedgerReportingClass)
      ? row.reportingClass as DashboardLedgerReportingClass
      : null;
    const reportingClass = persisted ?? fallbackReportingClassForLedgerRow(row);
    const bucket = bucketForReportingClass(reportingClass);
    totals[bucket] = totals[bucket].plus(amount);
    if (persisted) {
      reportingClassCounts[persisted] += 1;
      persistedClassifiedAmount = persistedClassifiedAmount.plus(amount);
      persistedClassifiedRowCount += 1;
    } else if (reportingClass !== 'unclassified') {
      reportingClassCounts.fallback_derived += 1;
      fallbackClassifiedAmount = fallbackClassifiedAmount.plus(amount);
      fallbackClassifiedRowCount += 1;
    } else {
      reportingClassCounts.unclassified += 1;
    }
  }

  const operatingCosts = totals.purchases.plus(totals.recurringExpenses).plus(totals.otherExpenses).plus(totals.payroll);
  const totalAmount = Object.values(totals).reduce((sum, amount) => sum.plus(amount), zero());
  const classifiedAmount = persistedClassifiedAmount.plus(fallbackClassifiedAmount);
  const classifiedPct = totalAmount.isZero() ? null : classifiedAmount.div(totalAmount).mul(100).toDecimalPlaces(2).toNumber();

  return {
    source: 'ledger_parallel_reporting_class_v1',
    sales: fixed(totals.sales), purchases: fixed(totals.purchases),
    recurringExpenses: fixed(totals.recurringExpenses), otherExpenses: fixed(totals.otherExpenses), payroll: fixed(totals.payroll),
    operatingCosts: fixed(operatingCosts), operatingResult: fixed(totals.sales.minus(operatingCosts)),
    excludedNonOperating: fixed(totals.excludedNonOperating), taxCollected: fixed(totals.taxCollected), unclassified: fixed(totals.unclassified),
    coverage: {
      persistedClassifiedAmount: fixed(persistedClassifiedAmount), fallbackClassifiedAmount: fixed(fallbackClassifiedAmount), totalAmount: fixed(totalAmount), classifiedPct,
      rowCount: rows.length, persistedClassifiedRowCount, fallbackClassifiedRowCount, unclassifiedRowCount: reportingClassCounts.unclassified,
    },
    reportingClassCounts,
  };
}
