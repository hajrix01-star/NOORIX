import { inferBankReconciliationEnabled } from './vault-bank-reconciliation.util';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('inferBankReconciliationEnabled', () => {
  it.each([
    [{ type: 'bank' }],
    [{ type: 'app' }],
    [{ type: 'cash', nameAr: 'بنك التشغيل' }],
    [{ type: 'cash', nameEn: 'Mada Terminal' }],
    [{ type: 'cash', paymentMethod: 'mada' }],
  ])('freezes a bank-like vault classification at creation', (vault) => {
    expect(inferBankReconciliationEnabled(vault)).toBe(true);
  });

  it('does not classify an ordinary cash vault', () => {
    expect(inferBankReconciliationEnabled({ type: 'cash', nameAr: 'الصندوق', paymentMethod: 'cash' }))
      .toBe(false);
  });

  it('keeps the legacy migration aligned with the English Mada classification', () => {
    const migration = readFileSync(resolve(
      __dirname,
      '../../prisma/migrations/20260808120000_add_vault_transfer_vouchers/migration.sql',
    ), 'utf8');
    expect(migration).toContain(`LOWER(COALESCE("name_en", '')) LIKE '%mada%'`);
  });
});
