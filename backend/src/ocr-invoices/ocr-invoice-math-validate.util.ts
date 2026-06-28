/** التحقق الرياضي لأصناف وإجمالي الفواتير (OCR) */
import { TAX_RATE } from '../common/utils/math-engine';

export interface MathValidationResult {
  valid: boolean;
  warning?: string;
  suggestedQuantity?: number;
  suggestedUnitPrice?: number;
}

export type OcrLineTaxMode = 'exclusive' | 'inclusive' | 'unknown';

export const SAUDI_VAT_RATE = TAX_RATE.toNumber();

function amountTolerance(base: number): number {
  return Math.max(Math.abs(base), 1) * 0.03;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function reconcileLineAmountsForTaxMode(
  quantity?: number,
  unitPrice?: number,
  totalPrice?: number,
  lineTaxMode: OcrLineTaxMode = 'unknown',
  vatRate = SAUDI_VAT_RATE,
): { unitPrice?: number; totalPrice?: number; reconciled: boolean } {
  if (!quantity || !unitPrice || !totalPrice || lineTaxMode === 'unknown') {
    return { unitPrice, totalPrice, reconciled: false };
  }

  const mathResult = validateItemMath(quantity, unitPrice, totalPrice);
  if (mathResult.valid) {
    return { unitPrice, totalPrice, reconciled: false };
  }

  // Prefer quantity correction when the mismatch is clearly a quantity issue.
  if (mathResult.suggestedQuantity !== undefined) {
    return { unitPrice, totalPrice, reconciled: false };
  }

  const netLineTotal = quantity * unitPrice;
  const grossFromNet = netLineTotal * (1 + vatRate);
  const totalTol = amountTolerance(totalPrice);

  if (lineTaxMode === 'inclusive') {
    if (Math.abs(grossFromNet - totalPrice) <= totalTol) {
      return {
        unitPrice: roundMoney(totalPrice / quantity),
        totalPrice,
        reconciled: true,
      };
    }
  }

  if (lineTaxMode === 'exclusive') {
    if (Math.abs(grossFromNet - totalPrice) <= totalTol) {
      return {
        unitPrice,
        totalPrice: roundMoney(netLineTotal),
        reconciled: true,
      };
    }
  }

  return { unitPrice, totalPrice, reconciled: false };
}

export function validateItemMath(
  quantity?: number,
  unitPrice?: number,
  totalPrice?: number,
): MathValidationResult {
  if (!quantity || !unitPrice || !totalPrice) return { valid: true };

  const computed = quantity * unitPrice;
  const tolerance = Math.max(computed, totalPrice) * 0.03; // 3% هامش

  if (Math.abs(computed - totalPrice) <= tolerance) return { valid: true };

  // totalPrice هو المرجع الأوثق — احسب البديل
  const inferredQty = totalPrice / unitPrice;
  const inferredPrice = totalPrice / quantity;

  if (inferredQty > 0 && Math.abs(inferredQty - Math.round(inferredQty)) < 0.05) {
    return {
      valid: false,
      warning: `${quantity} × ${unitPrice} = ${computed.toFixed(2)} ≠ ${totalPrice} — الكمية المحتملة: ${Math.round(inferredQty)}`,
      suggestedQuantity: Math.round(inferredQty),
    };
  }

  return {
    valid: false,
    warning: `${quantity} × ${unitPrice} = ${computed.toFixed(2)} ≠ ${totalPrice} — السعر المحتمل: ${inferredPrice.toFixed(2)}`,
    suggestedUnitPrice: Math.round(inferredPrice * 100) / 100,
  };
}

/**
 * يتحقق من توافق مجموع الأصناف مع إجمالي الفاتورة.
 */
export function validateInvoiceTotals(
  itemsTotal: number,
  totalAmount?: number,
  vatAmount?: number,
  subtotalAmount?: number,
): { valid: boolean; warning?: string; vatAdjusted: boolean; lineTaxMode: OcrLineTaxMode } {
  if (!totalAmount || itemsTotal === 0) {
    return { valid: true, vatAdjusted: false, lineTaxMode: 'unknown' };
  }

  const T = 0.05; // هامش 5%

  if (subtotalAmount && subtotalAmount > 0) {
    const subtotalTol = subtotalAmount * T;
    if (Math.abs(itemsTotal - subtotalAmount) <= subtotalTol) {
      return { valid: true, vatAdjusted: true, lineTaxMode: 'exclusive' };
    }
    const totalTol = totalAmount * T;
    if (Math.abs(itemsTotal - totalAmount) <= totalTol) {
      return { valid: true, vatAdjusted: false, lineTaxMode: 'inclusive' };
    }
    return {
      valid: false,
      vatAdjusted: true,
      lineTaxMode: 'unknown',
      warning: `مجموع الأصناف ${itemsTotal.toFixed(2)} لا يطابق المجموع قبل الضريبة ${subtotalAmount.toFixed(2)} ولا الإجمالي ${totalAmount.toFixed(2)}`,
    };
  }

  if (vatAmount && vatAmount > 0) {
    const expectedSubtotal = totalAmount - vatAmount;
    const tol = Math.max(expectedSubtotal, itemsTotal) * T;
    if (Math.abs(itemsTotal - expectedSubtotal) <= tol) {
      return { valid: true, vatAdjusted: true, lineTaxMode: 'exclusive' };
    }
    if (Math.abs(itemsTotal - totalAmount) <= totalAmount * T) {
      return { valid: true, vatAdjusted: false, lineTaxMode: 'inclusive' };
    }
    return {
      valid: false,
      vatAdjusted: true,
      lineTaxMode: 'unknown',
      warning: `مجموع الأصناف ${itemsTotal.toFixed(2)} ≠ المجموع قبل الضريبة المحسوب (${totalAmount} - ${vatAmount} = ${expectedSubtotal.toFixed(2)})`,
    };
  }

  const tol = totalAmount * T;
  if (Math.abs(itemsTotal - totalAmount) <= tol) {
    return { valid: true, vatAdjusted: false, lineTaxMode: 'unknown' };
  }
  return {
    valid: false,
    vatAdjusted: false,
    lineTaxMode: 'unknown',
    warning: `مجموع الأصناف ${itemsTotal.toFixed(2)} لا يتطابق مع إجمالي الفاتورة ${totalAmount}`,
  };
}
