/**
 * Company insight thresholds — GET/PATCH/POST reset → /api/v1/reporting/insights/thresholds*
 */
import type { ApiParsedResult } from '../types/api';
import { apiGet, apiPatch, apiPost } from './core/apiHttp';

export type PurchaseExpenseThresholdBand = {
  warning: number;
  critical: number;
};

export type NetProfitMarginThresholdBand = {
  warningBelow: number;
  criticalBelow: number;
};

export type CompanyInsightThresholdsPayload = {
  purchaseToSales: PurchaseExpenseThresholdBand;
  expenseToSales: PurchaseExpenseThresholdBand;
  netProfitMargin: NetProfitMarginThresholdBand;
};

export type PatchInsightThresholdsPayload = {
  companyId: string;
  purchaseToSales?: Partial<PurchaseExpenseThresholdBand>;
  expenseToSales?: Partial<PurchaseExpenseThresholdBand>;
  netProfitMargin?: Partial<NetProfitMarginThresholdBand>;
};

export type GetInsightThresholdsResult = {
  companyId: string;
  thresholds: CompanyInsightThresholdsPayload;
};

export async function getInsightThresholds(companyId: string): Promise<ApiParsedResult<GetInsightThresholdsResult>> {
  return apiGet('/api/v1/reporting/insights/thresholds', { companyId });
}

export async function patchInsightThresholds(
  body: PatchInsightThresholdsPayload,
): Promise<ApiParsedResult<GetInsightThresholdsResult>> {
  return apiPatch('/api/v1/reporting/insights/thresholds', body);
}

export async function resetInsightThresholds(companyId: string): Promise<ApiParsedResult<GetInsightThresholdsResult>> {
  return apiPost('/api/v1/reporting/insights/thresholds/reset', { companyId });
}
