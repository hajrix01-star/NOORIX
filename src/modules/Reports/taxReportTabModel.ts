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
  const outRows = OUTPUT_ROWS.map((row) => {
    const amt = row.isTotal ? totals.outputTotal : getRowValue(data, row.key, 'amount');
    const vat = row.isTotal ? totals.outputTotal : getRowValue(data, row.key, 'vat');
    return `<tr><td>${esc(label(row))}</td><td>${fmtTax(amt)}</td><td>${row.isTotal ? '-' : fmtTax(getRowValue(data, row.key, 'adjustment'))}</td><td>${fmtTax(vat)}</td></tr>`;
  }).join('');
  const inRows = INPUT_ROWS.map((row) => {
    const amt = row.isTotal ? totals.inputTotal : getRowValue(data, row.key, 'amount');
    const vat = row.isTotal ? totals.inputTotal : getRowValue(data, row.key, 'vat');
    return `<tr><td>${esc(label(row))}</td><td>${fmtTax(amt)}</td><td>${row.isTotal ? '-' : fmtTax(getRowValue(data, row.key, 'adjustment'))}</td><td>${fmtTax(vat)}</td></tr>`;
  }).join('');
  return `<table><thead><tr><th>${esc(t('reportItem'))}</th><th>Amount (SR)</th><th>${lang === 'ar' ? 'التعديلات' : 'Adjustments'}</th><th>${lang === 'ar' ? 'ضريبة القيمة المضافة' : 'VAT'}</th></tr></thead>
<tbody><tr><td colspan="4" style="background:#f0fdf4;font-weight:700">${lang === 'ar' ? 'مخرجات ضريبة القيمة المضافة (المبيعات)' : 'Output VAT (Sales)'}</td></tr>${outRows}
<tr><td colspan="4" style="background:#fef2f2;font-weight:700">${lang === 'ar' ? 'ضريبة المشتريات والمصروفات (ما سجلت ضريبته فقط)' : 'Purchases & expenses VAT (tax lines only)'}</td></tr>${inRows}
<tr><td colspan="4" style="background:#eff6ff;font-weight:700">${lang === 'ar' ? 'الملخص' : 'Summary'}</td></tr>
<tr><td>${lang === 'ar' ? 'إجمالي الضريبة المستحقة' : 'Total VAT due'}</td><td colspan="3">${fmtTax(totals.outputTotal)} SR</td></tr>
<tr><td>${lang === 'ar' ? 'إجمالي ضريبة المشتريات والمصروفات (مسجلة فقط)' : 'Total VAT on purchases & expenses (recorded only)'}</td><td colspan="3">${fmtTax(totals.inputTotal)} SR</td></tr>
<tr><td>${lang === 'ar' ? 'صافي الضريبة' : 'Net VAT'}</td><td colspan="3">${fmtTax(totals.netVat)} SR</td></tr>
<tr><td>${lang === 'ar' ? 'تصحيحات من الفترة السابقة' : 'Prior period adjustments'}</td><td colspan="3">${fmtTax(totals.priorAdj)}</td></tr>
<tr><td>${lang === 'ar' ? 'رصيد مرحلة' : 'Balance carried forward'}</td><td colspan="3">${fmtTax(totals.balanceCarried)}</td></tr>
<tr style="background:#dbeafe;font-weight:800"><td>${lang === 'ar' ? 'صافي الضريبة المستحقة أو المطالب بها' : 'Net VAT payable or refundable'}</td><td colspan="3">${fmtTax(totals.netPayable)} SR</td></tr>
</tbody></table>`;
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

function esc(value: unknown): string {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
