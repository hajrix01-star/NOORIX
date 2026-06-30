/**
 * useBatchCalculation — Hook مركزي لحسابات دفعات المشتريات.
 * يستخدم math-engine كمصدر وحيد للحسابات.
 */
import { useMemo } from 'react';
import Decimal from 'decimal.js';
import {
  calculatePurchaseBatchSummary,
  sumAmounts,
  TAX_RATE,
} from '@noorix/finance-core';

/**
 * حساب ملخص صفوف الدفعة (net, tax, total, count).
 * @param rows - صفوف الإدخال.
 * @param batchNotes - ملاحظة الدفعة التي قد تجعل المصروف/المصروف الثابت صالحاً.
 * @param vatRateDecimal - نسبة ضريبة الشركة (افتراضي 15%)
 */
export function useBatchSummary(rows: any, vatRateDecimal: number = TAX_RATE, batchNotes = '') {
  return useMemo(() => {
    const summary = calculatePurchaseBatchSummary(rows || [], batchNotes.trim(), vatRateDecimal);
    const net = new Decimal(summary.net);
    const tax = new Decimal(summary.tax);
    const total = new Decimal(summary.total);
    const count = summary.count;
    return { net, tax, total, count };
  }, [rows, vatRateDecimal, batchNotes]);
}

/** @deprecated use useBatchSummary — kept for barrel compatibility */
export { sumAmounts };
