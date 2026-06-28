/**
 * نموذج الإفصاح الضريبي السعودي — تعريفات وبنيات مشتركة بين تقرير الضرائب وسجل الضريبة التخطيطي.
 * لا تستورد من modules/.
 */
import { TAX_RATE } from '../utils/math-engine';
import { roundMoney2 } from '../utils/moneyInput';

/** صفوف المخرجات/المدخلات المعروضة في الواجهة — مختصرة للاستخدام الذي لا يفرّق هذه الفئات */
export const OUTPUT_ROWS = [
  { key: 'standard_sales', labelAr: 'مبيعات بالمعدل القياسي 15%', labelEn: 'Standard-rated sales 15%' },
  { key: 'output_total', labelAr: 'إجمالي مخرجات ضريبة القيمة المضافة', labelEn: 'Total output VAT', isTotal: true },
];

export const INPUT_ROWS = [
  {
    key: 'standard_purchases',
    labelAr: 'مشتريات ومصروفات (ضريبة مسجّلة فقط)',
    labelEn: 'Purchases & expenses (VAT recorded only)',
  },
  {
    key: 'input_total',
    labelAr: 'إجمالي ضريبة المشتريات والمصروفات',
    labelEn: 'Total VAT on purchases & expenses',
    isTotal: true,
  },
];

export const SUMMARY_ROWS = [
  { key: 'vat_due', labelAr: 'إجمالي ضريبة القيمة المضافة المستحقة', labelEn: 'Total VAT due' },
  {
    key: 'vat_recoverable',
    labelAr: 'إجمالي ضريبة المشتريات والمصروفات (مسجّلة)',
    labelEn: 'Total purchase & expense VAT (recorded)',
  },
  { key: 'net_vat', labelAr: 'صافي ضريبة القيمة المضافة', labelEn: 'Net VAT' },
  { key: 'prior_adjustments', labelAr: 'تصحيحات من الفترة السابقة', labelEn: 'Prior period adjustments' },
  { key: 'balance_carried', labelAr: 'رصيد مرحلة', labelEn: 'Balance carried forward' },
  { key: 'net_payable_refund', labelAr: 'صافي الضريبة المستحقة أو المطالب بها', labelEn: 'Net VAT payable or refundable', isFinal: true },
];

export function defaultDisclosureData() {
  const rows = [...OUTPUT_ROWS, ...INPUT_ROWS].filter((r: any) => !r.isTotal);
  const obj: Record<string, any> = {};
  rows.forEach((r: any) => {
    obj[r.key] = { amount: 0, adjustment: 0, vat: 0 };
  });
  SUMMARY_ROWS.forEach((r: any) => {
    obj[r.key] = 0;
  });
  return obj;
}

export function getRowValue(data: any, key: any, field: any) {
  const v = data[key];
  if (v && typeof v === 'object') return v[field] ?? 0;
  return typeof v === 'number' ? v : 0;
}

export function computeOutputTotal(data: any) {
  let sum = 0;
  OUTPUT_ROWS.filter((r: any) => !r.isTotal).forEach((r: any) => {
    sum += getRowValue(data, r.key, 'vat');
  });
  return sum;
}

export function computeInputTotal(data: any) {
  let sum = 0;
  INPUT_ROWS.filter((r: any) => !r.isTotal).forEach((r: any) => {
    sum += getRowValue(data, r.key, 'vat');
  });
  return sum;
}

export function computeNetPayable(data: any) {
  const outputTotal = computeOutputTotal(data);
  const inputTotal = computeInputTotal(data);
  const netVat = outputTotal - inputTotal;
  const priorAdj = getRowValue(data, 'prior_adjustments', 'amount');
  const balanceCarried = getRowValue(data, 'balance_carried', 'amount');
  return netVat + priorAdj + balanceCarried;
}

/** يحدّث حقول الملخص المشتقة (vat_due، net_vat، …) لتطابق الصفوف — مفيد قبل الحفظ والطباعة. */
export function syncVatPlanningSummaryFields(data: any) {
  const base = data && typeof data === 'object' ? { ...data } : defaultDisclosureData();
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

/** تقريب مالي إلى منزلتين عشريتين (عرض وتخزين الحقول الضريبية). */
export { roundMoney2 };

/** يطبّق منزلتين على كل المبالغ في نموذج الإفصاح بعد الاستيراد أو التعديل. */
export function normalizeDisclosureDecimals(data: any) {
  if (!data || typeof data !== 'object') return defaultDisclosureData();
  const next = JSON.parse(JSON.stringify(data));
  [...OUTPUT_ROWS, ...INPUT_ROWS].filter((r: any) => !r.isTotal).forEach((r: any) => {
    const k = r.key;
    if (!next[k] || typeof next[k] !== 'object') {
      next[k] = { amount: 0, adjustment: 0, vat: 0 };
    }
    next[k].amount = roundMoney2(next[k].amount);
    next[k].vat = roundMoney2(next[k].vat);
    next[k].adjustment = roundMoney2(next[k].adjustment);
  });
  SUMMARY_ROWS.forEach((r: any) => {
    next[r.key] = roundMoney2(next[r.key]);
  });
  return next;
}

/**
 * دمج أرقام مستوردة من تقرير الضريبة في النظام (نفس شكل API tax-vat).
 */
export function mergeImportedDisclosure(stored: any, imported: any) {
  if (!imported || typeof imported !== 'object') {
    return normalizeDisclosureDecimals(stored ? { ...stored } : defaultDisclosureData());
  }
  const next = { ...(stored || defaultDisclosureData()) };
  const rowKeys = [...OUTPUT_ROWS, ...INPUT_ROWS].filter((r: any) => !r.isTotal).map((r: any) => r.key);
  for (const key of rowKeys) {
    if (imported[key] && typeof imported[key] === 'object') {
      next[key] = { ...(next[key] || { amount: 0, adjustment: 0, vat: 0 }), ...imported[key] };
    }
  }
  return normalizeDisclosureDecimals(next);
}

/**
 * ضبط مدخلات الضريبة (الخارج) لتتوافق مع صافي مستهدف = مبلغ الدفع المرغوب.
 * netPayable = output - input + prior + balance  →  input' = output + prior + balance - netPayableTarget
 */
export function scaleInputVatForPaymentTarget(
  data: any,
  paymentTarget: any,
  vatRateDecimal: number = TAX_RATE,
) {
  const target = Number(paymentTarget);
  if (!Number.isFinite(target)) return normalizeDisclosureDecimals({ ...data });

  const outputTotal = computeOutputTotal(data);
  const priorAdj = getRowValue(data, 'prior_adjustments', 'amount');
  const balanceCarried = getRowValue(data, 'balance_carried', 'amount');
  const currentInput = computeInputTotal(data);

  const desiredInput = outputTotal + priorAdj + balanceCarried - target;

  if (desiredInput < 0) {
    const next = JSON.parse(JSON.stringify(data));
    INPUT_ROWS.filter((r: any) => !r.isTotal).forEach((r: any) => {
      if (next[r.key] && typeof next[r.key] === 'object') {
        next[r.key] = { ...next[r.key], vat: 0, amount: 0 };
      }
    });
    return normalizeDisclosureDecimals(next);
  }

  if (desiredInput === 0) {
    const next = JSON.parse(JSON.stringify(data));
    INPUT_ROWS.filter((r: any) => !r.isTotal).forEach((r: any) => {
      if (next[r.key] && typeof next[r.key] === 'object') {
        next[r.key] = { ...next[r.key], vat: 0, amount: 0 };
      }
    });
    return normalizeDisclosureDecimals(next);
  }

  if (currentInput <= 0) {
    const next = JSON.parse(JSON.stringify(data));
    const stdKey = 'standard_purchases';
    if (!next[stdKey] || typeof next[stdKey] !== 'object') {
      next[stdKey] = { amount: 0, adjustment: 0, vat: 0 };
    }
    const rate = vatRateDecimal > 0 ? vatRateDecimal : TAX_RATE;
    next[stdKey] = {
      ...next[stdKey],
      vat: roundMoney2(desiredInput),
      amount: roundMoney2(desiredInput / rate),
    };
    return normalizeDisclosureDecimals(next);
  }

  const factor = desiredInput / currentInput;
  const next = JSON.parse(JSON.stringify(data));
  INPUT_ROWS.filter((r: any) => !r.isTotal).forEach((r: any) => {
    const row = next[r.key];
    if (!row || typeof row !== 'object') return;
    const oldVat = Number(row.vat) || 0;
    const oldAmt = Number(row.amount) || 0;
    const newVat = oldVat * factor;
    const rate = vatRateDecimal > 0 ? vatRateDecimal : TAX_RATE;
    row.vat = roundMoney2(newVat);
    row.amount = oldAmt ? roundMoney2(oldAmt * factor) : roundMoney2(newVat / rate);
  });

  return normalizeDisclosureDecimals(next);
}

/** بناء payload إفصاح من صف استيراد Excel (أعمدة بالإنجليزية من القالب). */
export function disclosureFromBulkFlatRow(vals: any) {
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

export function periodKeyFromQuarter(year: any, quarter: any) {
  return `${year}-Q${quarter}`;
}
