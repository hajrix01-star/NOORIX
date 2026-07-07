import { TAX_RATE } from '@noorix/finance-core';
import { roundMoney2 } from '../utils/moneyInput';

export type TaxDisclosureRowKey =
  | 'standard_sales'
  | 'standard_purchases'
  | 'output_total'
  | 'input_total'
  | 'vat_due'
  | 'vat_recoverable'
  | 'net_vat'
  | 'prior_adjustments'
  | 'balance_carried'
  | 'net_payable_refund';

export type TaxDisclosureField = 'amount' | 'adjustment' | 'vat';

export type TaxDisclosureLineRow = {
  key: TaxDisclosureRowKey;
  labelAr: string;
  labelEn: string;
  isTotal?: boolean;
};

export type TaxDisclosureSummaryRow = {
  key: TaxDisclosureRowKey;
  labelAr: string;
  labelEn: string;
  isFinal?: boolean;
};

export type TaxDisclosureRowValue = {
  amount: number;
  adjustment: number;
  vat: number;
};

export type TaxDisclosureData = Record<string, number | TaxDisclosureRowValue>;

type BulkFlatDisclosureRow = Partial<Record<
  'sales_amount' | 'sales_vat' | 'purchases_amount' | 'purchases_vat' | 'sales_adj' | 'purchases_adj' | 'prior_adjustments' | 'balance_carried',
  unknown
>>;

export const OUTPUT_ROWS: readonly TaxDisclosureLineRow[] = [
  { key: 'standard_sales', labelAr: 'مبيعات بالمعدل القياسي 15%', labelEn: 'Standard-rated sales 15%' },
  { key: 'output_total', labelAr: 'إجمالي مخرجات ضريبة القيمة المضافة', labelEn: 'Total output VAT', isTotal: true },
];

export const INPUT_ROWS: readonly TaxDisclosureLineRow[] = [
  {
    key: 'standard_purchases',
    labelAr: 'مشتريات ومصروفات (ضريبة مسجلة فقط)',
    labelEn: 'Purchases & expenses (VAT recorded only)',
  },
  {
    key: 'input_total',
    labelAr: 'إجمالي ضريبة المشتريات والمصروفات',
    labelEn: 'Total VAT on purchases & expenses',
    isTotal: true,
  },
];

export const SUMMARY_ROWS: readonly TaxDisclosureSummaryRow[] = [
  { key: 'vat_due', labelAr: 'إجمالي ضريبة القيمة المضافة المستحقة', labelEn: 'Total VAT due' },
  {
    key: 'vat_recoverable',
    labelAr: 'إجمالي ضريبة المشتريات والمصروفات (مسجلة)',
    labelEn: 'Total purchase & expense VAT (recorded)',
  },
  { key: 'net_vat', labelAr: 'صافي ضريبة القيمة المضافة', labelEn: 'Net VAT' },
  { key: 'prior_adjustments', labelAr: 'تصحيحات من الفترة السابقة', labelEn: 'Prior period adjustments' },
  { key: 'balance_carried', labelAr: 'رصيد مرحلة', labelEn: 'Balance carried forward' },
  { key: 'net_payable_refund', labelAr: 'صافي الضريبة المستحقة أو المطالب بها', labelEn: 'Net VAT payable or refundable', isFinal: true },
];

export function defaultDisclosureData(): TaxDisclosureData {
  const obj: TaxDisclosureData = {};
  [...OUTPUT_ROWS, ...INPUT_ROWS].filter((row) => !row.isTotal).forEach((row) => {
    obj[row.key] = { amount: 0, adjustment: 0, vat: 0 };
  });
  SUMMARY_ROWS.forEach((row) => {
    obj[row.key] = 0;
  });
  return obj;
}

export function getRowValue(
  data: TaxDisclosureData,
  key: string,
  field: TaxDisclosureField | null | undefined,
): number {
  const value = data[key];
  if (isDisclosureRowValue(value)) return field ? Number(value[field] || 0) : 0;
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function computeOutputTotal(data: TaxDisclosureData): number {
  return OUTPUT_ROWS.filter((row) => !row.isTotal).reduce(
    (sum, row) => sum + getRowValue(data, row.key, 'vat'),
    0,
  );
}

export function computeInputTotal(data: TaxDisclosureData): number {
  return INPUT_ROWS.filter((row) => !row.isTotal).reduce(
    (sum, row) => sum + getRowValue(data, row.key, 'vat'),
    0,
  );
}

export function computeNetPayable(data: TaxDisclosureData): number {
  const outputTotal = computeOutputTotal(data);
  const inputTotal = computeInputTotal(data);
  const netVat = outputTotal - inputTotal;
  const priorAdj = getRowValue(data, 'prior_adjustments', 'amount');
  const balanceCarried = getRowValue(data, 'balance_carried', 'amount');
  return netVat + priorAdj + balanceCarried;
}

export function syncVatPlanningSummaryFields(data: unknown): TaxDisclosureData {
  const base = isDisclosureData(data) ? cloneDisclosureData(data) : defaultDisclosureData();
  const out = computeOutputTotal(base);
  const inn = computeInputTotal(base);
  const netV = roundMoney2(out - inn);
  const priorRaw = base.prior_adjustments;
  const balRaw = base.balance_carried;
  const prior = roundMoney2(typeof priorRaw === 'number' && Number.isFinite(priorRaw) ? priorRaw : 0);
  const bcf = roundMoney2(typeof balRaw === 'number' && Number.isFinite(balRaw) ? balRaw : 0);
  base.vat_due = roundMoney2(out);
  base.vat_recoverable = roundMoney2(inn);
  base.net_vat = netV;
  base.net_payable_refund = roundMoney2(netV + prior + bcf);
  return base;
}

export { roundMoney2 };

export function normalizeDisclosureDecimals(data: unknown): TaxDisclosureData {
  if (!isDisclosureData(data)) return defaultDisclosureData();
  const next = cloneDisclosureData(data);
  [...OUTPUT_ROWS, ...INPUT_ROWS].filter((row) => !row.isTotal).forEach((row) => {
    const current = toDisclosureRowValue(next[row.key]);
    next[row.key] = {
      amount: roundMoney2(current.amount),
      adjustment: roundMoney2(current.adjustment),
      vat: roundMoney2(current.vat),
    };
  });
  SUMMARY_ROWS.forEach((row) => {
    next[row.key] = roundMoney2(next[row.key]);
  });
  return next;
}

export function mergeImportedDisclosure(stored: unknown, imported: unknown): TaxDisclosureData {
  if (!isDisclosureData(imported)) {
    return normalizeDisclosureDecimals(isDisclosureData(stored) ? stored : defaultDisclosureData());
  }
  const next = isDisclosureData(stored) ? cloneDisclosureData(stored) : defaultDisclosureData();
  const importedRecord = imported as Record<string, unknown>;
  const rowKeys = [...OUTPUT_ROWS, ...INPUT_ROWS].filter((row) => !row.isTotal).map((row) => row.key);
  for (const key of rowKeys) {
    if (isDisclosureRowValueLike(importedRecord[key])) {
      next[key] = {
        ...toDisclosureRowValue(next[key]),
        ...toPartialDisclosureRowValue(importedRecord[key]),
      };
    }
  }
  return normalizeDisclosureDecimals(next);
}

export function scaleInputVatForPaymentTarget(
  data: TaxDisclosureData,
  paymentTarget: unknown,
  vatRateDecimal: number = TAX_RATE,
): TaxDisclosureData {
  const target = Number(paymentTarget);
  if (!Number.isFinite(target)) return normalizeDisclosureDecimals(data);

  const outputTotal = computeOutputTotal(data);
  const priorAdj = getRowValue(data, 'prior_adjustments', 'amount');
  const balanceCarried = getRowValue(data, 'balance_carried', 'amount');
  const currentInput = computeInputTotal(data);
  const desiredInput = outputTotal + priorAdj + balanceCarried - target;

  if (desiredInput <= 0) {
    const next = cloneDisclosureData(data);
    INPUT_ROWS.filter((row) => !row.isTotal).forEach((row) => {
      next[row.key] = { ...toDisclosureRowValue(next[row.key]), vat: 0, amount: 0 };
    });
    return normalizeDisclosureDecimals(next);
  }

  if (currentInput <= 0) {
    const next = cloneDisclosureData(data);
    const stdKey = 'standard_purchases';
    const rate = vatRateDecimal > 0 ? vatRateDecimal : TAX_RATE;
    next[stdKey] = {
      ...toDisclosureRowValue(next[stdKey]),
      vat: roundMoney2(desiredInput),
      amount: roundMoney2(desiredInput / rate),
    };
    return normalizeDisclosureDecimals(next);
  }

  const factor = desiredInput / currentInput;
  const next = cloneDisclosureData(data);
  INPUT_ROWS.filter((row) => !row.isTotal).forEach((rowDef) => {
    const row = toDisclosureRowValue(next[rowDef.key]);
    const oldVat = Number(row.vat) || 0;
    const oldAmt = Number(row.amount) || 0;
    const newVat = oldVat * factor;
    const rate = vatRateDecimal > 0 ? vatRateDecimal : TAX_RATE;
    next[rowDef.key] = {
      ...row,
      vat: roundMoney2(newVat),
      amount: oldAmt ? roundMoney2(oldAmt * factor) : roundMoney2(newVat / rate),
    };
  });

  return normalizeDisclosureDecimals(next);
}

export function disclosureFromBulkFlatRow(vals: BulkFlatDisclosureRow): TaxDisclosureData {
  const salesAmt = roundMoney2(vals.sales_amount ?? 0);
  const salesVat = roundMoney2(vals.sales_vat ?? 0);
  const purAmt = roundMoney2(vals.purchases_amount ?? 0);
  const purVat = roundMoney2(vals.purchases_vat ?? 0);
  const salesAdj = roundMoney2(vals.sales_adj ?? 0);
  const purAdj = roundMoney2(vals.purchases_adj ?? 0);
  const prior = roundMoney2(vals.prior_adjustments ?? 0);
  const bal = roundMoney2(vals.balance_carried ?? 0);
  const netVat = roundMoney2(salesVat - purVat);
  const netPay = roundMoney2(netVat + prior + bal);
  return normalizeDisclosureDecimals({
    ...defaultDisclosureData(),
    standard_sales: { amount: salesAmt, adjustment: salesAdj, vat: salesVat },
    standard_purchases: { amount: purAmt, adjustment: purAdj, vat: purVat },
    prior_adjustments: prior,
    balance_carried: bal,
    vat_due: salesVat,
    vat_recoverable: purVat,
    net_vat: netVat,
    net_payable_refund: netPay,
  });
}

export function periodKeyFromQuarter(year: string | number, quarter: string | number): string {
  return `${year}-Q${quarter}`;
}

function isDisclosureData(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isDisclosureRowValue(value: unknown): value is TaxDisclosureRowValue {
  return !!value && typeof value === 'object' && ('amount' in value || 'adjustment' in value || 'vat' in value);
}

function isDisclosureRowValueLike(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function toDisclosureRowValue(value: unknown): TaxDisclosureRowValue {
  if (!isDisclosureRowValue(value)) return { amount: 0, adjustment: 0, vat: 0 };
  return {
    amount: Number(value.amount || 0),
    adjustment: Number(value.adjustment || 0),
    vat: Number(value.vat || 0),
  };
}

function toPartialDisclosureRowValue(value: unknown): Partial<TaxDisclosureRowValue> {
  if (!isDisclosureRowValueLike(value)) return {};
  return {
    amount: Number(value.amount || 0),
    adjustment: Number(value.adjustment || 0),
    vat: Number(value.vat || 0),
  };
}

function cloneDisclosureData(value: Record<string, unknown>): TaxDisclosureData {
  const next: TaxDisclosureData = {};
  for (const [key, raw] of Object.entries(value)) {
    if (isDisclosureRowValue(raw)) {
      next[key] = toDisclosureRowValue(raw);
      continue;
    }
    next[key] = Number(raw || 0);
  }
  return next;
}
