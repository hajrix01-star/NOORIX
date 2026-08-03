import { buildOrdersV4RegistrationCoverage } from './orders-v4-registration-coverage.util';

describe('buildOrdersV4RegistrationCoverage', () => {
  it('uses historical company start and every active section for the selected period', () => {
    const coverage = buildOrdersV4RegistrationCoverage({
      sections: [{ id: 'bar', nameAr: 'بار' }, { id: 'kitchen', nameAr: 'مطبخ' }],
      documents: [
        { sectionId: 'bar', documentDate: new Date('2026-07-20T00:00:00.000Z') },
        { sectionId: 'bar', documentDate: new Date('2026-08-02T00:00:00.000Z') },
        { sectionId: 'kitchen', documentDate: new Date('2026-08-03T00:00:00.000Z') },
      ],
      startDate: '2026-08-01',
      endDate: '2026-08-31',
      today: '2026-08-03',
    });
    expect(coverage.expectedSectionDays).toBe(6);
    expect(coverage.registeredSectionDays).toBe(2);
    expect(coverage.missingSectionDays).toBe(4);
    expect(coverage.affectedSections).toBe(2);
    expect(coverage.missingDays).toContainEqual({ date: '2026-08-01', sectionId: 'bar', sectionName: 'بار' });
    expect(coverage.missingDays).toContainEqual({ date: '2026-08-02', sectionId: 'kitchen', sectionName: 'مطبخ' });
  });

  it('does not invent missing days before the first registration in V4', () => {
    const coverage = buildOrdersV4RegistrationCoverage({
      sections: [{ id: 'bar', nameAr: 'بار' }],
      documents: [{ sectionId: 'bar', documentDate: new Date('2026-08-03T00:00:00.000Z') }],
      startDate: '2026-08-01',
      endDate: '2026-08-31',
      today: '2026-08-03',
    });
    expect(coverage.expectedSectionDays).toBe(1);
    expect(coverage.missingSectionDays).toBe(0);
  });
});
