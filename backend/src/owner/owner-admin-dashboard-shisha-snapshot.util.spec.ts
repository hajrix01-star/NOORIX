import { buildOwnerAdminDashboardShishaSnapshot } from './owner-admin-dashboard-shisha-snapshot.util';

describe('buildOwnerAdminDashboardShishaSnapshot', () => {
  it('keeps the source values and excludes future inventory rows', () => {
    const snapshot = buildOwnerAdminDashboardShishaSnapshot({
      initialized: true,
      startDate: '2026-07-01',
      effectiveStart: '2026-07-27',
      endDate: '2026-07-28',
      settings: {
        trackingStartDate: '2026-07-27',
        headsPerKg: 39,
        gramsPerHead: 25.641,
      },
      current: {
        tobaccoKg: 19.102,
        tobaccoHeads: 744,
        hoses: -101,
        charcoalPiecesTotal: 0,
        averageCostPerHead: null,
      },
      periodTotals: {
        newShisha: 98,
        changes: 3,
        tobaccoHeadsConsumed: 101,
        tobaccoConsumedKg: 2.59,
        tobaccoPurchasedKg: 0,
      },
      daily: [
        {
          date: '2026-07-27',
          newShisha: 32,
          changes: 1,
          tobaccoHeadsConsumed: 33,
          tobaccoConsumedKg: 0.846,
          tobaccoPurchasedKg: 0,
          closingTobaccoKg: 20.846,
          closingTobaccoHeads: 812,
          closingHoses: -33,
          closingCharcoalPieces: 0,
        },
        {
          date: '2026-07-28',
          newShisha: 66,
          changes: 2,
          tobaccoHeadsConsumed: 68,
          tobaccoConsumedKg: 1.744,
          tobaccoPurchasedKg: 0,
          closingTobaccoKg: 19.102,
          closingTobaccoHeads: 744,
          closingHoses: -101,
          closingCharcoalPieces: 0,
        },
        {
          date: '2026-07-29',
          newShisha: 0,
          changes: 0,
          tobaccoHeadsConsumed: 0,
          tobaccoConsumedKg: 0,
          tobaccoPurchasedKg: 0,
          closingTobaccoKg: 19.102,
          closingTobaccoHeads: 744,
          closingHoses: -101,
          closingCharcoalPieces: 0,
        },
      ],
    });

    expect(snapshot).toMatchObject({
      state: 'ready',
      periodStartDate: '2026-07-27',
      periodEndDate: '2026-07-28',
      current: {
        tobaccoKg: 19.102,
        tobaccoHeads: 744,
        hoses: -101,
        charcoalPieces: 0,
        averageCostPerHead: null,
      },
      periodTotals: {
        newShisha: 98,
        changes: 3,
        tobaccoHeadsConsumed: 101,
        tobaccoConsumedKg: 2.59,
      },
    });
    expect(snapshot.state === 'ready' ? snapshot.daily.map((row) => row.date) : []).toEqual([
      '2026-07-27',
      '2026-07-28',
    ]);
  });

  it('marks companies without an opening inventory as not configured', () => {
    expect(
      buildOwnerAdminDashboardShishaSnapshot({
        initialized: false,
        startDate: '2026-07-01',
        endDate: '2026-07-28',
      }),
    ).toEqual({ state: 'not-configured' });
  });
});
