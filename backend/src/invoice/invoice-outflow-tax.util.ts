import Decimal from 'decimal.js';
import {
  resolveVatRateDecimal,
  splitTaxBalancedHalalas,
} from '@noorix/finance-core';

/**
 * صافي + ضريبة لفاتورة صرف (مشتريات/مصروفات) من إجمالي شامل — متوازن + نسبة الشركة.
 */
export function computeOutflowNetTaxFromTotal(
  totalInclusive: string | number | Decimal,
  isTaxable = true,
  vatRatePercent?: number | string | Decimal | null,
): { net: string; tax: string } {
  const gross = new Decimal(String(totalInclusive));
  if (!isTaxable || gross.lte(0)) {
    return { net: gross.toFixed(4), tax: '0.0000' };
  }
  const rate = resolveVatRateDecimal(vatRatePercent);
  const { net, tax } = splitTaxBalancedHalalas(gross, rate);
  return { net: net.toFixed(4), tax: tax.toFixed(4) };
}
