import { describe, it, expect } from 'vitest';
import {
  PAGE_SIZE,
  MAX_VAULT_SLOTS,
  vaultTypeLabelForExport,
  getAllocationsForExport,
} from './invoicesListScreenHelpers';

const LABELS: Record<string, string> = { vaultTypeCash: 'نقد', vaultTypeBank: 'بنك', vaultTypeApp: 'تطبيق' };
const t = (k: any) => LABELS[String(k)] || k;

describe('invoicesListScreenHelpers', () => {
  it('exports pagination constants', () => {
    expect(PAGE_SIZE).toBe(50);
    expect(MAX_VAULT_SLOTS).toBe(5);
  });

  it('vaultTypeLabelForExport maps known types', () => {
    expect(vaultTypeLabelForExport('cash', t)).toBe('نقد');
    expect(vaultTypeLabelForExport('bank', t)).toBe('بنك');
    expect(vaultTypeLabelForExport('unknown', t)).toBe('unknown');
    expect(vaultTypeLabelForExport('', t)).toBe('—');
  });

  it('getAllocationsForExport uses vaultAllocations when present', () => {
    const inv = {
      totalAmount: 100,
      vaultAllocations: [
        {
          id: 'a1',
          amount: 40,
          vault: { nameAr: 'خ1', nameEn: 'V1', type: 'cash' },
        },
        {
          id: 'a2',
          amount: 60,
          vault: { nameAr: 'خ2', type: 'bank' },
        },
      ],
    };
    const rows = getAllocationsForExport(inv, 'ar', t);
    expect(rows).toHaveLength(2);
    expect(rows[0].type).toBe('نقد');
    expect(rows[0].amount).toBe(40);
    expect(rows[1].type).toBe('بنك');
  });

  it('getAllocationsForExport falls back to single vault', () => {
    const inv = {
      totalAmount: 200,
      vault: { nameAr: 'رئيسي', type: 'app' },
    };
    const rows = getAllocationsForExport(inv, 'ar', t);
    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBe(200);
    expect(rows[0].type).toBe('تطبيق');
  });
});
