import type { ApiParsedResult, LoanCreatePayload, LoanPaymentCreatePayload, LoanPaymentRecord, LoanPaymentReversePayload, LoanRecord } from '../../../types/api';
import { apiGet, apiPost } from '../../core/apiHttp';

export async function getLoans(companyId: string): Promise<ApiParsedResult<LoanRecord[]>> {
  const result = await apiGet<LoanRecord[]>('/api/v1/loans', { companyId });
  if (!result.success) return result;
  return { success: true, data: Array.isArray(result.data) ? result.data : [] };
}

export function createLoan(body: LoanCreatePayload): Promise<ApiParsedResult<LoanRecord>> {
  // الشركة تؤخذ من x-company-id في الجلسة؛ لا تُرسل داخل DTO لأن الخادم
  // يرفض الحقول الزائدة لحماية عزل الشركات.
  const { companyId: _companyId, ...dto } = body;
  return apiPost('/api/v1/loans', dto);
}

export function createLoanPayment(loanId: string, body: LoanPaymentCreatePayload): Promise<ApiParsedResult<LoanPaymentRecord>> {
  const { companyId: _companyId, ...dto } = body;
  return apiPost(`/api/v1/loans/${loanId}/payments`, dto);
}

export function reverseLoanPayment(loanId: string, paymentId: string, body: LoanPaymentReversePayload): Promise<ApiParsedResult<LoanPaymentRecord>> {
  const { companyId: _companyId, ...dto } = body;
  return apiPost(`/api/v1/loans/${loanId}/payments/${paymentId}/reverse`, dto);
}

export function migrateLoanLegacyInvoices(loanId: string, body: { companyId: string; expenseLineId: string; archiveExpenseLine?: boolean }): Promise<ApiParsedResult<{ created: number; alreadyLinked: number; total: number; archivedExpenseLine: boolean }>> {
  const { companyId: _companyId, ...dto } = body;
  return apiPost(`/api/v1/loans/${loanId}/legacy-expense-invoices`, dto);
}

export function convertLoanLegacyInvoices(loanId: string): Promise<ApiParsedResult<{ converted: number; invoiceCount: number; totalAmount: string; outstandingAmount: string; alreadyConverted: boolean }>> {
  return apiPost(`/api/v1/loans/${loanId}/legacy-expense-invoices/convert`, {});
}
