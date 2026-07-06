import { toYmd } from '../../utils/saudiDate';
import { buildInvoicesCashReportBody } from './utils/buildInvoicesCashReportPrint';

const EMPTY_REPORT_VALUE = '\u2014';

export type InvoiceCashVaultRowSource = {
  vaultId?: string | null;
  nameAr?: string | null;
  nameEn?: string | null;
  total?: unknown;
  outflow?: unknown;
  remainder?: unknown;
};

export type InvoiceCashReportVaultSource = {
  id?: string;
  type?: string;
};

export type InvoiceCashReportLabels = {
  reportTitle: string;
  subtitle: string;
  scopeNote: string;
  vaultSectionTitle: string;
  colVault: string;
  colIn: string;
  colOut: string;
  colRemain: string;
  totalsTitle: string;
  salesCashOnHandTitle: string;
  salesCashOnHandHint: string;
  summariesCountLabel: string;
  noCashVaults: string;
};

export type InvoiceCashReportTotals = {
  inflow: number;
  outflow: number;
  remainder: number;
};

export function resolveInvoicesCashReportPeriodLine(input: {
  fromUrl: string;
  toUrl: string;
  invoiceQueryStartDate: string;
  invoiceQueryEndDate: string;
}) {
  if (input.fromUrl && input.toUrl) return `${input.fromUrl} ${EMPTY_REPORT_VALUE} ${input.toUrl}`;
  return `${toYmd(input.invoiceQueryStartDate) || EMPTY_REPORT_VALUE} ${EMPTY_REPORT_VALUE} ${
    toYmd(input.invoiceQueryEndDate) || EMPTY_REPORT_VALUE
  }`;
}

export function getCashVaultIds(vaultsList: InvoiceCashReportVaultSource[]) {
  return new Set(
    vaultsList
      .filter((vault) => String(vault.type || '').toLowerCase() === 'cash')
      .map((vault) => String(vault.id)),
  );
}

export function filterCashVaultRows(
  rows: InvoiceCashVaultRowSource[] | undefined,
  vaultsList: InvoiceCashReportVaultSource[],
) {
  const cashVaultIds = getCashVaultIds(vaultsList);
  return (rows ?? []).filter((row) => row.vaultId && cashVaultIds.has(row.vaultId));
}

export function sumSalesCashOnHand(summaries: Array<{ cashOnHand?: unknown }>) {
  return summaries.reduce((acc, summary) => acc + Number(summary.cashOnHand ?? 0), 0);
}

export function mapCashReportVaultRows(input: {
  rows: InvoiceCashVaultRowSource[];
  lang: string;
  fmt: (value: number) => string;
}) {
  return input.rows.map((row) => {
    const name = input.lang === 'en' ? row.nameEn || row.nameAr : row.nameAr || row.nameEn;
    return {
      vaultName: name || EMPTY_REPORT_VALUE,
      inflow: input.fmt(Number(row.total ?? 0)),
      outflow: input.fmt(Number(row.outflow ?? 0)),
      remainder: input.fmt(Number(row.remainder ?? 0)),
    };
  });
}

export function calculateCashReportTotals(rows: InvoiceCashVaultRowSource[]): InvoiceCashReportTotals {
  return rows.reduce<InvoiceCashReportTotals>(
    (acc, row) => ({
      inflow: acc.inflow + Number(row.total ?? 0),
      outflow: acc.outflow + Number(row.outflow ?? 0),
      remainder: acc.remainder + Number(row.remainder ?? 0),
    }),
    { inflow: 0, outflow: 0, remainder: 0 },
  );
}

export function buildInvoicesCashReportHtml(input: {
  periodLine: string;
  labels: InvoiceCashReportLabels;
  cashRows: InvoiceCashVaultRowSource[];
  summaries: Array<{ cashOnHand?: unknown }>;
  lang: string;
  fmt: (value: number) => string;
}) {
  const vaultRows = mapCashReportVaultRows({
    rows: input.cashRows,
    lang: input.lang,
    fmt: input.fmt,
  });
  const totals = calculateCashReportTotals(input.cashRows);
  const cashOnHandSum = sumSalesCashOnHand(input.summaries);

  return buildInvoicesCashReportBody(
    {
      ...input.labels,
      periodLine: input.periodLine,
    },
    vaultRows,
    {
      inflow: input.fmt(totals.inflow),
      outflow: input.fmt(totals.outflow),
      remainder: input.fmt(totals.remainder),
    },
    input.fmt(cashOnHandSum),
    input.summaries.length,
  );
}
