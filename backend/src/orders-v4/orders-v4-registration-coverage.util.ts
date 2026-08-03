export type OrdersV4CoverageDocument = {
  sectionId: string | null;
  documentDate: Date;
};

export type OrdersV4CoverageSection = {
  id: string;
  nameAr: string;
};

export type OrdersV4RegistrationCoverage = {
  startDate: string;
  endDate: string;
  expectedSectionDays: number;
  registeredSectionDays: number;
  missingSectionDays: number;
  affectedSections: number;
  sections: Array<{
    sectionId: string;
    sectionName: string;
    firstRegisteredDate: string | null;
    lastRegisteredDate: string | null;
    expectedDays: number;
    registeredDays: number;
    missingDays: number;
  }>;
  missingDays: Array<{ date: string; sectionId: string; sectionName: string }>;
};

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDay(value: string): string {
  const date = new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return ymd(date);
}

function inclusiveDates(startDate: string, endDate: string): string[] {
  if (!startDate || !endDate || startDate > endDate) return [];
  const result: string[] = [];
  for (let cursor = startDate; cursor <= endDate; cursor = addDay(cursor)) result.push(cursor);
  return result;
}

export function buildOrdersV4RegistrationCoverage(params: {
  documents: OrdersV4CoverageDocument[];
  sections: OrdersV4CoverageSection[];
  startDate: string;
  endDate: string;
  today: string;
}): OrdersV4RegistrationCoverage {
  const effectiveEnd = params.endDate < params.today ? params.endDate : params.today;
  const datesBySection = new Map(params.sections.map((section) => [section.id, [] as string[]]));
  for (const document of params.documents) {
    if (!document.sectionId || !datesBySection.has(document.sectionId)) continue;
    datesBySection.get(document.sectionId)!.push(ymd(document.documentDate));
  }
  const companyFirstRegisteredDate = [...datesBySection.values()].flat().sort()[0] ?? null;
  const missingDays: OrdersV4RegistrationCoverage['missingDays'] = [];
  const sections: OrdersV4RegistrationCoverage['sections'] = [];
  if (companyFirstRegisteredDate && companyFirstRegisteredDate <= effectiveEnd) {
    const coverageStart = companyFirstRegisteredDate > params.startDate ? companyFirstRegisteredDate : params.startDate;
    const expectedDates = inclusiveDates(coverageStart, effectiveEnd);
    for (const section of params.sections) {
      const uniqueDates = [...new Set(datesBySection.get(section.id) ?? [])].sort();
      const registered = new Set(uniqueDates.filter((date) => date >= coverageStart && date <= effectiveEnd));
      const missing = expectedDates.filter((date) => !registered.has(date));
      sections.push({
        sectionId: section.id,
        sectionName: section.nameAr,
        firstRegisteredDate: uniqueDates[0] ?? null,
        lastRegisteredDate: uniqueDates.filter((date) => date <= effectiveEnd).at(-1) ?? null,
        expectedDays: expectedDates.length,
        registeredDays: registered.size,
        missingDays: missing.length,
      });
      missing.forEach((date) => missingDays.push({ date, sectionId: section.id, sectionName: section.nameAr }));
    }
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
