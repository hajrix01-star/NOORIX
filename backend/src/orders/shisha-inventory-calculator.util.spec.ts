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

  it('keeps tobacco stock unchanged when sales have no explicit recipe usage', () => {
    const result = calculateShishaInventory(base);
    expect(result.current.tobaccoKg).toBe(15);
    expect(result.periodTotals.tobaccoHeadsConsumed).toBe(15);
    expect(result.periodTotals.tobaccoConsumedKg).toBe(0);
    expect(result.current.tobaccoHeads).toBe(585);
  });

  it('counts a change operationally without consuming hose stock implicitly', () => {
    const result = calculateShishaInventory(base);
    expect(result.periodTotals.changes).toBe(2);
    expect(result.periodTotals.hosesConsumed).toBe(0);
    expect(result.current.hoses).toBe(100);
  });

  it('keeps charcoal stock unchanged when sales have no explicit recipe usage', () => {
    const result = calculateShishaInventory(base);
    expect(result.periodTotals.charcoalBoxesConsumed).toBe(0);
    expect(result.periodTotals.charcoalPiecesConsumed).toBe(0);
    expect(result.current.charcoalCartons).toBe(2);
    expect(result.current.charcoalPacks).toBe(0);
    expect(result.current.charcoalPieces).toBe(0);
    expect(result.current.charcoalPiecesTotal).toBe(1280);
  });

  it('uses product recipe consumption when sale events include explicit material usage', () => {
    const result = calculateShishaInventory({
      ...base,
      endDate: '2026-07-01',
      sales: [{
        date: '2026-07-01',
        operationKey: 'recipe-sale',
        heads: 10,
        changes: 2,
        tobaccoGramsConsumed: 250,
        hosesConsumed: 7,
        charcoalPiecesConsumed: 128,
      }],
    });
    expect(result.periodTotals.tobaccoHeadsConsumed).toBe(10);
    expect(result.periodTotals.tobaccoConsumedKg).toBe(0.25);
    expect(result.current.tobaccoKg).toBe(14.75);
    expect(result.periodTotals.hosesConsumed).toBe(7);
    expect(result.periodTotals.charcoalPiecesConsumed).toBe(128);
    expect(result.periodTotals.charcoalBoxesConsumed).toBe(2);
  });

  it('converts explicit recipe charcoal pieces into boxes for reporting', () => {
    const result = calculateShishaInventory({
      ...base,
      endDate: '2026-07-01',
      sales: [{
        date: '2026-07-01',
        operationKey: 'recipe-charcoal',
        heads: 60,
        changes: 0,
        charcoalPiecesConsumed: 640,
      }],
    });
    expect(result.periodTotals.charcoalBoxesConsumed).toBe(10);
    expect(result.periodTotals.charcoalPiecesConsumed).toBe(640);
  });

  it('compares employee-recorded charcoal with expected usage without deducting it from stock', () => {
    const result = calculateShishaInventory({
      ...base,
      charcoalActualTrackingStartDate: '2026-07-01',
      sales: [
        { date: '2026-07-01', operationKey: 'L-1', heads: 10, changes: 2 },
        { date: '2026-07-01', operationKey: 'L-1', heads: 0, changes: 0, actualCharcoalBoxes: 2 },
        { date: '2026-07-02', operationKey: 'L-2', heads: 5, changes: 0 },
      ],
    });
    expect(result.daily[0]).toMatchObject({
      charcoalExpectedBoxes: 1.667,
      charcoalActualBoxes: 2,
      charcoalVarianceBoxes: 0.333,
      charcoalConsumedBoxes: 0,
      charcoalStatus: 'over',
    });
    expect(result.daily[1]).toMatchObject({
      charcoalExpectedBoxes: 0.833,
      charcoalActualBoxes: null,
      charcoalVarianceBoxes: null,
      charcoalConsumedBoxes: 0,
      charcoalStatus: 'missing_actual',
    });
    expect(result.periodTotals.charcoalMissingDays).toBe(1);
    expect(result.periodTotals.charcoalAlertDays).toBe(2);
    expect(result.current.charcoalPiecesTotal).toBe(1280);
  });

  it('marks matching actual charcoal as a clean daily result', () => {
    const result = calculateShishaInventory({
      ...base,
      endDate: '2026-07-01',
      charcoalActualTrackingStartDate: '2026-07-01',
      sales: [
        { date: '2026-07-01', operationKey: 'L-60', heads: 60, changes: 0 },
        { date: '2026-07-01', operationKey: 'L-60', heads: 0, changes: 0, actualCharcoalBoxes: 10 },
      ],
    });
    expect(result.daily[0].charcoalStatus).toBe('matched');
    expect(result.periodTotals.charcoalAlertDays).toBe(0);
    expect(result.periodTotals.charcoalVarianceBoxes).toBe(0);
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
    expect(result.current.tobaccoKg).toBeCloseTo(14.9, 3);
  });
});
