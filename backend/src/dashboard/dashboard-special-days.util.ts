export type SpecialDayPeriod = {
  id: string;
  name: string;
  fromDate: string;
  toDate: string;
  color: string;
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** يقسّم فترة إلى شرائح شهرية (لحفظ كل شهر في صف التقويم) */
export function splitDateRangeByMonth(
  fromDate: string,
  toDate: string,
): Array<{ year: number; month: number; fromDate: string; toDate: string }> {
  if (!fromDate || !toDate || toDate < fromDate) return [];

  let y = parseInt(fromDate.slice(0, 4), 10);
  let m = parseInt(fromDate.slice(5, 7), 10);
  const endY = parseInt(toDate.slice(0, 4), 10);
  const endM = parseInt(toDate.slice(5, 7), 10);
  const slices: Array<{ year: number; month: number; fromDate: string; toDate: string }> = [];

  while (y < endY || (y === endY && m <= endM)) {
    const ld = lastDayOfMonth(y, m);
    const monthStart = `${y}-${pad2(m)}-01`;
    const monthEnd = `${y}-${pad2(m)}-${pad2(ld)}`;
    const sliceFrom = fromDate > monthStart ? fromDate : monthStart;
    const sliceTo = toDate < monthEnd ? toDate : monthEnd;
    if (sliceFrom <= sliceTo) {
      slices.push({ year: y, month: m, fromDate: sliceFrom, toDate: sliceTo });
    }
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return slices;
}

export function mergeSpecialDayPeriods(
  existing: SpecialDayPeriod[],
  incoming: SpecialDayPeriod[],
): SpecialDayPeriod[] {
  const byId = new Map<string, SpecialDayPeriod>();
  for (const row of existing) {
    if (row?.id) byId.set(row.id, row);
  }
  for (const row of incoming) {
    if (row?.id) byId.set(row.id, row);
  }
  return Array.from(byId.values()).sort((a, b) =>
    a.fromDate.localeCompare(b.fromDate) || a.name.localeCompare(b.name),
  );
}

export function occasionsToSpecialDayPeriods(
  year: number,
  occasions: Array<{
    id: string;
    nameAr: string;
    nameEn: string;
    fromDate: string;
    toDate: string;
    color: string;
  }>,
  lang: 'ar' | 'en',
): Map<number, SpecialDayPeriod[]> {
  const byMonth = new Map<number, SpecialDayPeriod[]>();

  for (const occ of occasions) {
    const name = lang === 'ar' ? occ.nameAr : occ.nameEn;
    const periodId = `saudi-${year}-${occ.id}`;
    const slices = splitDateRangeByMonth(occ.fromDate, occ.toDate).filter((s) => s.year === year);

    for (const slice of slices) {
      const period: SpecialDayPeriod = {
        id: periodId,
        name,
        fromDate: slice.fromDate,
        toDate: slice.toDate,
        color: occ.color,
      };
      const list = byMonth.get(slice.month) ?? [];
      list.push(period);
      byMonth.set(slice.month, list);
    }
  }

  return byMonth;
}
