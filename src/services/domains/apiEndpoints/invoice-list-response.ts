export type InvoiceListMoneySummary = {
  net: string;
  tax: string;
  total: string;
  count: number;
};

export type InvoiceListSums = {
  all: InvoiceListMoneySummary;
  inflow: InvoiceListMoneySummary;
  outflow: InvoiceListMoneySummary;
};

export type InvoiceListSumsByKindRow = InvoiceListMoneySummary & {
  kind: string;
};

export type InvoiceListVaultFlowRow = {
  vaultId?: string | null;
  total: string;
  outflow: string;
  remainder: string;
  unassigned?: boolean | null;
  name?: string | null;
  nameAr?: string | null;
  nameEn?: string | null;
};

export type InvoiceListOutflowSummary = {
  purchasesTotal: string;
  expensesTotal: string;
  taxTotal: string;
};

export type InvoiceListItem = {
  id?: string | null;
  invoiceNumber?: string | number | null;
  supplierInvoiceNumber?: string | number | null;
  transactionDate?: string | Date | null;
  kind?: string | null;
  status?: string | null;
  netAmount?: string | number | null;
  taxAmount?: string | number | null;
  totalAmount?: string | number | null;
  notes?: string | null;
  [key: string]: unknown;
};

export type InvoiceListResponse = {
  items: InvoiceListItem[];
  total: number;
  page: number;
  pageSize: number;
  sums: InvoiceListSums;
  sumsByKind: InvoiceListSumsByKindRow[];
  inflowByVault: InvoiceListVaultFlowRow[];
  outflowSummary: InvoiceListOutflowSummary;
};

export function zeroInvoiceListMoneySummary(): InvoiceListMoneySummary {
  return { net: '0', tax: '0', total: '0', count: 0 };
}

export function zeroInvoiceListSums(): InvoiceListSums {
  return {
    all: zeroInvoiceListMoneySummary(),
    inflow: zeroInvoiceListMoneySummary(),
    outflow: zeroInvoiceListMoneySummary(),
  };
}

export function zeroInvoiceListOutflowSummary(): InvoiceListOutflowSummary {
  return { purchasesTotal: '0', expensesTotal: '0', taxTotal: '0' };
}

export function normalizeInvoiceListResponse(
  raw: unknown,
  fallback: { page: unknown; pageSize: unknown },
): InvoiceListResponse {
  const data = unwrapInvoiceListData(raw);
  const source = asRecord(data);

  return {
    items: normalizeInvoiceListItems(source, data),
    total: toSafeNumber(source.total, 0),
    page: toSafeNumber(source.page, fallback.page, 1),
    pageSize: toSafeNumber(source.pageSize, fallback.pageSize, 50),
    sums: normalizeInvoiceListSums(source.sums),
    sumsByKind: normalizeInvoiceListSumsByKind(source.sumsByKind),
    inflowByVault: normalizeInvoiceListVaultRows(source.inflowByVault),
    outflowSummary: normalizeInvoiceListOutflowSummary(source.outflowSummary),
  };
}

function unwrapInvoiceListData(raw: unknown) {
  return asRecord(raw).data ?? raw;
}

function normalizeInvoiceListItems(source: Record<string, unknown>, fallbackData: unknown): InvoiceListItem[] {
  const rawItems = Array.isArray(source.items)
    ? source.items
    : Array.isArray(fallbackData)
      ? fallbackData
      : [];
  return rawItems.filter(isInvoiceListItem);
}

function isInvoiceListItem(value: unknown): value is InvoiceListItem {
  return Boolean(value && typeof value === 'object');
}

function normalizeInvoiceListSums(value: unknown): InvoiceListSums {
  const source = asRecord(value);
  return {
    all: normalizeInvoiceListMoneySummary(source.all),
    inflow: normalizeInvoiceListMoneySummary(source.inflow),
    outflow: normalizeInvoiceListMoneySummary(source.outflow),
  };
}

function normalizeInvoiceListSumsByKind(value: unknown): InvoiceListSumsByKindRow[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    const source = asRecord(row);
    return {
      kind: String(source.kind ?? ''),
      ...normalizeInvoiceListMoneySummary(source),
    };
  });
}

function normalizeInvoiceListVaultRows(value: unknown): InvoiceListVaultFlowRow[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    const source = asRecord(row);
    return {
      vaultId: source.vaultId == null ? null : String(source.vaultId),
      total: toMoneyString(source.total),
      outflow: toMoneyString(source.outflow),
      remainder: toMoneyString(source.remainder),
      unassigned: typeof source.unassigned === 'boolean' ? source.unassigned : undefined,
      name: optionalString(source.name),
      nameAr: optionalString(source.nameAr),
      nameEn: optionalString(source.nameEn),
    };
  });
}

function normalizeInvoiceListOutflowSummary(value: unknown): InvoiceListOutflowSummary {
  const source = asRecord(value);
  return {
    purchasesTotal: toMoneyString(source.purchasesTotal),
    expensesTotal: toMoneyString(source.expensesTotal),
    taxTotal: toMoneyString(source.taxTotal),
  };
}

function normalizeInvoiceListMoneySummary(value: unknown): InvoiceListMoneySummary {
  const source = asRecord(value);
  return {
    net: toMoneyString(source.net),
    tax: toMoneyString(source.tax),
    total: toMoneyString(source.total),
    count: toSafeNumber(source.count, 0),
  };
}

function toMoneyString(value: unknown) {
  if (value == null || value === '') return '0';
  return String(value);
}

function toSafeNumber(value: unknown, fallback: unknown, defaultValue = 0) {
  const number = Number(value ?? fallback ?? defaultValue);
  return Number.isFinite(number) ? number : defaultValue;
}

function optionalString(value: unknown) {
  return value == null || value === '' ? undefined : String(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}
