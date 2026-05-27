/**
 * مناسبات سعودية — حساب أم القرى (نسخة الواجهة عند غياب API على الخادم).
 * يُحمَّل ديناميكياً مع @umalqura/core.
 */
import umalquraModule from '@umalqura/core';

const RIYADH_TZ = 'Asia/Riyadh';

type UmAlQuraStatic = {
  gregorianToHijri: (d: Date) => { hy: number; hm: number; hd: number };
  toDate: (hy: number, hm: number, hd: number, h?: number, m?: number, s?: number, ms?: number) => Date;
  getDaysInMonth: (hy: number, hm: number) => number;
  addDays: (d: Date, days: number) => Date;
};

function loadUmAlQuraStatic(): UmAlQuraStatic {
  const mod = umalquraModule as { $?: UmAlQuraStatic; default?: { $?: UmAlQuraStatic } };
  const api = mod.default ?? mod;
  const $ = api.$;
  if (!$?.gregorianToHijri || !$?.toDate) {
    throw new Error('@umalqura/core failed to load');
  }
  return $;
}

export type SaudiOccasionTemplate = {
  id: string;
  kind: string;
  nameAr: string;
  nameEn: string;
  fromDate: string;
  toDate: string;
  color: string;
  estimated: boolean;
};

const C = {
  founding: '#854F0B',
  national: '#185FA5',
  ramadan: '#8b5cf6',
  eid: '#3B6D11',
} as const;

const $ = loadUmAlQuraStatic();

function hijriToRiyadhYmd(hy: number, hm: number, hd: number): string {
  const d = $.toDate(hy, hm, hd, 12, 0, 0, 0);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: RIYADH_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const y = parts.find((p) => p.type === 'year')?.value ?? '';
  const m = parts.find((p) => p.type === 'month')?.value ?? '';
  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  return `${y}-${m}-${day}`;
}

function gregorianYmdInRiyadh(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: RIYADH_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const y = parts.find((p) => p.type === 'year')?.value ?? '';
  const m = parts.find((p) => p.type === 'month')?.value ?? '';
  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  return `${y}-${m}-${day}`;
}

export function shiftGregorianYmd(fromYmd: string, days: number): string {
  if (!days) return fromYmd;
  const [y, m, d] = fromYmd.split('-').map((x) => parseInt(x, 10));
  const base = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const next = $.addDays(base, days);
  return gregorianYmdInRiyadh(next);
}

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

function hijriYearsOverlappingGregorianYear(gy: number): number[] {
  const hStart = $.gregorianToHijri(new Date(gy, 0, 1, 12));
  const hEnd = $.gregorianToHijri(new Date(gy, 11, 31, 12));
  const years: number[] = [];
  for (let hy = hStart.hy; hy <= hEnd.hy; hy += 1) {
    years.push(hy);
  }
  return years;
}

function buildFixedGregorianOccasions(year: number): SaudiOccasionTemplate[] {
  const items: SaudiOccasionTemplate[] = [
    {
      id: 'founding',
      kind: 'founding',
      nameAr: 'يوم التأسيس',
      nameEn: 'Founding Day',
      fromDate: `${year}-02-22`,
      toDate: `${year}-02-23`,
      color: C.founding,
      estimated: false,
    },
    {
      id: 'national',
      kind: 'national',
      nameAr: 'اليوم الوطني',
      nameEn: 'National Day',
      fromDate: `${year}-09-23`,
      toDate: `${year}-09-26`,
      color: C.national,
      estimated: false,
    },
  ];
  return items
    .map((o) => {
      const clipped = clipToGregorianYear(o.fromDate, o.toDate, year);
      return clipped ? { ...o, ...clipped } : null;
    })
    .filter((x): x is SaudiOccasionTemplate => x != null);
}

function buildIslamicOccasionsForHijriYear(hy: number, gregorianYear: number): SaudiOccasionTemplate[] {
  const ramadanDays = $.getDaysInMonth(hy, 9);
  const eidFitrEndDay = Math.min(4, $.getDaysInMonth(hy, 10));
  const arafatYmd = hijriToRiyadhYmd(hy, 12, 9);
  const eidAdhaEndYmd = shiftGregorianYmd(arafatYmd, 3);

  const raw: SaudiOccasionTemplate[] = [
    {
      id: `ramadan-${hy}`,
      kind: 'ramadan',
      nameAr: 'رمضان',
      nameEn: 'Ramadan',
      fromDate: hijriToRiyadhYmd(hy, 9, 1),
      toDate: hijriToRiyadhYmd(hy, 9, ramadanDays),
      color: C.ramadan,
      estimated: true,
    },
    {
      id: `eid_fitr-${hy}`,
      kind: 'eid_fitr',
      nameAr: 'عيد الفطر',
      nameEn: 'Eid al-Fitr',
      fromDate: hijriToRiyadhYmd(hy, 10, 1),
      toDate: hijriToRiyadhYmd(hy, 10, eidFitrEndDay),
      color: C.eid,
      estimated: true,
    },
    {
      id: `eid_adha-${hy}`,
      kind: 'eid_adha',
      nameAr: 'عيد الأضحى',
      nameEn: 'Eid al-Adha',
      fromDate: arafatYmd,
      toDate: eidAdhaEndYmd,
      color: C.eid,
      estimated: true,
    },
  ];

  return raw
    .map((o) => {
      const clipped = clipToGregorianYear(o.fromDate, o.toDate, gregorianYear);
      if (!clipped) return null;
      return { ...o, ...clipped };
    })
    .filter((x): x is SaudiOccasionTemplate => x != null);
}

export function getSaudiOccasionsForYear(gregorianYear: number): SaudiOccasionTemplate[] {
  if (!Number.isFinite(gregorianYear) || gregorianYear < 1900 || gregorianYear > 2100) {
    return [];
  }

  const fixed = buildFixedGregorianOccasions(gregorianYear);
  const islamic: SaudiOccasionTemplate[] = [];
  for (const hy of hijriYearsOverlappingGregorianYear(gregorianYear)) {
    islamic.push(...buildIslamicOccasionsForHijriYear(hy, gregorianYear));
  }

  return [...fixed, ...islamic].sort(
    (a, b) => a.fromDate.localeCompare(b.fromDate) || a.kind.localeCompare(b.kind),
  );
}
