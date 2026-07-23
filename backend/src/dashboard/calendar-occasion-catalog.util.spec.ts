import {
  buildCalendarOccasionCatalog,
  getCalendarOccasionStatus,
} from './calendar-occasion-catalog.util';

describe('calendar occasion catalog', () => {
  it('classifies occasions by date range', () => {
    expect(getCalendarOccasionStatus('2026-07-01', '2026-07-10', '2026-06-30')).toBe('upcoming');
    expect(getCalendarOccasionStatus('2026-07-01', '2026-07-10', '2026-07-01')).toBe('current');
    expect(getCalendarOccasionStatus('2026-07-01', '2026-07-10', '2026-07-10')).toBe('current');
    expect(getCalendarOccasionStatus('2026-07-01', '2026-07-10', '2026-07-11')).toBe('ended');
  });

  it('combines saudi occasions and school holidays with stable keys', () => {
    const catalog = buildCalendarOccasionCatalog(2026, 'western', '2026-07-15');

    expect(catalog.year).toBe(2026);
    expect(catalog.schoolVariant).toBe('western');
    expect(catalog.events.some((event) => event.key.startsWith('saudi:'))).toBe(true);
    expect(catalog.events.some((event) => event.key.startsWith('school:'))).toBe(true);
    expect(catalog.events.every((event) => event.status === 'current' || event.status === 'upcoming' || event.status === 'ended')).toBe(true);
    expect(catalog.counts.current + catalog.counts.upcoming + catalog.counts.ended).toBe(catalog.events.length);
  });
});
