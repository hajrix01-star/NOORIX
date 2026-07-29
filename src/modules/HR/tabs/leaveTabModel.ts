import type { QueryClient } from '@tanstack/react-query';
import { getSaudiToday, toDateInputYmd } from '../../../utils/saudiDate';
import { invalidateOnFinancialMutation } from '../../../utils/queryInvalidation';
import { employeeKeys, hrKeys } from '../../../services/queryKeys';

export const LEAVE_PAGE_SIZE = 50;

export const LEAVE_TYPE_MAP = {
  annual: 'leaveAnnual',
  sick: 'leaveSick',
  unpaid: 'leaveUnpaid',
  other: 'leaveOther',
};

export type HrLeaveRow = {
  id: string;
  employeeId?: string;
  employee?: unknown;
  employeeName?: string;
  leaveType?: keyof typeof LEAVE_TYPE_MAP | string;
  startDate?: string;
  endDate?: string;
  daysCount?: number | string | null;
  status?: string;
  salarySettlement?: unknown;
};

export type LeaveReturnMutationPayload = {
  id: string;
  actualReturnDate: string;
};

export type DeleteLeavePayload = string | {
  id: string;
  voidSettlement?: boolean;
};

export type LeaveSettlementPreview = {
  suggestedAmount?: number;
  calendarDaysPaid?: number;
  daysInMonth?: number;
};

export type IssueSettlementPayload = {
  id: string;
  grossAmount: string;
  manualOverrideReason?: string;
};

export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function canShowLeaveReturnRow(row: HrLeaveRow) {
  if (row.status !== 'approved') return false;
  const today = getSaudiToday();
  const startDate = toDateInputYmd(row.startDate);
  const endDate = toDateInputYmd(row.endDate);
  return today >= startDate && today <= endDate;
}

export function canShowSalarySettlement(row: HrLeaveRow) {
  return row.status === 'approved' && row.leaveType === 'annual' && !row.salarySettlement;
}

export function invalidateAfterLeaveFormModalSuccess(queryClient: QueryClient, companyId: string, year: number) {
  if (!queryClient || !companyId) return;
  queryClient.invalidateQueries({ queryKey: hrKeys.leaves(companyId) });
  queryClient.invalidateQueries({ queryKey: hrKeys.leavesForYear(companyId, year) });
  queryClient.invalidateQueries({ queryKey: hrKeys.leaveSalarySettlements(companyId) });
  queryClient.invalidateQueries({ queryKey: employeeKeys.list(companyId, false) });
  queryClient.invalidateQueries({ queryKey: employeeKeys.byCompany(companyId) });
  invalidateOnFinancialMutation(queryClient);
}
