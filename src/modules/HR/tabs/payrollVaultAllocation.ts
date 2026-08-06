import type { PayrollVaultSplit } from './payrollTabModel';

export type PayrollVaultAllocationRow = {
  id: string;
  vaultId: string;
  amount: string;
};

export type PayrollVaultAllocationSummary = {
  totalMinor: number;
  allocatedMinor: number;
  remainingMinor: number;
  isExact: boolean;
};

export type PayrollVaultAllocationValidation =
  | { valid: true; vaultSplits: PayrollVaultSplit[] }
  | { valid: false; reason: 'incomplete' | 'duplicate' | 'total-mismatch' };

export function payrollMoneyToMinor(value: unknown): number {
  const amount = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

export function payrollMoneyInputFromMinor(minor: number): string {
  const safeMinor = Math.max(0, Math.round(minor));
  return (safeMinor / 100).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

export function summarizePayrollVaultAllocations(
  total: number,
  rows: Pick<PayrollVaultAllocationRow, 'amount'>[],
): PayrollVaultAllocationSummary {
  const totalMinor = payrollMoneyToMinor(total);
  const allocatedMinor = rows.reduce((sum, row) => sum + payrollMoneyToMinor(row.amount), 0);
  const remainingMinor = totalMinor - allocatedMinor;

  return {
    totalMinor,
    allocatedMinor,
    remainingMinor,
    isExact: totalMinor > 0 && remainingMinor === 0,
  };
}

export function validatePayrollVaultAllocations(
  total: number,
  rows: PayrollVaultAllocationRow[],
): PayrollVaultAllocationValidation {
  if (
    rows.length === 0
    || rows.some((row) => !row.vaultId.trim() || payrollMoneyToMinor(row.amount) <= 0)
  ) {
    return { valid: false, reason: 'incomplete' };
  }

  const vaultIds = rows.map((row) => row.vaultId.trim());
  if (new Set(vaultIds).size !== vaultIds.length) {
    return { valid: false, reason: 'duplicate' };
  }

  const summary = summarizePayrollVaultAllocations(total, rows);
  if (!summary.isExact) return { valid: false, reason: 'total-mismatch' };

  return {
    valid: true,
    vaultSplits: rows.map((row) => ({
      vaultId: row.vaultId.trim(),
      amount: payrollMoneyToMinor(row.amount) / 100,
    })),
  };
}
