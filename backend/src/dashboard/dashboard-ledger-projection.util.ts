import Decimal from 'decimal.js';

export type DashboardLedgerReportingClass =
  | 'operating_revenue' | 'operating_purchase' | 'operating_recurring_expense'
  | 'operating_other_expense' | 'operating_payroll' | 'non_operating_advance'
  | 'non_operating_loan' | 'internal_transfer' | 'tax_collected' | 'unclassified';

export type DashboardLedgerProjectionRow = {
  amount: string | number;
  reportingClass: string | null;
  referenceType: string;
  referenceId?: string | null;
  transactionDate?: Date | string | null;
  reportingCategoryId?: string | null;
  reportingCategoryNameAr?: string | null;
  reportingCategoryNameEn?: string | null;
  vaultId?: string | null;
  vaultNameAr?: string | null;
  vaultNameEn?: string | null;
  vaultType?: string | null;
  supplierId?: string | null;
  supplierNameAr?: string | null;
  supplierNameEn?: string | null;
  debitType: string;
  debitCode: string;
  creditType: string;
  creditCode: string;
};

export type DashboardLedgerProjectionClass = DashboardLedgerReportingClass | 'fallback_derived';
type ProjectionBucket = 'sales' | 'purchases' | 'recurringExpenses' | 'otherExpenses' | 'payroll' | 'excludedNonOperating' | 'taxCollected' | 'unclassified';
type OperatingCategoryBucket = 'purchases' | 'recurringExpenses' | 'otherExpenses' | 'payroll';

export type DashboardLedgerCategoryBreakdownRow = {
  id: string;
  categoryId: string | null;
  nameAr: string;
  nameEn: string | null;
  amount: string;
  sharePct: number | null;
};

export type DashboardLedgerTimelineRow = {
  periodKey: string;
  sales: string;
  purchases: string;
  expenses: string;
};

/** Monetary amounts are always from LedgerEntry; vault metadata is display-only. */
export type DashboardLedgerSalesChannelRow = {
  periodKey: string;
  vaultId: string;
  nameAr: string;
  nameEn: string | null;
  type: string | null;
  amount: string;
};

/** Monetary amounts are always from LedgerEntry; supplier metadata is display-only. */
export type DashboardLedgerTopSupplierRow = {
  supplierId: string;
  nameAr: string;
  nameEn: string | null;
  amount: string;
  invoiceCount: number;
  sharePct: number | null;
};

export type DashboardLedgerProjection = {
  source: 'classified_ledger_v2';
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
  categories: {
    purchases: DashboardLedgerCategoryBreakdownRow[];
    recurringExpenses: DashboardLedgerCategoryBreakdownRow[];
    otherExpenses: DashboardLedgerCategoryBreakdownRow[];
    payroll: DashboardLedgerCategoryBreakdownRow[];
  };
  timeline: {
    daily: DashboardLedgerTimelineRow[];
    monthly: DashboardLedgerTimelineRow[];
  };
  salesChannels: DashboardLedgerSalesChannelRow[];
  topSuppliers: DashboardLedgerTopSupplierRow[];
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
  reportingClassRecordCounts: Record<DashboardLedgerReportingClass, number>;
};

const PERSISTED_CLASSES = new Set<DashboardLedgerReportingClass>([
  'operating_revenue', 'operating_purchase', 'operating_recurring_expense',
  'operating_other_expense', 'operating_payroll', 'non_operating_advance',
  'non_operating_loan', 'internal_transfer', 'tax_collected',
]);

const OPERATIONAL_CATEGORY_BUCKETS = new Set<OperatingCategoryBucket>([
  'purchases', 'recurringExpenses', 'otherExpenses', 'payroll',
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

/** Historical fallback from ledger metadata only; it never reads invoice totals. */
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

function ymd(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  const match = String(value).match(/^\d{4}-\d{2}-\d{2}/);
  return match?.[0] ?? null;
}

function categoryIdentity(row: DashboardLedgerProjectionRow, bucket: OperatingCategoryBucket) {
  if (bucket === 'payroll') {
    return { id: '__payroll__', categoryId: null, nameAr: 'رواتب وأجور', nameEn: 'Payroll and wages' };
  }
  if (row.reportingCategoryId && row.reportingCategoryNameAr) {
    return {
      id: row.reportingCategoryId,
      categoryId: row.reportingCategoryId,
      nameAr: row.reportingCategoryNameAr,
      nameEn: row.reportingCategoryNameEn ?? null,
    };
  }
  const names = bucket === 'purchases'
    ? ['مشتريات غير مصنفة', 'Unclassified purchases']
    : bucket === 'recurringExpenses'
      ? ['مصاريف دورية غير مصنفة', 'Unclassified recurring expenses']
      : ['مصاريف أخرى غير مصنفة', 'Unclassified other expenses'];
  return { id: `__${bucket}_unassigned__`, categoryId: null, nameAr: names[0], nameEn: names[1] };
}

function finalizeCategories(
  rows: Map<string, { id: string; categoryId: string | null; nameAr: string; nameEn: string | null; amount: Decimal }>,
): DashboardLedgerCategoryBreakdownRow[] {
  const total = [...rows.values()].reduce((sum, row) => sum.plus(row.amount), new Decimal(0));
  return [...rows.values()]
    .sort((a, b) => b.amount.comparedTo(a.amount) || a.nameAr.localeCompare(b.nameAr, 'ar'))
    .map((row) => ({
      id: row.id,
      categoryId: row.categoryId,
      nameAr: row.nameAr,
      nameEn: row.nameEn,
      amount: fixed(row.amount),
      sharePct: total.isZero() ? null : row.amount.div(total).mul(100).toDecimalPlaces(2).toNumber(),
    }));
}

function finalizeTimeline(rows: Map<string, { sales: Decimal; purchases: Decimal; expenses: Decimal }>): DashboardLedgerTimelineRow[] {
  return [...rows.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([periodKey, row]) => ({
      periodKey,
      sales: fixed(row.sales),
      purchases: fixed(row.purchases),
      expenses: fixed(row.expenses),
    }));
}

function finalizeSalesChannels(
  rows: Map<string, { periodKey: string; vaultId: string; nameAr: string; nameEn: string | null; type: string | null; amount: Decimal }>,
): DashboardLedgerSalesChannelRow[] {
  return [...rows.values()]
    .sort((a, b) => a.periodKey.localeCompare(b.periodKey) || b.amount.comparedTo(a.amount) || a.nameAr.localeCompare(b.nameAr, 'ar'))
    .map((row) => ({ ...row, amount: fixed(row.amount) }));
}

function finalizeTopSuppliers(
  rows: Map<string, { supplierId: string; nameAr: string; nameEn: string | null; amount: Decimal; invoiceRefs: Set<string> }>,
): DashboardLedgerTopSupplierRow[] {
  const total = [...rows.values()].reduce((sum, row) => sum.plus(row.amount), new Decimal(0));
  return [...rows.values()]
    .sort((a, b) => b.amount.comparedTo(a.amount) || a.nameAr.localeCompare(b.nameAr, 'ar'))
    .slice(0, 5)
    .map((row) => ({
      supplierId: row.supplierId,
      nameAr: row.nameAr,
      nameEn: row.nameEn,
      amount: fixed(row.amount),
      invoiceCount: row.invoiceRefs.size,
      sharePct: total.isZero() ? null : row.amount.div(total).mul(100).toDecimalPlaces(2).toNumber(),
    }));
}

export function buildDashboardLedgerProjection(rows: readonly DashboardLedgerProjectionRow[]): DashboardLedgerProjection {
  const zero = () => new Decimal(0);
  const totals: Record<ProjectionBucket, Decimal> = {
    sales: zero(), purchases: zero(), recurringExpenses: zero(), otherExpenses: zero(),
    payroll: zero(), excludedNonOperating: zero(), taxCollected: zero(), unclassified: zero(),
  };
  const categoryTotals: Record<OperatingCategoryBucket, Map<string, { id: string; categoryId: string | null; nameAr: string; nameEn: string | null; amount: Decimal }>> = {
    purchases: new Map(), recurringExpenses: new Map(), otherExpenses: new Map(), payroll: new Map(),
  };
  const daily = new Map<string, { sales: Decimal; purchases: Decimal; expenses: Decimal }>();
  const monthly = new Map<string, { sales: Decimal; purchases: Decimal; expenses: Decimal }>();
  const salesChannels = new Map<string, { periodKey: string; vaultId: string; nameAr: string; nameEn: string | null; type: string | null; amount: Decimal }>();
  const topSuppliers = new Map<string, { supplierId: string; nameAr: string; nameEn: string | null; amount: Decimal; invoiceRefs: Set<string> }>();
  const reportingClassCounts: Record<DashboardLedgerProjectionClass, number> = {
    operating_revenue: 0, operating_purchase: 0, operating_recurring_expense: 0,
    operating_other_expense: 0, operating_payroll: 0, non_operating_advance: 0,
    non_operating_loan: 0, internal_transfer: 0, tax_collected: 0, unclassified: 0,
    fallback_derived: 0,
  };
  const reportingClassRecordSets = new Map<DashboardLedgerReportingClass, Set<string>>();
  let persistedClassifiedAmount = zero();
  let fallbackClassifiedAmount = zero();
  let persistedClassifiedRowCount = 0;
  let fallbackClassifiedRowCount = 0;

  const addTimeline = (target: Map<string, { sales: Decimal; purchases: Decimal; expenses: Decimal }>, key: string, bucket: ProjectionBucket, amount: Decimal) => {
    const current = target.get(key) ?? { sales: zero(), purchases: zero(), expenses: zero() };
    if (bucket === 'sales' || bucket === 'taxCollected') current.sales = current.sales.plus(amount);
    if (bucket === 'purchases') current.purchases = current.purchases.plus(amount);
    if (bucket === 'recurringExpenses' || bucket === 'otherExpenses' || bucket === 'payroll') current.expenses = current.expenses.plus(amount);
    target.set(key, current);
  };

  rows.forEach((row, index) => {
    const amount = new Decimal(row.amount ?? 0).abs();
    const persisted = PERSISTED_CLASSES.has(row.reportingClass as DashboardLedgerReportingClass)
      ? row.reportingClass as DashboardLedgerReportingClass
      : null;
    const reportingClass = persisted ?? fallbackReportingClassForLedgerRow(row);
    const bucket = bucketForReportingClass(reportingClass);
    totals[bucket] = totals[bucket].plus(amount);
    const recordKey = `${row.referenceType}:${row.referenceId ?? index}`;
    const recordSet = reportingClassRecordSets.get(reportingClass) ?? new Set<string>();
    recordSet.add(recordKey);
    reportingClassRecordSets.set(reportingClass, recordSet);

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

    if (OPERATIONAL_CATEGORY_BUCKETS.has(bucket as OperatingCategoryBucket)) {
      const operatingBucket = bucket as OperatingCategoryBucket;
      const identity = categoryIdentity(row, operatingBucket);
      const current = categoryTotals[operatingBucket].get(identity.id);
      categoryTotals[operatingBucket].set(identity.id, {
        ...identity,
        amount: (current?.amount ?? zero()).plus(amount),
      });
    }

    const date = ymd(row.transactionDate);
    if (date) {
      addTimeline(daily, date, bucket, amount);
      addTimeline(monthly, date.slice(0, 7), bucket, amount);
      if ((bucket === 'sales' || bucket === 'taxCollected') && row.vaultId) {
        const periodKey = date.slice(0, 7);
        const key = `${periodKey}:${row.vaultId}`;
        const current = salesChannels.get(key);
        salesChannels.set(key, {
          periodKey,
          vaultId: row.vaultId,
          nameAr: row.vaultNameAr || row.vaultNameEn || row.vaultId,
          nameEn: row.vaultNameEn ?? null,
          type: row.vaultType ?? null,
          amount: (current?.amount ?? zero()).plus(amount),
        });
      }
    }

    if ((bucket === 'purchases' || bucket === 'recurringExpenses' || bucket === 'otherExpenses') && row.supplierId) {
      const current = topSuppliers.get(row.supplierId);
      topSuppliers.set(row.supplierId, {
        supplierId: row.supplierId,
        nameAr: row.supplierNameAr || row.supplierNameEn || row.supplierId,
        nameEn: row.supplierNameEn ?? null,
        amount: (current?.amount ?? zero()).plus(amount),
        invoiceRefs: new Set([...(current?.invoiceRefs ?? []), row.referenceId ?? String(index)]),
      });
    }
  });

  const operatingCosts = totals.purchases.plus(totals.recurringExpenses).plus(totals.otherExpenses).plus(totals.payroll);
  const grossSales = totals.sales.plus(totals.taxCollected);
  const totalAmount = Object.values(totals).reduce((sum, amount) => sum.plus(amount), zero());
  const classifiedAmount = persistedClassifiedAmount.plus(fallbackClassifiedAmount);
  const classifiedPct = totalAmount.isZero() ? null : classifiedAmount.div(totalAmount).mul(100).toDecimalPlaces(2).toNumber();
  const reportingClassRecordCounts = Object.fromEntries(
    (['operating_revenue', 'operating_purchase', 'operating_recurring_expense', 'operating_other_expense', 'operating_payroll', 'non_operating_advance', 'non_operating_loan', 'internal_transfer', 'tax_collected', 'unclassified'] as DashboardLedgerReportingClass[])
      .map((key) => [key, reportingClassRecordSets.get(key)?.size ?? 0]),
  ) as Record<DashboardLedgerReportingClass, number>;

  return {
    source: 'classified_ledger_v2',
    sales: fixed(totals.sales), purchases: fixed(totals.purchases),
    recurringExpenses: fixed(totals.recurringExpenses), otherExpenses: fixed(totals.otherExpenses), payroll: fixed(totals.payroll),
    operatingCosts: fixed(operatingCosts), operatingResult: fixed(grossSales.minus(operatingCosts)),
    excludedNonOperating: fixed(totals.excludedNonOperating), taxCollected: fixed(totals.taxCollected), unclassified: fixed(totals.unclassified),
    categories: {
      purchases: finalizeCategories(categoryTotals.purchases),
      recurringExpenses: finalizeCategories(categoryTotals.recurringExpenses),
      otherExpenses: finalizeCategories(categoryTotals.otherExpenses),
      payroll: finalizeCategories(categoryTotals.payroll),
    },
    timeline: { daily: finalizeTimeline(daily), monthly: finalizeTimeline(monthly) },
    salesChannels: finalizeSalesChannels(salesChannels),
    topSuppliers: finalizeTopSuppliers(topSuppliers),
    coverage: {
      persistedClassifiedAmount: fixed(persistedClassifiedAmount), fallbackClassifiedAmount: fixed(fallbackClassifiedAmount), totalAmount: fixed(totalAmount), classifiedPct,
      rowCount: rows.length, persistedClassifiedRowCount, fallbackClassifiedRowCount, unclassifiedRowCount: reportingClassCounts.unclassified,
    },
    reportingClassCounts,
    reportingClassRecordCounts,
  };
}
