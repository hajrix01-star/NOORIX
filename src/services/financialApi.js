/**
 * financialApi — عمليات مالية (سلفيات، رواتب، إلخ)
 */
import { createInvoice } from './api';
import { getSaudiToday } from '../utils/saudiDate';

/**
 * صرف سلفة لموظف
 * @param {{ employeeId: string, companyId: string, vaultId: string, amount: number, transactionDate?: string, notes?: string, employeeName?: string }} params
 */
export async function createAdvance({ employeeId, companyId, vaultId, amount, transactionDate, notes, employeeName }) {
  const date = transactionDate || getSaudiToday();
  const autoNote = employeeName ? `سلفة — ${employeeName}` : 'سلفة';
  return createInvoice({
    companyId,
    employeeId,
    vaultId,
    kind: 'advance',
    totalAmount: Number(amount),
    netAmount: Number(amount),
    taxAmount: 0,
    transactionDate: date,
    notes: notes || autoNote,
  });
}
