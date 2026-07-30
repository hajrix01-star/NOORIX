import { toYmd } from '../common/utils/to-ymd.util';

type CoverageOrder = {
  sectionName: string;
  userId: string;
  saleDate?: Date | null;
  createdAt: Date;
};

export type StaffRegistrationMissingDay = {
  date: string;
  sectionName: string;
};

export type StaffRegistrationSectionCoverage = {
  sectionName: string;
  firstRegisteredDate: string | null;
  lastRegisteredDate: string | null;
  expectedDays: number;
  registeredDays: number;
  missingDays: number;
  missingDates: string[];
};

export type StaffRegistrationCoverage = {
  startDate: string;
  endDate: string;
  expectedSectionDays: number;
  registeredSectionDays: number;
  missingSectionDays: number;
  affectedSections: number;
  sections: StaffRegistrationSectionCoverage[];
  missingDays: StaffRegistrationMissingDay[];
};

function addYmdDays(ymd: string, days: number): string {
  const date = new Date(`${ymd}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toYmd(date);
}

function inclusiveDateKeys(startDate: string, endDate: string): string[] {
  if (!startDate || !endDate || startDate > endDate) return [];
  const dates: string[] = [];
  for (let cursor = startDate; cursor <= endDate; cursor = addYmdDays(cursor, 1)) {
    dates.push(cursor);
  }
  return dates;
}

export function suggestNextStaffRegistrationDate(
  lastSectionDate: string | null,
  today: string,
): string {
  if (!lastSectionDate) return today;
  const nextDate = addYmdDays(lastSectionDate, 1);
  return nextDate > today ? today : nextDate;
}

export function buildStaffRegistrationCoverage(params: {
  orders: CoverageOrder[];
  sectionNames?: string[];
  startDate: string;
  endDate: string;
  today: string;
}): StaffRegistrationCoverage {
  const effectiveEnd = params.endDate < params.today ? params.endDate : params.today;
  const bySection = new Map<string, string[]>();
  for (const sectionName of params.sectionNames ?? []) {
    const normalized = String(sectionName || '').trim();
    if (normalized) bySection.set(normalized, []);
  }

  for (const order of params.orders) {
    const sectionName = String(order.sectionName || '').trim() || 'عام';
    const date = toYmd(order.saleDate ?? order.createdAt);
    const dates = bySection.get(sectionName) ?? [];
    dates.push(date);
    bySection.set(sectionName, dates);
  }

  const sections: StaffRegistrationSectionCoverage[] = [];
  const missingDays: StaffRegistrationMissingDay[] = [];
  const companyFirstRegisteredDate = [...bySection.values()]
    .flat()
    .sort()[0] ?? null;

  for (const [sectionName, allDates] of bySection) {
    const uniqueDates = [...new Set(allDates)].sort();
    const firstRegisteredDate = uniqueDates[0] ?? null;
    if (!companyFirstRegisteredDate || companyFirstRegisteredDate > effectiveEnd) continue;

    const sectionStart = companyFirstRegisteredDate > params.startDate
      ? companyFirstRegisteredDate
      : params.startDate;
    const expectedDates = inclusiveDateKeys(sectionStart, effectiveEnd);
    const registeredSet = new Set(uniqueDates.filter((date) => date >= sectionStart && date <= effectiveEnd));
    const missingDates = expectedDates.filter((date) => !registeredSet.has(date));
    const lastRegisteredDate = uniqueDates.filter((date) => date <= effectiveEnd).at(-1) ?? null;

    sections.push({
      sectionName,
      firstRegisteredDate,
      lastRegisteredDate,
      expectedDays: expectedDates.length,
      registeredDays: registeredSet.size,
      missingDays: missingDates.length,
      missingDates,
    });
    missingDates.forEach((date) => missingDays.push({ date, sectionName }));
  }

  sections.sort((a, b) => a.sectionName.localeCompare(b.sectionName, 'ar'));
  missingDays.sort((a, b) => b.date.localeCompare(a.date) || a.sectionName.localeCompare(b.sectionName, 'ar'));

  return {
    startDate: params.startDate,
    endDate: effectiveEnd,
    expectedSectionDays: sections.reduce((sum, section) => sum + section.expectedDays, 0),
    registeredSectionDays: sections.reduce((sum, section) => sum + section.registeredDays, 0),
    missingSectionDays: missingDays.length,
    affectedSections: sections.filter((section) => section.missingDays > 0).length,
    sections,
    missingDays,
  };
}
