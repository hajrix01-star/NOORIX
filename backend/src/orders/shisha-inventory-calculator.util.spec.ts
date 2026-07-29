import { calculateShishaInventory } from './shisha-inventory-calculator.util';

describe('calculateShishaInventory', () => {
  const base = {
    trackingStartDate: '2026-07-01',
    startDate: '2026-07-01',
    endDate: '2026-07-02',
    headsPerKg: 39,
    charcoalPacksPerCarton: 10,
    charcoalPiecesPerPack: 64,
    charcoalShishaPerPack: 6,
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

  it('counts a change as tobacco consumption without consuming a hose', () => {
    const result = calculateShishaInventory(base);
    expect(result.periodTotals.changes).toBe(2);
    expect(result.periodTotals.hosesConsumed).toBe(13);
    expect(result.current.hoses).toBe(87);
  });

  it('deducts one charcoal box for every six registered heads', () => {
    const result = calculateShishaInventory(base);
    expect(result.periodTotals.charcoalBoxesConsumed).toBe(2.5);
    expect(result.current.charcoalCartons).toBe(1);
    expect(result.current.charcoalPacks).toBe(7);
    expect(result.current.charcoalPieces).toBe(32);
    expect(result.current.charcoalPiecesTotal).toBe(1120);
  });

  it('converts sixty registered heads into ten charcoal boxes', () => {
    const result = calculateShishaInventory({
      ...base,
      endDate: '2026-07-01',
      sales: [{ date: '2026-07-01', operationKey: 'L-60', heads: 60, changes: 0 }],
    });
    expect(result.periodTotals.charcoalBoxesConsumed).toBe(10);
    expect(result.periodTotals.charcoalPiecesConsumed).toBe(640);
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
