import Decimal from 'decimal.js';

/** بند مصروف ثابت كما يعيده GET /expense-lines */
export type ExpenseLineFixedRow = {
  kind?: string;
  nameAr?: string | null;
  nameEn?: string | null;
  annualTotalAmount?: unknown;
  referenceAmount?: unknown;
  installmentIntervalMonths?: unknown;
};

/**
 * مكافئ شهري لبند مصروف ثابت (للحاسبة التقديرية).
 * - إن وُجد إجمالي سنوي موجب: ÷ 12
 * - وإلا مبلغ الدفعة المرجعي ÷ أشهر الفترة بين الدفعات (متوسط شهري داخل الدورة)
 * - وإلا مبلغ مرجعي بدون فترة: يُفترض أنه شهري
 */
export function monthlyAmountFromExpenseLine(line: ExpenseLineFixedRow | null | undefined): Decimal | null {
  if (!line || line.kind !== 'fixed_expense') return null;

  const annRaw = line.annualTotalAmount;
  if (annRaw != null && annRaw !== '') {
    try {
      const a = new Decimal(String(annRaw));
      if (a.gt(0)) return a.div(12);
    } catch {
      /* fall through */
    }
  }

  const refRaw = line.referenceAmount;
  if (refRaw == null || refRaw === '') return null;
  try {
    const ref = new Decimal(String(refRaw));
    if (ref.lt(0)) return null;
    const interval = Number(line.installmentIntervalMonths);
    if (Number.isFinite(interval) && interval > 0) {
      return ref.div(interval);
    }
    return ref.gt(0) ? ref : null;
  } catch {
    return null;
  }
}
