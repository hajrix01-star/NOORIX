export const EMPLOYEE_HR_SERVICE_CATEGORIES = [
  'iqama_renewal',
  'sponsorship_transfer',
  'exit_reentry_visa',
  'flight_ticket',
  'medical_insurance',
  'health_certificate',
] as const;

export type EmployeeHrServiceCategory = (typeof EMPLOYEE_HR_SERVICE_CATEGORIES)[number];

export const RESIDENCY_STATUSES = ['active', 'expired', 'renewed'] as const;

const IQAMA_CATEGORIES = new Set<EmployeeHrServiceCategory>([
  'iqama_renewal',
  'sponsorship_transfer',
]);

/**
 * خدمات موظف دورية تظهر ضمن المصاريف الثابتة في التحليلات،
 * مع بقائها في مصدرها الصحيح (ملف الموظف) وعدم إنشاء فاتورة ثانية.
 */
export const RECURRING_HR_SERVICE_CATEGORIES = [
  'iqama_renewal',
  'medical_insurance',
  'health_certificate',
] as const;

export function isRecurringHrServiceCategory(category: string | null | undefined): boolean {
  return RECURRING_HR_SERVICE_CATEGORIES.includes(
    category as (typeof RECURRING_HR_SERVICE_CATEGORIES)[number],
  );
}

export function requiresIqamaNumber(category: string): boolean {
  return IQAMA_CATEGORIES.has(category as EmployeeHrServiceCategory);
}

export function usesCompanyAsSponsor(category: string): boolean {
  return category === 'sponsorship_transfer';
}

export function companySponsorNameFromRecord(company: {
  nameAr: string;
  nameEn?: string | null;
}): string {
  return (company.nameAr || company.nameEn || '').trim();
}

export function requiresExpiryDate(category: string): boolean {
  return ['iqama_renewal', 'medical_insurance', 'health_certificate'].includes(category);
}

export function requiresReferenceLabel(_category: string): boolean {
  return false;
}

export function requiresVisaDurationMonths(category: string): boolean {
  return category === 'exit_reentry_visa';
}

export function formatVisaDurationReferenceAr(months: number): string {
  if (months === 1) return 'شهر واحد';
  if (months === 2) return 'شهران';
  return `${months} أشهر`;
}

export function serviceCategoryLabelAr(category: string): string {
  const map: Record<string, string> = {
    iqama_renewal: 'تجديد إقامة',
    sponsorship_transfer: 'نقل كفالة',
    exit_reentry_visa: 'تأشيرة خروج وعودة',
    flight_ticket: 'تذكرة سفر',
    medical_insurance: 'تأمين طبي',
    health_certificate: 'شهادة صحية',
  };
  return map[category] ?? category;
}

export function buildHrServiceInvoiceNotes(
  category: string,
  employeeName: string,
  extras?: { iqamaNumber?: string | null; referenceLabel?: string | null },
): string {
  const label = serviceCategoryLabelAr(category);
  const parts = [label, employeeName].filter(Boolean);
  if (extras?.iqamaNumber?.trim()) parts.push(extras.iqamaNumber.trim());
  if (extras?.referenceLabel?.trim()) parts.push(extras.referenceLabel.trim());
  return parts.join(' — ');
}
