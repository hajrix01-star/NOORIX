/**
 * useBatchCalculation — Hook مركزي لحسابات دفعات المشتريات.
 * يستخدم math-engine كمصدر وحيد للحسابات.
 */
import { useMemo } from 'react';
import Decimal from 'decimal.js';
import { sumAmounts, splitTaxFromTotal } from '../utils/math-engine';

/**
 * حساب ملخص صفوف الدفعة (net, tax, total, count).
 * @param {Array<object>} rows - صفوف الإدخال (كل صف: totalInclusive, supplierId, invoiceNumber, isTaxable)
 * @returns {{ net: Decimal, tax: Decimal, total: Decimal, count: number }}
 */
export function useBatchSummary(rows) {
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
          const { net: n, tax: tx } = splitTaxFromTotal(t, taxable);
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
  }, [rows]);
}
