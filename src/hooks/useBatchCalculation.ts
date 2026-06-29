/**
 * useBatchCalculation — Hook مركزي لحسابات دفعات المشتريات.
 * يستخدم math-engine كمصدر وحيد للحسابات.
 */
import { useMemo } from 'react';
import Decimal from 'decimal.js';
import { sumAmounts, splitTaxFromTotalAsNumbers, TAX_RATE } from '@noorix/finance-core';

/**
 * حساب ملخص صفوف الدفعة (net, tax, total, count).
 * @param rows - صفوف الإدخال (كل صف: totalInclusive, supplierId, invoiceNumber, isTaxable)
 * @param vatRateDecimal - نسبة ضريبة الشركة (افتراضي 15%)
 */
export function useBatchSummary(rows: any, vatRateDecimal: number = TAX_RATE) {
  return useMemo(() => {
    let net = new Decimal(0);
    let tax = new Decimal(0);
    let total = new Decimal(0);
    let count = 0;
    for (const r of rows) {
      try {
        const t = new Decimal(r.totalInclusive || 0);
        if (t.gt(0) && r.supplierId && r.invoiceNumber) {
          const taxable = r.isTaxable !== false;
          const { net: n, tax: tx } = splitTaxFromTotalAsNumbers(t, taxable, vatRateDecimal);
          net = net.plus(n);
          tax = tax.plus(tx);
          total = total.plus(t);
          count++;
        }
      } catch {
        /* skip invalid row */
      }
    }
    return { net, tax, total, count };
  }, [rows, vatRateDecimal]);
}

/** @deprecated use useBatchSummary — kept for barrel compatibility */
export { sumAmounts };
