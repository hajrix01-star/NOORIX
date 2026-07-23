export type SchoolAcademicCalendarVariant = 'general' | 'western';

export type SchoolAcademicHolidayTemplate = {
  id: string;
  variant: SchoolAcademicCalendarVariant;
  academicYear: string;
  nameAr: string;
  nameEn: string;
  fromDate: string;
  toDate: string;
  color: string;
  sourceUrl: string;
  sourceUpdatedAt: string;
  estimated: boolean;
};

const SCHOOL_HOLIDAY_COLOR = '#0f766e';
const MOE_ACADEMIC_CALENDAR_URL =
  'https://www.moe.gov.sa/ar/education/generaleducation/pages/academiccalendar.aspx';
const RCJ_GENERAL_EDUCATION_CALENDAR_URL = 'https://rcjy.edu.sa/ar/general-education-calendar/';

function clipToGregorianYear(
  fromDate: string,
  toDate: string,
  gregorianYear: number,
): { fromDate: string; toDate: string } | null {
  const start = `${gregorianYear}-01-01`;
  const end = `${gregorianYear}-12-31`;
  const from = fromDate > start ? fromDate : start;
  const to = toDate < end ? toDate : end;
  if (from > to) return null;
  return { fromDate: from, toDate: to };
}

const SHARED_1447_1448: Omit<SchoolAcademicHolidayTemplate, 'variant'>[] = [
  {
    id: 'fall-break-1447',
    academicYear: '1447-1448',
    nameAr: 'إجازة الخريف',
    nameEn: 'Fall break',
    fromDate: '2025-11-21',
    toDate: '2025-11-29',
    color: SCHOOL_HOLIDAY_COLOR,
    sourceUrl: RCJ_GENERAL_EDUCATION_CALENDAR_URL,
    sourceUpdatedAt: '2025-12-04',
    estimated: false,
  },
  {
    id: 'extra-break-1447-01',
    academicYear: '1447-1448',
    nameAr: 'إجازة إضافية',
    nameEn: 'Additional break',
    fromDate: '2025-12-11',
    toDate: '2025-12-14',
    color: SCHOOL_HOLIDAY_COLOR,
    sourceUrl: RCJ_GENERAL_EDUCATION_CALENDAR_URL,
    sourceUpdatedAt: '2025-12-04',
    estimated: false,
  },
  {
    id: 'midyear-break-1447',
    academicYear: '1447-1448',
    nameAr: 'إجازة منتصف العام الدراسي',
    nameEn: 'Midyear break',
    fromDate: '2026-01-09',
    toDate: '2026-01-17',
    color: SCHOOL_HOLIDAY_COLOR,
    sourceUrl: RCJ_GENERAL_EDUCATION_CALENDAR_URL,
    sourceUpdatedAt: '2025-12-04',
    estimated: false,
  },
  {
    id: 'eid-fitr-break-1447',
    academicYear: '1447-1448',
    nameAr: 'إجازة عيد الفطر للمدارس',
    nameEn: 'School Eid al-Fitr break',
    fromDate: '2026-03-06',
    toDate: '2026-03-28',
    color: SCHOOL_HOLIDAY_COLOR,
    sourceUrl: RCJ_GENERAL_EDUCATION_CALENDAR_URL,
    sourceUpdatedAt: '2025-12-04',
    estimated: false,
  },
];

const SCHOOL_ACADEMIC_HOLIDAYS: SchoolAcademicHolidayTemplate[] = [
  ...SHARED_1447_1448.map((event) => ({ ...event, variant: 'general' as const })),
  ...SHARED_1447_1448.map((event) => ({ ...event, variant: 'western' as const })),
  {
    id: 'eid-adha-break-1447-general',
    variant: 'general',
    academicYear: '1447-1448',
    nameAr: 'إجازة عيد الأضحى للمدارس',
    nameEn: 'School Eid al-Adha break',
    fromDate: '2026-05-22',
    toDate: '2026-06-01',
    color: SCHOOL_HOLIDAY_COLOR,
    sourceUrl: RCJ_GENERAL_EDUCATION_CALENDAR_URL,
    sourceUpdatedAt: '2025-12-04',
    estimated: false,
  },
  {
    id: 'year-end-break-1447-general',
    variant: 'general',
    academicYear: '1447-1448',
    nameAr: 'إجازة نهاية العام الدراسي',
    nameEn: 'End of school year break',
    fromDate: '2026-06-25',
    toDate: '2026-08-23',
    color: SCHOOL_HOLIDAY_COLOR,
    sourceUrl: RCJ_GENERAL_EDUCATION_CALENDAR_URL,
    sourceUpdatedAt: '2025-12-04',
    estimated: false,
  },
  {
    id: 'eid-adha-break-1447-western',
    variant: 'western',
    academicYear: '1447-1448',
    nameAr: 'إجازة عيد الأضحى للمدارس',
    nameEn: 'School Eid al-Adha break',
    fromDate: '2026-05-15',
    toDate: '2026-06-01',
    color: SCHOOL_HOLIDAY_COLOR,
    sourceUrl: RCJ_GENERAL_EDUCATION_CALENDAR_URL,
    sourceUpdatedAt: '2025-12-04',
    estimated: false,
  },
  {
    id: 'year-end-break-1447-western',
    variant: 'western',
    academicYear: '1447-1448',
    nameAr: 'إجازة نهاية العام الدراسي',
    nameEn: 'End of school year break',
    fromDate: '2026-07-02',
    toDate: '2026-08-30',
    color: SCHOOL_HOLIDAY_COLOR,
    sourceUrl: RCJ_GENERAL_EDUCATION_CALENDAR_URL,
    sourceUpdatedAt: '2025-12-04',
    estimated: false,
  },
];

export function normalizeSchoolAcademicCalendarVariant(value: unknown): SchoolAcademicCalendarVariant {
  return value === 'western' ? 'western' : 'general';
}

export function getSchoolAcademicHolidaysForYear(
  gregorianYear: number,
  variant: SchoolAcademicCalendarVariant = 'general',
): SchoolAcademicHolidayTemplate[] {
  if (!Number.isFinite(gregorianYear) || gregorianYear < 2020 || gregorianYear > 2100) return [];

  return SCHOOL_ACADEMIC_HOLIDAYS
    .filter((event) => event.variant === variant)
    .map((event) => {
      const clipped = clipToGregorianYear(event.fromDate, event.toDate, gregorianYear);
      return clipped ? { ...event, ...clipped } : null;
    })
    .filter((event): event is SchoolAcademicHolidayTemplate => event != null)
    .sort((a, b) => a.fromDate.localeCompare(b.fromDate) || a.id.localeCompare(b.id));
}

export function getSchoolAcademicCalendarSource() {
  return {
    nameAr: 'وزارة التعليم - التقويم الدراسي',
    nameEn: 'Ministry of Education academic calendar',
    primaryUrl: MOE_ACADEMIC_CALENDAR_URL,
    detailUrl: RCJ_GENERAL_EDUCATION_CALENDAR_URL,
    updatedAt: '2025-12-04',
  };
}
