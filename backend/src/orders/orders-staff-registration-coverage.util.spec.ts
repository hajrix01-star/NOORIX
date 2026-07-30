import {
  buildStaffRegistrationCoverage,
  suggestNextStaffRegistrationDate,
} from './orders-staff-registration-coverage.util';

describe('staff registration sequencing and coverage', () => {
  it('suggests the next missing day for a section without going beyond today', () => {
    expect(suggestNextStaffRegistrationDate('2026-07-25', '2026-07-30')).toBe('2026-07-26');
    expect(suggestNextStaffRegistrationDate('2026-07-30', '2026-07-30')).toBe('2026-07-30');
    expect(suggestNextStaffRegistrationDate(null, '2026-07-30')).toBe('2026-07-30');
  });

  it('finds missing dates independently for every section', () => {
    const coverage = buildStaffRegistrationCoverage({
      startDate: '2026-07-25',
      endDate: '2026-07-30',
      today: '2026-07-30',
      orders: [
        {
          sectionName: 'بار',
          userId: 'u1',
          saleDate: new Date('2026-07-25T00:00:00.000Z'),
          createdAt: new Date('2026-07-25T10:00:00.000Z'),
        },
        {
          sectionName: 'بار',
          userId: 'u1',
          saleDate: new Date('2026-07-27T00:00:00.000Z'),
          createdAt: new Date('2026-07-27T10:00:00.000Z'),
        },
        {
          sectionName: 'شيشة',
          userId: 'u2',
          saleDate: new Date('2026-07-28T00:00:00.000Z'),
          createdAt: new Date('2026-07-28T10:00:00.000Z'),
        },
        {
          sectionName: 'شيشة',
          userId: 'u2',
          saleDate: new Date('2026-07-30T00:00:00.000Z'),
          createdAt: new Date('2026-07-30T10:00:00.000Z'),
        },
      ],
    });

    expect(coverage.sections).toMatchObject([
      { sectionName: 'بار', registeredDays: 2, missingDays: 4 },
      { sectionName: 'شيشة', registeredDays: 2, missingDays: 4 },
    ]);
    expect(coverage.missingDays).toContainEqual({ date: '2026-07-26', sectionName: 'بار' });
    expect(coverage.missingDays).toContainEqual({ date: '2026-07-29', sectionName: 'شيشة' });
    expect(coverage.missingSectionDays).toBe(8);
    expect(coverage.affectedSections).toBe(2);
  });

  it('includes a configured section that has not recorded anything since company tracking started', () => {
    const coverage = buildStaffRegistrationCoverage({
      startDate: '2026-07-29',
      endDate: '2026-07-30',
      today: '2026-07-30',
      sectionNames: ['بار', 'مطبخ'],
      orders: [{
        sectionName: 'بار',
        userId: 'u1',
        saleDate: new Date('2026-07-29T00:00:00.000Z'),
        createdAt: new Date('2026-07-29T10:00:00.000Z'),
      }],
    });

    expect(coverage.sections).toContainEqual(expect.objectContaining({
      sectionName: 'مطبخ',
      firstRegisteredDate: null,
      registeredDays: 0,
      missingDates: ['2026-07-29', '2026-07-30'],
    }));
  });

  it('does not mark future dates or dates before a section started', () => {
    const coverage = buildStaffRegistrationCoverage({
      startDate: '2026-07-01',
      endDate: '2026-07-31',
      today: '2026-07-30',
      orders: [{
        sectionName: 'مطبخ',
        userId: 'u1',
        saleDate: new Date('2026-07-29T00:00:00.000Z'),
        createdAt: new Date('2026-07-29T10:00:00.000Z'),
      }],
    });

    expect(coverage.sections[0]).toMatchObject({
      sectionName: 'مطبخ',
      expectedDays: 2,
      registeredDays: 1,
      missingDates: ['2026-07-30'],
    });
  });
});
