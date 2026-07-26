import { calculateShishaInventory } from './shisha-inventory-calculator.util';

describe('calculateShishaInventory', () => {
  const base = {
    trackingStartDate: '2026-07-01',
    startDate: '2026-07-01',
    endDate: '2026-07-02',
    headsPerKg: 39,
    charcoalPacksPerCarton: 10,
    charcoalPiecesPerPack: 64,
    movements: [
      { date: '2026-07-01', movementType: 'opening' as const, materialType: 'tobacco' as const, quantityBase: 15000, costInclVat: 900 },
      { date: '2026-07-01', movementType: 'opening' as const, materialType: 'hose' as const, quantityBase: 100 },
      { date: '2026-07-01', movementType: 'opening' as const, materialType: 'charcoal' as const, quantityBase: 1280 },
    ],
    sales: [
      { date: '2026-07-01', operationKey: 'L-1', heads: 10, changes: 2 },
      { date: '2026-07-02', operationKey: 'L-2', heads: 5, changes: 0 },
    ],
  };

  it('uses the approved 39 heads per kilogram conversion', () => {
    const result = calculateShishaInventory(base);
    expect(result.current.tobaccoKg).toBeCloseTo(15 - 15 / 39, 3);
    expect(result.periodTotals.tobaccoHeadsConsumed).toBe(15);
    expect(result.current.tobaccoHeads).toBe(570);
  });

  it('counts a change as both tobacco and hose consumption', () => {
    const result = calculateShishaInventory(base);
    expect(result.periodTotals.changes).toBe(2);
    expect(result.periodTotals.hosesConsumed).toBe(15);
    expect(result.current.hoses).toBe(85);
  });

  it('converts charcoal into cartons, packs, and pieces without assumed consumption', () => {
    const result = calculateShishaInventory(base);
    expect(result.current.charcoalCartons).toBe(2);
    expect(result.current.charcoalPacks).toBe(0);
    expect(result.current.charcoalPieces).toBe(0);
    expect(result.current.charcoalPiecesTotal).toBe(1280);
  });

  it('applies stocktake corrections as immutable deltas', () => {
    const result = calculateShishaInventory({
      ...base,
      movements: [
        ...base.movements,
        {
          date: '2026-07-02',
          movementType: 'stocktake_adjustment',
          materialType: 'tobacco',
          quantityBase: -100,
        },
      ],
    });
    expect(result.periodTotals.tobaccoCorrectionKg).toBe(-0.1);
    expect(result.current.tobaccoKg).toBeCloseTo(15 - 15 / 39 - 0.1, 3);
  });
});
