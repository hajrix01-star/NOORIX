import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Orders V4 inventory boundary', () => {
  it('allows inventory-ledger writes only through the central posting service', () => {
    const offenders = readdirSync(__dirname)
      .filter((name) => name.endsWith('.ts') && !name.endsWith('.spec.ts'))
      .filter((name) => name !== 'orders-v4-ledger-posting.service.ts')
      .filter((name) => readFileSync(join(__dirname, name), 'utf8').includes('ordersV4InventoryLedgerEntry.create'));

    expect(offenders).toEqual([]);
  });

  it('keeps conversion and inventory arithmetic in the central kernels', () => {
    const allowed = new Set([
      'orders-v4-calculation.kernel.ts',
      'orders-v4-conversion.kernel.ts',
      'orders-v4-ledger-posting.service.ts',
    ]);
    const forbiddenPatterns = [
      /quantityAfter\s*=.*\.(plus|minus|times|div)\(/,
      /valueAfter\s*=.*\.(plus|minus|times|div)\(/,
      /averageUnitCostAfter\s*=.*\.(plus|minus|times|div)\(/,
    ];
    const offenders = readdirSync(__dirname)
      .filter((name) => name.endsWith('.ts') && !name.endsWith('.spec.ts') && !allowed.has(name))
      .filter((name) => {
        const source = readFileSync(join(__dirname, name), 'utf8');
        return forbiddenPatterns.some((pattern) => pattern.test(source));
      });

    expect(offenders).toEqual([]);
  });
});
