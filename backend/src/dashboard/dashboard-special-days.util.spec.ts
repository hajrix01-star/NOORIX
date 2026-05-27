import {
  mergeSpecialDayPeriods,
  occasionsToSpecialDayPeriods,
  splitDateRangeByMonth,
} from './dashboard-special-days.util';

describe('splitDateRangeByMonth', () => {
  it('splits ramadan across two months', () => {
    const slices = splitDateRangeByMonth('2026-02-18', '2026-03-19');
    expect(slices).toHaveLength(2);
    expect(slices[0]).toMatchObject({ year: 2026, month: 2, fromDate: '2026-02-18', toDate: '2026-02-28' });
    expect(slices[1]).toMatchObject({ year: 2026, month: 3, fromDate: '2026-03-01', toDate: '2026-03-19' });
  });
});

describe('occasionsToSpecialDayPeriods', () => {
  it('assigns stable ids per occasion year', () => {
    const map = occasionsToSpecialDayPeriods(
      2026,
      [
        {
          id: 'national',
          nameAr: 'اليوم الوطني',
          nameEn: 'National Day',
          fromDate: '2026-09-23',
          toDate: '2026-09-26',
          color: '#185FA5',
        },
      ],
      'ar',
    );
    expect(map.get(9)?.[0].id).toBe('saudi-2026-national');
    expect(map.get(9)?.[0].name).toBe('اليوم الوطني');
  });
});

describe('mergeSpecialDayPeriods', () => {
  it('replaces same id', () => {
    const merged = mergeSpecialDayPeriods(
      [{ id: 'a', name: 'Old', fromDate: '2026-01-01', toDate: '2026-01-02', color: '#000' }],
      [{ id: 'a', name: 'New', fromDate: '2026-01-01', toDate: '2026-01-05', color: '#fff' }],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].name).toBe('New');
  });
});
