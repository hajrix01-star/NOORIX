import type { AdvanceSettlementStatus } from './hrCalculations/advances';

export type AdvanceRow = Record<string, unknown> & {
  id?: string | null;
  employeeId?: string | null;
  employeeName?: string | null;
  invoiceNumber?: string | null;
  transactionDate?: string | null;
  totalAmount?: number | string | null;
  totalAmountNum?: number;
  settledAmountNum?: number;
  remainingAmount?: number;
  installmentCount?: number;
  installmentAmount?: number | string | null;
  settledAt?: string | null;
  settlementStatus: AdvanceSettlementStatus | string;
};

export type AdvanceGroupRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  advances: AdvanceRow[];
  totalAmount: number;
  totalAmountNum: number;
  settledAmountNum: number;
  remainingAmount: number;
  transactionDate: string;
  advanceCount: number;
  outstandingCount: number;
  partialCount: number;
  settledCount: number;
  settlementStatus: Exclude<AdvanceSettlementStatus, 'cancelled'>;
};

export function buildGroupedAdvanceRows(
  rows: AdvanceRow[],
  sortKey: string,
  sortDir: string,
  locale: string,
): AdvanceGroupRow[] {
  const groups = new Map<string, Omit<AdvanceGroupRow, 'settlementStatus'>>();
  for (const row of rows) {
    const employeeId = String(row.employeeId || row.employeeName || 'unknown');
    const existing: Omit<AdvanceGroupRow, 'settlementStatus'> = groups.get(employeeId) || {
      id: employeeId,
      employeeId,
      employeeName: row.employeeName || '—',
      advances: [],
      totalAmount: 0,
      totalAmountNum: 0,
      settledAmountNum: 0,
      remainingAmount: 0,
      transactionDate: '',
      advanceCount: 0,
      outstandingCount: 0,
      partialCount: 0,
      settledCount: 0,
    };
    existing.advances.push(row);
    existing.totalAmount += Number(row.totalAmountNum ?? row.totalAmount ?? 0);
    existing.totalAmountNum = existing.totalAmount;
    existing.settledAmountNum += Number(row.settledAmountNum || 0);
    existing.remainingAmount += Number(row.remainingAmount || 0);
    existing.advanceCount += 1;
    if (!existing.transactionDate || String(row.transactionDate || '') > existing.transactionDate) {
      existing.transactionDate = String(row.transactionDate || '');
    }
    if (row.settlementStatus === 'outstanding') existing.outstandingCount += 1;
    if (row.settlementStatus === 'partial') existing.partialCount += 1;
    if (row.settlementStatus === 'settled') existing.settledCount += 1;
    groups.set(employeeId, existing);
  }

  const groupedRows: AdvanceGroupRow[] = [...groups.values()].map((group) => ({
    ...group,
    settlementStatus: group.remainingAmount <= 0
      ? 'settled'
      : group.settledAmountNum > 0
        ? 'partial'
        : 'outstanding',
  }));

  return groupedRows.sort((a, b) => {
    let cmp = 0;
    if (sortKey === 'employeeName') cmp = String(a.employeeName || '').localeCompare(String(b.employeeName || ''), locale);
    else if (sortKey === 'totalAmount') cmp = Number(a.totalAmount || 0) - Number(b.totalAmount || 0);
    else if (sortKey === 'settledAmount') cmp = Number(a.settledAmountNum || 0) - Number(b.settledAmountNum || 0);
    else if (sortKey === 'remainingAmount') cmp = Number(a.remainingAmount || 0) - Number(b.remainingAmount || 0);
    else cmp = new Date(a.transactionDate || 0).getTime() - new Date(b.transactionDate || 0).getTime();
    return sortDir === 'asc' ? cmp : -cmp;
  });
}
