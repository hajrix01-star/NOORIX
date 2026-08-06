import { describe, expect, it } from 'vitest';
import {
  payrollMoneyInputFromMinor,
  summarizePayrollVaultAllocations,
  validatePayrollVaultAllocations,
} from './payrollVaultAllocation';

describe('payroll vault allocation', () => {
  it('calculates the exact remaining amount in minor units', () => {
    const summary = summarizePayrollVaultAllocations(16_151, [
      { amount: '5000' },
      { amount: '11151' },
    ]);

    expect(summary).toEqual({
      totalMinor: 1_615_100,
      allocatedMinor: 1_615_100,
      remainingMinor: 0,
      isExact: true,
    });
  });

  it('keeps decimal calculations exact and formats a suggested remainder', () => {
    const summary = summarizePayrollVaultAllocations(100.1, [{ amount: '40.05' }]);

    expect(summary.remainingMinor).toBe(6005);
    expect(payrollMoneyInputFromMinor(summary.remainingMinor)).toBe('60.05');
  });

  it('rejects duplicate vaults and mismatched totals', () => {
    expect(validatePayrollVaultAllocations(100, [
      { id: '1', vaultId: 'vault-a', amount: '40' },
      { id: '2', vaultId: 'vault-a', amount: '60' },
    ])).toEqual({ valid: false, reason: 'duplicate' });

    expect(validatePayrollVaultAllocations(100, [
      { id: '1', vaultId: 'vault-a', amount: '90' },
    ])).toEqual({ valid: false, reason: 'total-mismatch' });
  });

  it('returns normalized splits when every row is complete', () => {
    expect(validatePayrollVaultAllocations(100, [
      { id: '1', vaultId: ' vault-a ', amount: '25.5' },
      { id: '2', vaultId: 'vault-b', amount: '74.50' },
    ])).toEqual({
      valid: true,
      vaultSplits: [
        { vaultId: 'vault-a', amount: 25.5 },
        { vaultId: 'vault-b', amount: 74.5 },
      ],
    });
  });
});
