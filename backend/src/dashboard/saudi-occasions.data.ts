/**
 * مناسبات سعودية شائعة (تقويم أم القرى / إعلانات رسمية تقريبية).
 * يُحدَّث سنوياً — للعرض في لوحة التحكم فقط (تمييز التقويم).
 */
export type SaudiOccasionKind = 'founding' | 'national' | 'ramadan' | 'eid_fitr' | 'eid_adha';

export type SaudiOccasionTemplate = {
  id: string;
  kind: SaudiOccasionKind;
  nameAr: string;
  nameEn: string;
  fromDate: string;
  toDate: string;
  color: string;
};

const C = {
  founding: '#854F0B',
  national: '#185FA5',
  ramadan: '#8b5cf6',
  eidFitr: '#3B6D11',
  eidAdha: '#3B6D11',
} as const;

/** تواريخ تقريبية — راجع التحديث السنوي من الجهات الرسمية */
const SAUDI_OCCASIONS_BY_YEAR: Record<number, SaudiOccasionTemplate[]> = {
  2024: [
    { id: 'founding', kind: 'founding', nameAr: 'يوم التأسيس', nameEn: 'Founding Day', fromDate: '2024-02-22', toDate: '2024-02-23', color: C.founding },
    { id: 'ramadan', kind: 'ramadan', nameAr: 'رمضان', nameEn: 'Ramadan', fromDate: '2024-03-11', toDate: '2024-04-09', color: C.ramadan },
    { id: 'eid_fitr', kind: 'eid_fitr', nameAr: 'عيد الفطر', nameEn: 'Eid al-Fitr', fromDate: '2024-04-10', toDate: '2024-04-13', color: C.eidFitr },
    { id: 'eid_adha', kind: 'eid_adha', nameAr: 'عيد الأضحى', nameEn: 'Eid al-Adha', fromDate: '2024-06-16', toDate: '2024-06-19', color: C.eidAdha },
    { id: 'national', kind: 'national', nameAr: 'اليوم الوطني', nameEn: 'National Day', fromDate: '2024-09-23', toDate: '2024-09-26', color: C.national },
  ],
  2025: [
    { id: 'founding', kind: 'founding', nameAr: 'يوم التأسيس', nameEn: 'Founding Day', fromDate: '2025-02-22', toDate: '2025-02-23', color: C.founding },
    { id: 'ramadan', kind: 'ramadan', nameAr: 'رمضان', nameEn: 'Ramadan', fromDate: '2025-03-01', toDate: '2025-03-30', color: C.ramadan },
    { id: 'eid_fitr', kind: 'eid_fitr', nameAr: 'عيد الفطر', nameEn: 'Eid al-Fitr', fromDate: '2025-03-30', toDate: '2025-04-03', color: C.eidFitr },
    { id: 'eid_adha', kind: 'eid_adha', nameAr: 'عيد الأضحى', nameEn: 'Eid al-Adha', fromDate: '2025-06-06', toDate: '2025-06-09', color: C.eidAdha },
    { id: 'national', kind: 'national', nameAr: 'اليوم الوطني', nameEn: 'National Day', fromDate: '2025-09-23', toDate: '2025-09-26', color: C.national },
  ],
  2026: [
    { id: 'founding', kind: 'founding', nameAr: 'يوم التأسيس', nameEn: 'Founding Day', fromDate: '2026-02-22', toDate: '2026-02-23', color: C.founding },
    { id: 'ramadan', kind: 'ramadan', nameAr: 'رمضان', nameEn: 'Ramadan', fromDate: '2026-02-18', toDate: '2026-03-19', color: C.ramadan },
    { id: 'eid_fitr', kind: 'eid_fitr', nameAr: 'عيد الفطر', nameEn: 'Eid al-Fitr', fromDate: '2026-03-20', toDate: '2026-03-23', color: C.eidFitr },
    { id: 'eid_adha', kind: 'eid_adha', nameAr: 'عيد الأضحى', nameEn: 'Eid al-Adha', fromDate: '2026-05-27', toDate: '2026-05-30', color: C.eidAdha },
    { id: 'national', kind: 'national', nameAr: 'اليوم الوطني', nameEn: 'National Day', fromDate: '2026-09-23', toDate: '2026-09-26', color: C.national },
  ],
  2027: [
    { id: 'founding', kind: 'founding', nameAr: 'يوم التأسيس', nameEn: 'Founding Day', fromDate: '2027-02-22', toDate: '2027-02-23', color: C.founding },
    { id: 'ramadan', kind: 'ramadan', nameAr: 'رمضان', nameEn: 'Ramadan', fromDate: '2027-02-08', toDate: '2027-03-09', color: C.ramadan },
    { id: 'eid_fitr', kind: 'eid_fitr', nameAr: 'عيد الفطر', nameEn: 'Eid al-Fitr', fromDate: '2027-03-10', toDate: '2027-03-13', color: C.eidFitr },
    { id: 'eid_adha', kind: 'eid_adha', nameAr: 'عيد الأضحى', nameEn: 'Eid al-Adha', fromDate: '2027-05-17', toDate: '2027-05-20', color: C.eidAdha },
    { id: 'national', kind: 'national', nameAr: 'اليوم الوطني', nameEn: 'National Day', fromDate: '2027-09-23', toDate: '2027-09-26', color: C.national },
  ],
};

export function getSaudiOccasionsForYear(year: number): SaudiOccasionTemplate[] {
  return SAUDI_OCCASIONS_BY_YEAR[year] ?? [];
}

export function listSaudiOccasionYears(): number[] {
  return Object.keys(SAUDI_OCCASIONS_BY_YEAR)
    .map((y) => parseInt(y, 10))
    .sort((a, b) => a - b);
}
