import { toYmd } from '../../utils/saudiDate';

export type InvoiceListUrlExtra = {
  kind: string;
  categoryId: string;
  expenseLineId: string;
};

export type InvoiceListUrlState = InvoiceListUrlExtra & {
  from: string;
  to: string;
  supplierId: string;
  supplierCategoryId: string;
  q: string;
  batchId: string;
  drillKey: string;
  hasDrillValues: boolean;
};

export const EMPTY_INVOICE_LIST_URL_EXTRA: InvoiceListUrlExtra = {
  kind: '',
  categoryId: '',
  expenseLineId: '',
};

const INVOICE_LIST_DRILL_KEYS = [
  'from',
  'to',
  'kind',
  'supplierId',
  'supplierCategoryId',
  'categoryId',
  'expenseLineId',
  'q',
  'batchId',
] as const;

export function parseInvoiceListUrlState(searchParams: URLSearchParams): InvoiceListUrlState {
  const values = Object.fromEntries(
    INVOICE_LIST_DRILL_KEYS.map((key) => [key, searchParams.get(key)?.trim() || '']),
  ) as Record<(typeof INVOICE_LIST_DRILL_KEYS)[number], string>;
  const drillParts = INVOICE_LIST_DRILL_KEYS.map((key) => values[key]);

  return {
    from: toYmd(values.from),
    to: toYmd(values.to),
    kind: values.kind,
    supplierId: values.supplierId,
    supplierCategoryId: values.supplierCategoryId,
    categoryId: values.categoryId,
    expenseLineId: values.expenseLineId,
    q: values.q,
    batchId: values.batchId,
    drillKey: drillParts.join('\u001f'),
    hasDrillValues: drillParts.some(Boolean),
  };
}

export function applyInvoiceListKindDrill(kind: string): InvoiceListUrlExtra & { filterKind: string } {
  if (!kind) {
    return { ...EMPTY_INVOICE_LIST_URL_EXTRA, filterKind: '' };
  }
  if (kind.includes(',')) {
    return { ...EMPTY_INVOICE_LIST_URL_EXTRA, kind, filterKind: '' };
  }
  return { ...EMPTY_INVOICE_LIST_URL_EXTRA, filterKind: kind };
}

export function resolveInvoiceListDateRange(input: {
  fromUrl: string;
  toUrl: string;
  fallbackStartDate: string;
  fallbackEndDate: string;
}) {
  const hasUrlRange = Boolean(input.fromUrl && input.toUrl);
  return {
    startDate: hasUrlRange ? input.fromUrl : input.fallbackStartDate,
    endDate: hasUrlRange ? input.toUrl : input.fallbackEndDate,
  };
}

export function resolveInvoiceListKindForApi(filterKind: string, urlExtraKind: string): string | undefined {
  return filterKind || urlExtraKind || undefined;
}
