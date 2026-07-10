import { TAX_REPORT_STORAGE_PREFIX } from '../../constants/storageKeys';
import {
  INPUT_ROWS,
  OUTPUT_ROWS,
  SUMMARY_ROWS,
  computeInputTotal,
  computeNetPayable,
  computeOutputTotal,
  defaultDisclosureData,
  getRowValue,
  mergeImportedDisclosure,
  type TaxDisclosureData,
  type TaxDisclosureField,
  type TaxDisclosureLineRow,
  type TaxDisclosureRowKey,
} from '../../constants/taxDisclosure';
import { fmtTax } from '../../utils/format';
import { readJsonStorage, writeJsonStorage } from '../../utils/jsonStorage';
import { buildPrintHtmlTable, type PrintHtmlTableRow } from '../../utils/printTableHtml';

export type TaxDraftSource = 'system' | 'manualDraft';

export type TaxPeriodOption = {
  value: string;
  label: string;
};

export type TaxReportTotals = {
  outputTotal: number;
  inputTotal: number;
  netPayable: number;
  priorAdj: number;
  balanceCarried: number;
  netVat: number;
};

export type TaxReportExportRow = Record<string, string | number | undefined>;

const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function taxReportStorageKey(companyId: string, period: string): string {
  return `${TAX_REPORT_STORAGE_PREFIX}_${companyId}_${period}`;
}

export function loadStoredTaxReportData(companyId: string, period: string): TaxDisclosureData {
  const parsed = readJsonStorage(taxReportStorageKey(companyId, period), null);
  return mergeImportedDisclosure(defaultDisclosureData(), parsed);
}

export function saveStoredTaxReportData(companyId: string, period: string, data: TaxDisclosureData): void {
  writeJsonStorage(taxReportStorageKey(companyId, period), data);
}

export function buildTaxPeriodOptions(lang: string): TaxPeriodOption[] {
  const opts: TaxPeriodOption[] = [];
  for (let q = 1; q <= 4; q++) opts.push({ value: `Q${q}`, label: lang === 'ar' ? `الربع ${q}` : `Q${q}` });
  for (let m = 1; m <= 12; m++) opts.push({ value: `M${m}`, label: EN_MONTHS[m - 1] });
  return opts;
}

export function computeTaxReportTotals(data: TaxDisclosureData): TaxReportTotals {
  const outputTotal = computeOutputTotal(data);
  const inputTotal = computeInputTotal(data);
  const netPayable = computeNetPayable(data);
  const priorAdj = getRowValue(data, 'prior_adjustments', 'amount');
  const balanceCarried = getRowValue(data, 'balance_carried', 'amount');
  return {
    outputTotal,
    inputTotal,
    netPayable,
    priorAdj,
    balanceCarried,
    netVat: outputTotal - inputTotal,
  };
}

export function updateTaxDisclosureRow(
  current: TaxDisclosureData,
  key: TaxDisclosureRowKey,
  field: TaxDisclosureField | null,
  value: unknown,
): TaxDisclosureData {
  const num = parseFloat(String(value).replace(/,/g, '')) || 0;
  const next: TaxDisclosureData = { ...current };
  const isSummaryField = !field || SUMMARY_ROWS.some((row) => row.key === key);
  if (isSummaryField) {
    next[key] = num;
    return next;
  }
  const currentRow = next[key];
  const rowValue = currentRow && typeof currentRow === 'object'
    ? currentRow
    : { amount: 0, adjustment: 0, vat: 0 };
  next[key] = { ...rowValue, [field]: num };
  return next;
}

export function buildTaxReportPrintBody(params: {
  data: TaxDisclosureData;
  totals: TaxReportTotals;
  lang: string;
  t: (key: string) => string;
}): string {
  const { data, totals, lang, t } = params;
  const label = (row: TaxDisclosureLineRow) => (lang === 'ar' ? row.labelAr : row.labelEn);
  const arabic = {
    adjustments: '\u0627\u0644\u062a\u0639\u062f\u064a\u0644\u0627\u062a',
    vat: '\u0636\u0631\u064a\u0628\u0629 \u0627\u0644\u0642\u064a\u0645\u0629 \u0627\u0644\u0645\u0636\u0627\u0641\u0629',
    outputVatSales: '\u0645\u062e\u0631\u062c\u0627\u062a \u0636\u0631\u064a\u0628\u0629 \u0627\u0644\u0642\u064a\u0645\u0629 \u0627\u0644\u0645\u0636\u0627\u0641\u0629 (\u0627\u0644\u0645\u0628\u064a\u0639\u0627\u062a)',
    inputVatRecorded: '\u0636\u0631\u064a\u0628\u0629 \u0627\u0644\u0645\u0634\u062a\u0631\u064a\u0627\u062a \u0648\u0627\u0644\u0645\u0635\u0631\u0648\u0641\u0627\u062a (\u0645\u0627 \u0633\u062c\u0644\u062a \u0636\u0631\u064a\u0628\u062a\u0647 \u0641\u0642\u0637)',
    summary: '\u0627\u0644\u0645\u0644\u062e\u0635',
  };
  const sectionRow = (value: string, background: string): PrintHtmlTableRow => ({
    cells: [{ value, colSpan: 4, style: 'background:' + background + ';font-weight:700' }],
  });
  const summaryLabel = (key: TaxDisclosureRowKey, fallbackAr: string, fallbackEn: string): string => {
    const row = SUMMARY_ROWS.find((item) => item.key === key);
    if (!row) return lang === 'ar' ? fallbackAr : fallbackEn;
    return lang === 'ar' ? row.labelAr : row.labelEn;
  };
  const outputRows = OUTPUT_ROWS.map((row) => {
    const amt = row.isTotal ? totals.outputTotal : getRowValue(data, row.key, 'amount');
    const vat = row.isTotal ? totals.outputTotal : getRowValue(data, row.key, 'vat');
    return {
      cells: [
        { value: label(row) },
        { value: fmtTax(amt), align: 'end' as const },
        { value: row.isTotal ? '-' : fmtTax(getRowValue(data, row.key, 'adjustment')), align: 'end' as const },
        { value: fmtTax(vat), align: 'end' as const },
      ],
    };
  });
  const inputRows = INPUT_ROWS.map((row) => {
    const amt = row.isTotal ? totals.inputTotal : getRowValue(data, row.key, 'amount');
    const vat = row.isTotal ? totals.inputTotal : getRowValue(data, row.key, 'vat');
    return {
      cells: [
        { value: label(row) },
        { value: fmtTax(amt), align: 'end' as const },
        { value: row.isTotal ? '-' : fmtTax(getRowValue(data, row.key, 'adjustment')), align: 'end' as const },
        { value: fmtTax(vat), align: 'end' as const },
      ],
    };
  });
  const summaryRows: PrintHtmlTableRow[] = [
    {
      cells: [
        { value: summaryLabel('vat_due', '', 'Total VAT due') },
        { value: fmtTax(totals.outputTotal) + ' SR', colSpan: 3, align: 'end' },
      ],
    },
    {
      cells: [
        { value: summaryLabel('vat_recoverable', '', 'Total VAT on purchases & expenses (recorded only)') },
        { value: fmtTax(totals.inputTotal) + ' SR', colSpan: 3, align: 'end' },
      ],
    },
    {
      cells: [
        { value: summaryLabel('net_vat', '', 'Net VAT') },
        { value: fmtTax(totals.netVat) + ' SR', colSpan: 3, align: 'end' },
      ],
    },
    {
      cells: [
        { value: summaryLabel('prior_adjustments', '', 'Prior period adjustments') },
        { value: fmtTax(totals.priorAdj), colSpan: 3, align: 'end' },
      ],
    },
    {
      cells: [
        { value: summaryLabel('balance_carried', '', 'Balance carried forward') },
        { value: fmtTax(totals.balanceCarried), colSpan: 3, align: 'end' },
      ],
    },
    {
      cells: [
        {
          value: summaryLabel('net_payable_refund', '', 'Net VAT payable or refundable'),
          style: 'font-weight:800;background:#dbeafe',
        },
        { value: fmtTax(totals.netPayable) + ' SR', colSpan: 3, align: 'end', style: 'font-weight:800;background:#dbeafe' },
      ],
    },
  ];

  return buildPrintHtmlTable({
    wrapperClassName: null,
    headerRows: [{
      cells: [
        { value: t('reportItem') },
        { value: 'Amount (SR)', align: 'end' },
        { value: lang === 'ar' ? arabic.adjustments : 'Adjustments', align: 'end' },
        { value: lang === 'ar' ? arabic.vat : 'VAT', align: 'end' },
      ],
    }],
    bodyRows: [
      sectionRow(lang === 'ar' ? arabic.outputVatSales : 'Output VAT (Sales)', '#f0fdf4'),
      ...outputRows,
      sectionRow(lang === 'ar' ? arabic.inputVatRecorded : 'Purchases & expenses VAT (tax lines only)', '#fef2f2'),
      ...inputRows,
      sectionRow(lang === 'ar' ? arabic.summary : 'Summary', '#eff6ff'),
      ...summaryRows,
    ],
  });
}

export function buildTaxReportExportRows(params: {
  data: TaxDisclosureData;
  totals: TaxReportTotals;
  lang: string;
  t: (key: string) => string;
}): TaxReportExportRow[] {
  const { data, totals, lang, t } = params;
  const rows: TaxReportExportRow[] = [];
  const label = (row: TaxDisclosureLineRow) => (lang === 'ar' ? row.labelAr : row.labelEn);
  const amountKey = lang === 'ar' ? 'المبلغ' : 'Amount';
  const vatKey = lang === 'ar' ? 'الضريبة' : 'VAT';
  OUTPUT_ROWS.forEach((row) => {
    rows.push({
      [t('reportItem')]: label(row),
      [amountKey]: row.isTotal ? totals.outputTotal : getRowValue(data, row.key, 'amount'),
      [vatKey]: row.isTotal ? totals.outputTotal : getRowValue(data, row.key, 'vat'),
    });
  });
  INPUT_ROWS.forEach((row) => {
    rows.push({
      [t('reportItem')]: label(row),
      [amountKey]: row.isTotal ? totals.inputTotal : getRowValue(data, row.key, 'amount'),
      [vatKey]: row.isTotal ? totals.inputTotal : getRowValue(data, row.key, 'vat'),
    });
  });
  const finalRow = SUMMARY_ROWS.find((row) => row.key === 'net_payable_refund');
  rows.push({ [t('reportItem')]: finalRow ? (lang === 'ar' ? finalRow.labelAr : finalRow.labelEn) : undefined, [amountKey]: totals.netPayable });
  return rows;
}
