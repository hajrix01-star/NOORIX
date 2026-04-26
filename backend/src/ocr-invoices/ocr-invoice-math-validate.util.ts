/** التحقق الرياضي لأصناف وإجمالي الفواتير (OCR) */

export interface MathValidationResult {
  valid: boolean;
  warning?: string;
  suggestedQuantity?: number;
  suggestedUnitPrice?: number;
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
): { valid: boolean; warning?: string; vatAdjusted: boolean } {
  if (!totalAmount || itemsTotal === 0) return { valid: true, vatAdjusted: false };

  const T = 0.05; // هامش 5%

  if (subtotalAmount && subtotalAmount > 0) {
    const tol = subtotalAmount * T;
    if (Math.abs(itemsTotal - subtotalAmount) <= tol) return { valid: true, vatAdjusted: true };
    return {
      valid: false,
      vatAdjusted: true,
      warning: `مجموع الأصناف ${itemsTotal.toFixed(2)} ≠ المجموع قبل الضريبة ${subtotalAmount.toFixed(2)}`,
    };
  }

  if (vatAmount && vatAmount > 0) {
    const expectedSubtotal = totalAmount - vatAmount;
    const tol = Math.max(expectedSubtotal, itemsTotal) * T;
    if (Math.abs(itemsTotal - expectedSubtotal) <= tol) return { valid: true, vatAdjusted: true };
    if (Math.abs(itemsTotal - totalAmount) <= totalAmount * T) return { valid: true, vatAdjusted: false };
    return {
      valid: false,
      vatAdjusted: true,
      warning: `مجموع الأصناف ${itemsTotal.toFixed(2)} ≠ المجموع قبل الضريبة المحسوب (${totalAmount} - ${vatAmount} = ${expectedSubtotal.toFixed(2)})`,
    };
  }

  const tol = totalAmount * T;
  if (Math.abs(itemsTotal - totalAmount) <= tol) return { valid: true, vatAdjusted: false };
  return {
    valid: false,
    vatAdjusted: false,
    warning: `مجموع الأصناف ${itemsTotal.toFixed(2)} لا يتطابق مع إجمالي الفاتورة ${totalAmount}`,
  };
}
