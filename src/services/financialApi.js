/**
 * financialApi — عمليات مالية (سلفيات، رواتب، إلخ)
 */
import { createInvoice } from './api';
import { getSaudiToday } from '../utils/saudiDate';

/**
 * صرف سلفة لموظف
 * @param {{ employeeId: string, companyId: string, vaultId: string, amount: number, transactionDate?: string, notes?: string, employeeName?: string, installmentCount?: number, installmentAmount?: number }} params
 */
export async function createAdvance({ employeeId, companyId, vaultId, amount, transactionDate, notes, employeeName, installmentCount, installmentAmount }) {
  const date = transactionDate || getSaudiToday();
  const autoNote = employeeName ? `سلفة — ${employeeName}` : 'سلفة';
  const payload = {
    companyId,
    employeeId,
    vaultId,
    kind: 'advance',
    totalAmount: Number(amount),
    netAmount: Number(amount),
    taxAmount: 0,
    transactionDate: date,
    notes: notes || autoNote,
  };
  if (installmentCount && installmentCount > 1) {
    payload.installmentCount = installmentCount;
    payload.installmentAmount = installmentAmount ?? Math.ceil((Number(amount) / installmentCount) * 100) / 100;
  }
  return createInvoice(payload);
}
