import type { ApiParsedResult, LoanCreatePayload, LoanPaymentCreatePayload, LoanPaymentRecord, LoanPaymentReversePayload, LoanRecord } from '../../../types/api';
import { apiGet, apiPost } from '../../core/apiHttp';

export async function getLoans(companyId: string): Promise<ApiParsedResult<LoanRecord[]>> {
  const result = await apiGet<LoanRecord[]>('/api/v1/loans', { companyId });
  if (!result.success) return result;
  return { success: true, data: Array.isArray(result.data) ? result.data : [] };
}

export function createLoan(body: LoanCreatePayload): Promise<ApiParsedResult<LoanRecord>> {
  return apiPost('/api/v1/loans', body);
}

export function createLoanPayment(loanId: string, body: LoanPaymentCreatePayload): Promise<ApiParsedResult<LoanPaymentRecord>> {
  return apiPost(`/api/v1/loans/${loanId}/payments`, body);
}

export function reverseLoanPayment(loanId: string, paymentId: string, body: LoanPaymentReversePayload): Promise<ApiParsedResult<LoanPaymentRecord>> {
  return apiPost(`/api/v1/loans/${loanId}/payments/${paymentId}/reverse`, body);
}
