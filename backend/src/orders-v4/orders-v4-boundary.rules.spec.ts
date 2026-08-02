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

  it('allows custody-ledger writes only through the central funds posting service', () => {
    const offenders = readdirSync(__dirname)
      .filter((name) => name.endsWith('.ts') && !name.endsWith('.spec.ts'))
      .filter((name) => name !== 'orders-v4-funds-posting.service.ts')
      .filter((name) => readFileSync(join(__dirname, name), 'utf8').includes('ordersV4CustodyLedgerEntry.create'));

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

  it('allows conversion resolution only through the central conversion context', () => {
    const offenders = readdirSync(__dirname)
      .filter((name) => name.endsWith('.ts') && !name.endsWith('.spec.ts'))
      .filter((name) => !['orders-v4-conversion.kernel.ts', 'orders-v4-conversion.context.ts'].includes(name))
      .filter((name) => readFileSync(join(__dirname, name), 'utf8').includes('resolveOrdersV4Conversion'));

    expect(offenders).toEqual([]);
  });

  it('keeps stocktake calculation and posting inside the central posting boundary', () => {
    const offenders = readdirSync(__dirname)
      .filter((name) => name.endsWith('.ts') && !name.endsWith('.spec.ts'))
      .filter((name) => !['orders-v4-calculation.kernel.ts', 'orders-v4-ledger-posting.service.ts'].includes(name))
      .filter((name) => readFileSync(join(__dirname, name), 'utf8').includes('calculateOrdersV4StocktakeAdjustment'));

    expect(offenders).toEqual([]);
  });

  it('renders the historical document base unit snapshot instead of the item current unit', () => {
    const documentTab = readFileSync(
      join(__dirname, '../../../src/modules/OrdersV4/components/OrdersV4DocumentsTab.tsx'),
      'utf8',
    );
    expect(documentTab).toContain('row.baseUnit.nameAr');
    expect(documentTab).not.toContain('row.item.inventoryUnit.nameAr}` },');
  });

  it('publishes item units, prices, and conversions through one atomic endpoint', () => {
    const controller = readFileSync(join(__dirname, 'orders-v4.controller.ts'), 'utf8');
    expect(controller).toContain("@Patch('catalog/items/:id/definition')");
    expect(controller).not.toContain("@Patch('catalog/items/:id/units')");
    expect(controller).not.toContain("@Post('catalog/conversions/publish')");
    const catalog = readFileSync(join(__dirname, 'orders-v4-catalog.service.ts'), 'utf8');
    expect(catalog).not.toContain('replaceItemUnits(');
    expect(catalog).not.toContain('publishConversion(');
  });

  it('keeps the immutable kernel unit separate from the editable display unit', () => {
    const itemDefinition = readFileSync(join(__dirname, 'orders-v4-item-definition.service.ts'), 'utf8');
    const catalog = readFileSync(join(__dirname, 'orders-v4-catalog.service.ts'), 'utf8');
    expect(itemDefinition).toContain('toUnitId: item.kernelUnitId');
    expect(itemDefinition).not.toContain('postUnitRebase');
    expect(catalog).toContain('kernelUnitId: input.inventoryUnitId');
  });

  it('exposes an explicit unit restore lifecycle endpoint', () => {
    const controller = readFileSync(join(__dirname, 'orders-v4.controller.ts'), 'utf8');
    expect(controller).toContain("@Patch('catalog/units/:id/restore')");
  });
});
