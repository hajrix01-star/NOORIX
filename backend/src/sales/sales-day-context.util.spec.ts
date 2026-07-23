import {
  buildSalesDayContextSnapshot,
  normalizeSalesDayContextSnapshotInput,
} from './sales-day-context.util';

describe('sales day context', () => {
  it('returns null for a normal sales day', () => {
    expect(buildSalesDayContextSnapshot('2026-07-10', [])).toBeNull();
  });

  it('builds a stable snapshot and prioritizes manual context', () => {
    const snapshot = buildSalesDayContextSnapshot('2026-07-10', [
      {
        id: 'saudi-2026-national-day',
        name: 'مناسبة وطنية',
        fromDate: '2026-07-10',
        toDate: '2026-07-10',
        color: '#166534',
      },
      {
        id: 'manual-peak-day',
        name: 'يوم تسويق خاص',
        fromDate: '2026-07-09',
        toDate: '2026-07-11',
        color: '#2563eb',
      },
    ]);

    expect(snapshot).toEqual({
      version: 1,
      date: '2026-07-10',
      isSpecialDay: true,
      primary: {
        id: 'manual-peak-day',
        name: 'يوم تسويق خاص',
        type: 'special_day',
        source: 'manual',
        fromDate: '2026-07-09',
        toDate: '2026-07-11',
        color: '#2563eb',
      },
      events: [
        {
          id: 'manual-peak-day',
          name: 'يوم تسويق خاص',
          type: 'special_day',
          source: 'manual',
          fromDate: '2026-07-09',
          toDate: '2026-07-11',
          color: '#2563eb',
        },
        {
          id: 'saudi-2026-national-day',
          name: 'مناسبة وطنية',
          type: 'occasion',
          source: 'saudi',
          fromDate: '2026-07-10',
          toDate: '2026-07-10',
          color: '#166534',
        },
      ],
    });
  });

  it('normalizes stored snapshots defensively', () => {
    expect(normalizeSalesDayContextSnapshotInput({ version: 1, isSpecialDay: true, date: '2026-07-10' })).toBeNull();
  });
});
