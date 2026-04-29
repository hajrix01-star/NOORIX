/**
 * أعمدة السجل — استخراج أرقام الإفصاح وحالة «تم التقديم» من صف VatPlanningQuarter.
 */
import {
  computeInputTotal,
  computeOutputTotal,
  defaultDisclosureData,
  getRowValue,
} from '../../constants/taxDisclosure';

export function registryPayload(row: any) {
  return row.payload && typeof row.payload === 'object' ? row.payload : defaultDisclosureData();
}

export function registrySalesAmount(payload: any) {
  return getRowValue(payload, 'standard_sales', 'amount');
}

export function registryPurchasesAmount(payload: any) {
  return getRowValue(payload, 'standard_purchases', 'amount');
}

export function registryOutputVat(payload: any) {
  return computeOutputTotal(payload);
}

export function registryInputVat(payload: any) {
  return computeInputTotal(payload);
}

/** يُعرض «تم التقديم» إذا وُجدت إشارة في الملاحظات أو لقطة المصدر أو زرع الأرشيف */
export function isHajriDeclarationSubmitted(row: any): boolean {
  const notes = row.notes || '';
  if (/مقدَّم|مقدم|تم التقديم|submitted|filed/i.test(notes)) return true;
  const ss = row.sourceSnapshot;
  if (ss && typeof ss === 'object') {
    if (ss.submitted === true) return true;
    if (ss.source === 'seed-vat-planning-history') return true;
  }
  return false;
}
