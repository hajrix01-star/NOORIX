import type { ApiParsedResult } from '../../../types/api';
import { apiGet } from '../../core/apiHttp';

export type DashboardLedgerReconciliationDimension = {
  key: 'sales' | 'purchases' | 'expenses' | 'operatingCosts' | 'operatingResult';
  currentValue: string;
  ledgerValue: string;
  delta: string;
  matches: boolean;
};

export type DashboardLedgerReconciliation = {
  source: 'read_only_ledger_reconciliation_v1';
  period: { startDate: string; endDate: string };
  ledger: { coverage: { unclassifiedRowCount: number; classifiedPct: number | null } };
  dimensions: DashboardLedgerReconciliationDimension[];
  readyForCutover: boolean;
};

export function getDashboardLedgerReconciliation(params: {
  companyId: string;
  startDate: string;
  endDate: string;
}): Promise<ApiParsedResult<DashboardLedgerReconciliation>> {
  return apiGet('/api/v1/dashboard/ledger-reconciliation', params);
}
