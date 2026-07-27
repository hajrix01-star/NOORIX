import { buildOwnerAdminDashboardExecutiveSnapshot } from './owner-admin-dashboard-executive-snapshot.util';

describe('buildOwnerAdminDashboardExecutiveSnapshot', () => {
  it('uses fourteen complete calendar days, explicit zero days, and source channel amounts', () => {
    const snapshot = buildOwnerAdminDashboardExecutiveSnapshot({
      latestCompleteDate: '2026-07-18',
      dailySales: [
        { date: '2026-07-04', amount: '5' },
        { date: '2026-07-05', amount: '10' },
        { date: '2026-07-17', amount: '70' },
        { date: '2026-07-18', amount: '100' },
        { date: '2026-07-18', amount: '25' },
      ],
      salesChannels: [
        { id: 'cash', labelAr: 'نقدي', labelEn: 'Cash', amount: '70' },
        { id: 'cash', labelAr: 'نقدي', labelEn: 'Cash', amount: '30' },
        { id: 'card', labelAr: 'شبكة', labelEn: null, amount: '25' },
      ],
    });

    expect(snapshot.dailySales).toHaveLength(14);
    expect(snapshot.currentMonthDailySales).toHaveLength(18);
    expect(snapshot.currentMonthDailySales[0]).toMatchObject({
      date: '2026-07-01',
      amount: 0,
    });
    expect(snapshot.currentMonthDailySales[17]).toMatchObject({
      date: '2026-07-18',
      amount: 125,
    });
    expect(snapshot.dailySales[0]).toEqual({
      date: '2026-07-05',
      amount: 10,
      previousDaySales: 5,
      changeAmount: 5,
      changePercent: 100,
      direction: 'up',
    });
    expect(snapshot.dailySales[1]).toMatchObject({
      date: '2026-07-06',
      amount: 0,
      previousDaySales: 10,
      changeAmount: -10,
      changePercent: -100,
      direction: 'down',
    });
    expect(snapshot.dailySales[12]).toMatchObject({ date: '2026-07-17', amount: 70 });
    expect(snapshot.dailySales[13]).toMatchObject({ date: '2026-07-18', amount: 125 });
    expect(snapshot.latestCompleteDay).toEqual({
      date: '2026-07-18',
      sales: 125,
      previousDaySales: 70,
      changeAmount: 55,
      changePercent: 78.57,
      direction: 'up',
    });
    expect(snapshot.coverage).toEqual({ currentDays: 18, previousDays: 18 });
    expect(snapshot.monthEndForecast).toBe(361.67);
    expect(snapshot.salesChannels).toEqual([
      { id: 'card', labelAr: 'شبكة', labelEn: null, amount: 25 },
      { id: 'cash', labelAr: 'نقدي', labelEn: 'Cash', amount: 100 },
      {
        id: 'ledger-other-sales',
        labelAr: 'مبيعات دفترية أخرى',
        labelEn: 'Other ledger sales',
        amount: 85,
      },
    ]);
  });

  it('uses all month-to-date official sales for the forecast while retaining only fourteen chart points', () => {
    const snapshot = buildOwnerAdminDashboardExecutiveSnapshot({
      latestCompleteDate: '2026-07-25',
      dailySales: [
        { date: '2026-07-01', amount: '310' },
        { date: '2026-07-12', amount: '20' },
        { date: '2026-07-25', amount: '30' },
      ],
      salesChannels: [{ id: 'cash', labelAr: 'نقدي', labelEn: 'Cash', amount: '50' }],
    });

    expect(snapshot.dailySales).toHaveLength(14);
    expect(snapshot.currentMonthDailySales).toHaveLength(25);
    expect(snapshot.currentMonthDailySales[0]?.date).toBe('2026-07-01');
    expect(snapshot.currentMonthDailySales[24]).toMatchObject({
      date: '2026-07-25',
      amount: 30,
    });
    expect(snapshot.dailySales[0]?.date).toBe('2026-07-12');
    expect(snapshot.dailySales[13]).toMatchObject({ date: '2026-07-25', amount: 30 });
    expect(snapshot.monthEndForecast).toBe(446.4);
    expect(snapshot.salesChannels).toContainEqual({
      id: 'ledger-other-sales',
      labelAr: 'مبيعات دفترية أخرى',
      labelEn: 'Other ledger sales',
      amount: 310,
    });
  });

  it('uses the last day of the shorter previous month for coverage', () => {
    const snapshot = buildOwnerAdminDashboardExecutiveSnapshot({
      latestCompleteDate: '2026-03-31',
      dailySales: [],
      salesChannels: [],
    });

    expect(snapshot.coverage).toEqual({ currentDays: 31, previousDays: 28 });
  });

  it('normalizes legacy channel labels before returning the source snapshot', () => {
    const snapshot = buildOwnerAdminDashboardExecutiveSnapshot({
      latestCompleteDate: '2026-07-18',
      dailySales: [],
      salesChannels: [{ id: ' cash ', labelAr: ' نقدي ', labelEn: '   ', amount: '0' }],
    });

    expect(snapshot.salesChannels).toEqual([
      { id: 'cash', labelAr: 'نقدي', labelEn: null, amount: 0 },
    ]);
  });

  it('rejects invalid source values instead of changing them to zero', () => {
    expect(() => buildOwnerAdminDashboardExecutiveSnapshot({
      latestCompleteDate: '2026-07-18',
      dailySales: [{ date: '2026-07-18', amount: '-1' }],
      salesChannels: [],
    })).toThrow('Invalid executive sales amount');
  });
});
