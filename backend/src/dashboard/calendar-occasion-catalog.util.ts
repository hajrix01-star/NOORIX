import type { SaudiOccasionTemplate } from './saudi-occasions.data';
import type {
  SchoolAcademicCalendarVariant,
  SchoolAcademicHolidayTemplate,
} from './school-academic-calendar.data';
import {
  getSchoolAcademicCalendarSource,
  getSchoolAcademicHolidaysForYear,
  normalizeSchoolAcademicCalendarVariant,
} from './school-academic-calendar.data';
import { getSaudiOccasionsForYear } from './saudi-occasions.data';

export type CalendarOccasionStatus = 'current' | 'upcoming' | 'ended';
export type CalendarOccasionSourceKind = 'saudi' | 'school';

export type CalendarOccasionCatalogEvent = {
  key: string;
  sourceKind: CalendarOccasionSourceKind;
  id: string;
  nameAr: string;
  nameEn: string;
  fromDate: string;
  toDate: string;
  color: string;
  estimated: boolean;
  status: CalendarOccasionStatus;
  categoryAr: string;
  categoryEn: string;
  kind?: string;
  academicYear?: string;
  variant?: SchoolAcademicCalendarVariant;
  sourceUrl?: string;
  sourceUpdatedAt?: string;
};

export type CalendarOccasionCatalog = {
  year: number;
  today: string;
  schoolVariant: SchoolAcademicCalendarVariant;
  sources: {
    saudi: {
      nameAr: string;
      nameEn: string;
      updatedAt: string;
      mode: 'calculated';
    };
    school: ReturnType<typeof getSchoolAcademicCalendarSource>;
  };
  counts: Record<CalendarOccasionStatus, number>;
  events: CalendarOccasionCatalogEvent[];
};

function riyadhTodayYmd(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find((part) => part.type === 'year')?.value ?? '1970';
  const m = parts.find((part) => part.type === 'month')?.value ?? '01';
  const d = parts.find((part) => part.type === 'day')?.value ?? '01';
  return `${y}-${m}-${d}`;
}

export function getCalendarOccasionStatus(
  fromDate: string,
  toDate: string,
  today = riyadhTodayYmd(),
): CalendarOccasionStatus {
  if (today < fromDate) return 'upcoming';
  if (today > toDate) return 'ended';
  return 'current';
}

function saudiEventToCatalog(
  event: SaudiOccasionTemplate,
  today: string,
): CalendarOccasionCatalogEvent {
  return {
    key: `saudi:${event.id}`,
    sourceKind: 'saudi',
    id: event.id,
    kind: event.kind,
    nameAr: event.nameAr,
    nameEn: event.nameEn,
    fromDate: event.fromDate,
    toDate: event.toDate,
    color: event.color,
    estimated: event.estimated,
    status: getCalendarOccasionStatus(event.fromDate, event.toDate, today),
    categoryAr: 'مناسبة سعودية',
    categoryEn: 'Saudi occasion',
  };
}

function schoolEventToCatalog(
  event: SchoolAcademicHolidayTemplate,
  today: string,
): CalendarOccasionCatalogEvent {
  return {
    key: `school:${event.id}`,
    sourceKind: 'school',
    id: event.id,
    variant: event.variant,
    academicYear: event.academicYear,
    nameAr: event.nameAr,
    nameEn: event.nameEn,
    fromDate: event.fromDate,
    toDate: event.toDate,
    color: event.color,
    estimated: event.estimated,
    status: getCalendarOccasionStatus(event.fromDate, event.toDate, today),
    categoryAr: 'إجازة مدارس',
    categoryEn: 'School holiday',
    sourceUrl: event.sourceUrl,
    sourceUpdatedAt: event.sourceUpdatedAt,
  };
}

function emptyCounts(): Record<CalendarOccasionStatus, number> {
  return { current: 0, upcoming: 0, ended: 0 };
}

export function buildCalendarOccasionCatalog(
  year: number,
  variant?: SchoolAcademicCalendarVariant,
  today = riyadhTodayYmd(),
): CalendarOccasionCatalog {
  const schoolVariant = normalizeSchoolAcademicCalendarVariant(variant);
  const events = [
    ...getSaudiOccasionsForYear(year).map((event) => saudiEventToCatalog(event, today)),
    ...getSchoolAcademicHolidaysForYear(year, schoolVariant).map((event) =>
      schoolEventToCatalog(event, today),
    ),
  ].sort(
    (a, b) =>
      a.fromDate.localeCompare(b.fromDate) ||
      a.toDate.localeCompare(b.toDate) ||
      a.sourceKind.localeCompare(b.sourceKind) ||
      a.id.localeCompare(b.id),
  );

  const counts = emptyCounts();
  for (const event of events) {
    counts[event.status] += 1;
  }

  return {
    year,
    today,
    schoolVariant,
    sources: {
      saudi: {
        nameAr: 'تقويم أم القرى والمناسبات الوطنية',
        nameEn: 'Umm al-Qura and Saudi national occasions',
        updatedAt: today,
        mode: 'calculated',
      },
      school: getSchoolAcademicCalendarSource(),
    },
    counts,
    events,
  };
}
