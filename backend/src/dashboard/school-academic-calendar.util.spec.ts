import {
  getSchoolAcademicHolidaysForYear,
  normalizeSchoolAcademicCalendarVariant,
} from './school-academic-calendar.data';

describe('school-academic-calendar.data', () => {
  it('returns school holidays overlapping 2026 for the general calendar', () => {
    const holidays = getSchoolAcademicHolidaysForYear(2026, 'general');
    expect(holidays.map((item) => item.id)).toContain('midyear-break-1447');
    expect(holidays.map((item) => item.id)).toContain('eid-adha-break-1447-general');
    expect(holidays.find((item) => item.id === 'eid-adha-break-1447-general')).toMatchObject({
      fromDate: '2026-05-22',
      toDate: '2026-06-01',
    });
  });

  it('keeps the western calendar variant distinct for Jeddah and surrounding areas', () => {
    const holidays = getSchoolAcademicHolidaysForYear(2026, 'western');
    expect(holidays.find((item) => item.id === 'eid-adha-break-1447-western')).toMatchObject({
      fromDate: '2026-05-15',
      toDate: '2026-06-01',
    });
    expect(holidays.find((item) => item.id === 'year-end-break-1447-western')).toMatchObject({
      fromDate: '2026-07-02',
      toDate: '2026-08-30',
    });
  });

  it('normalizes unknown variants to the general calendar', () => {
    expect(normalizeSchoolAcademicCalendarVariant('western')).toBe('western');
    expect(normalizeSchoolAcademicCalendarVariant('unknown')).toBe('general');
  });
});
