/**
 * نموذج الإفصاح الضريبي السعودي — تعريفات وبنيات مشتركة بين تقرير الضرائب وسجل الضريبة التخطيطي.
 * لا تستورد من modules/.
 */

/** صفوف المخرجات/المدخلات المعروضة في الواجهة — مختصرة للاستخدام الذي لا يفرّق هذه الفئات */
export const OUTPUT_ROWS = [
  { key: 'standard_sales', labelAr: 'مبيعات بالمعدل القياسي 15%', labelEn: 'Standard-rated sales 15%' },
  { key: 'output_total', labelAr: 'إجمالي مخرجات ضريبة القيمة المضافة', labelEn: 'Total output VAT', isTotal: true },
];

export const INPUT_ROWS = [
  { key: 'standard_purchases', labelAr: 'مشتريات محلية بالمعدل القياسي', labelEn: 'Standard-rated local purchases' },
  { key: 'input_total', labelAr: 'إجمالي مدخلات ضريبة القيمة المضافة', labelEn: 'Total input VAT', isTotal: true },
];

export const SUMMARY_ROWS = [
  { key: 'vat_due', labelAr: 'إجمالي ضريبة القيمة المضافة المستحقة', labelEn: 'Total VAT due' },
  { key: 'vat_recoverable', labelAr: 'إجمالي ضريبة القيمة المضافة المستردة', labelEn: 'Total VAT recoverable' },
  { key: 'net_vat', labelAr: 'صافي ضريبة القيمة المضافة', labelEn: 'Net VAT' },
  { key: 'prior_adjustments', labelAr: 'تصحيحات من الفترة السابقة', labelEn: 'Prior period adjustments' },
  { key: 'balance_carried', labelAr: 'رصيد مرحلة', labelEn: 'Balance carried forward' },
  { key: 'net_payable_refund', labelAr: 'صافي الضريبة المستحقة أو المطالب بها', labelEn: 'Net VAT payable or refundable', isFinal: true },
];

export function defaultDisclosureData() {
  const rows = [...OUTPUT_ROWS, ...INPUT_ROWS].filter((r) => !r.isTotal);
  const obj = {};
  rows.forEach((r) => {
    obj[r.key] = { amount: 0, adjustment: 0, vat: 0 };
  });
  SUMMARY_ROWS.forEach((r) => {
    obj[r.key] = 0;
  });
  return obj;
}

export function getRowValue(data, key, field) {
  const v = data[key];
  if (v && typeof v === 'object') return v[field] ?? 0;
  return typeof v === 'number' ? v : 0;
}

export function computeOutputTotal(data) {
  let sum = 0;
  OUTPUT_ROWS.filter((r) => !r.isTotal).forEach((r) => {
    sum += getRowValue(data, r.key, 'vat');
  });
  return sum;
}

export function computeInputTotal(data) {
  let sum = 0;
  INPUT_ROWS.filter((r) => !r.isTotal).forEach((r) => {
    sum += getRowValue(data, r.key, 'vat');
  });
  return sum;
}

export function computeNetPayable(data) {
  const outputTotal = computeOutputTotal(data);
  const inputTotal = computeInputTotal(data);
  const netVat = outputTotal - inputTotal;
  const priorAdj = getRowValue(data, 'prior_adjustments');
  const balanceCarried = getRowValue(data, 'balance_carried');
  return netVat + priorAdj + balanceCarried;
}

/**
 * دمج أرقام مستوردة من تقرير الضريبة في النظام (نفس شكل API tax-vat).
 */
export function mergeImportedDisclosure(stored, imported) {
  if (!imported || typeof imported !== 'object') return stored ? { ...stored } : defaultDisclosureData();
  const next = { ...(stored || defaultDisclosureData()) };
  const rowKeys = [...OUTPUT_ROWS, ...INPUT_ROWS].filter((r) => !r.isTotal).map((r) => r.key);
  for (const key of rowKeys) {
    if (imported[key] && typeof imported[key] === 'object') {
      next[key] = { ...(next[key] || { amount: 0, adjustment: 0, vat: 0 }), ...imported[key] };
    }
  }
  return next;
}

/**
 * ضبط مدخلات الضريبة (الخارج) لتتوافق مع صافي مستهدف = مبلغ الدفع المرغوب.
 * netPayable = output - input + prior + balance  →  input' = output + prior + balance - netPayableTarget
 */
export function scaleInputVatForPaymentTarget(data, paymentTarget) {
  const target = Number(paymentTarget);
  if (!Number.isFinite(target)) return { ...data };

  const outputTotal = computeOutputTotal(data);
  const priorAdj = getRowValue(data, 'prior_adjustments');
  const balanceCarried = getRowValue(data, 'balance_carried');
  const currentInput = computeInputTotal(data);

  const desiredInput = outputTotal + priorAdj + balanceCarried - target;

  if (desiredInput < 0) {
    const next = JSON.parse(JSON.stringify(data));
    INPUT_ROWS.filter((r) => !r.isTotal).forEach((r) => {
      if (next[r.key] && typeof next[r.key] === 'object') {
        next[r.key] = { ...next[r.key], vat: 0, amount: 0 };
      }
    });
    return next;
  }

  if (desiredInput === 0) {
    const next = JSON.parse(JSON.stringify(data));
    INPUT_ROWS.filter((r) => !r.isTotal).forEach((r) => {
      if (next[r.key] && typeof next[r.key] === 'object') {
        next[r.key] = { ...next[r.key], vat: 0, amount: 0 };
      }
    });
    return next;
  }

  if (currentInput <= 0) {
    const next = JSON.parse(JSON.stringify(data));
    const stdKey = 'standard_purchases';
    if (!next[stdKey] || typeof next[stdKey] !== 'object') {
      next[stdKey] = { amount: 0, adjustment: 0, vat: 0 };
    }
    next[stdKey] = {
      ...next[stdKey],
      vat: desiredInput,
      amount: +(desiredInput / 0.15).toFixed(4),
    };
    return next;
  }

  const factor = desiredInput / currentInput;
  const next = JSON.parse(JSON.stringify(data));
  INPUT_ROWS.filter((r) => !r.isTotal).forEach((r) => {
    const row = next[r.key];
    if (!row || typeof row !== 'object') return;
    const oldVat = Number(row.vat) || 0;
    const oldAmt = Number(row.amount) || 0;
    const newVat = oldVat * factor;
    row.vat = +newVat.toFixed(4);
    row.amount = oldAmt ? +(oldAmt * factor).toFixed(4) : +(newVat / 0.15).toFixed(4);
  });

  return next;
}

export function periodKeyFromQuarter(year, quarter) {
  return `${year}-Q${quarter}`;
}
