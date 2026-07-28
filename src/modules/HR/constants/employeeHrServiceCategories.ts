/**
 * أنواع خدمات الموظف — تبويبة الإقامات والخدمات
 */
export const HR_SERVICE_CATEGORIES = [
  'iqama_new',
  'iqama_renewal',
  'sponsorship_transfer',
  'exit_reentry_visa',
  'flight_ticket',
  'medical_insurance',
  'health_certificate',
];

/** ترتيب أزرار الإضافة السريعة (الأكثر استخداماً أولاً) */
export const HR_SERVICE_QUICK_ADD = [
  'iqama_renewal',
  'sponsorship_transfer',
  'exit_reentry_visa',
  'flight_ticket',
  'medical_insurance',
  'health_certificate',
  'iqama_new',
];

export const HR_SERVICE_CATEGORY_LABEL_KEYS: Record<string, string> = {
  iqama_new: 'hrServiceIqamaNew',
  iqama_renewal: 'hrServiceIqamaRenewal',
  sponsorship_transfer: 'hrServiceSponsorshipTransfer',
  exit_reentry_visa: 'hrServiceExitReentry',
  flight_ticket: 'hrServiceFlightTicket',
  medical_insurance: 'hrServiceMedicalInsurance',
  health_certificate: 'hrServiceHealthCertificate',
};

export function requiresIqamaNumber(category: string | null | undefined) {
  return ['iqama_new', 'iqama_renewal', 'sponsorship_transfer'].includes(String(category || ''));
}

export function showsReferenceLabel(category: string | null | undefined) {
  return ['flight_ticket', 'medical_insurance', 'health_certificate'].includes(String(category || ''));
}

export function requiresReferenceLabel(_category: string | null | undefined) {
  return false;
}

export function requiresInvoiceSupplierSelection(category: string | null | undefined) {
  return category === 'flight_ticket';
}

export {
  requiresExpiryDate,
  showsIssueDate,
  showsVisaDurationMonths,
  requiresVisaDurationMonths,
  VISA_DURATION_MONTHS,
  parseVisaDurationMonths,
  visaDurationLabel,
  formatHrServiceDetail,
  formatHrServiceSecondaryDate,
} from './employeeHrServiceFormFields';

export function isSponsorshipTransfer(category: string | null | undefined) {
  return category === 'sponsorship_transfer';
}

/** نقل الكفالة — الكفيل الجديد دائماً الشركة النشطة (لا إدخال يدوي) */
export function usesCompanyAsSponsor(category: string | null | undefined) {
  return isSponsorshipTransfer(category);
}

export function referenceLabelKey(category: string | null | undefined) {
  if (category === 'flight_ticket') return 'hrServiceRouteLabel';
  if (category === 'medical_insurance') return 'hrServiceProviderLabel';
  if (category === 'health_certificate') return 'hrServiceCertificateNumber';
  if (category === 'sponsorship_transfer') return 'hrServiceTransferSponsorCompany';
  if (category === 'exit_reentry_visa') return 'hrServiceVisaDurationLabel';
  return 'referenceLabel';
}

export function isHealthCertificate(category: string | null | undefined) {
  return category === 'health_certificate';
}

export function addOneCalendarYearYmd(value: string | null | undefined) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match) return '';
  const year = Number(match[1]) + 1;
  const month = Number(match[2]);
  const day = Number(match[3]);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}

export function companyDisplayName(
  company: { nameAr?: string | null; nameEn?: string | null; name?: string | null } | null | undefined,
  lang = 'ar',
) {
  if (!company) return '';
  if (lang === 'en') return (company.nameEn || company.nameAr || company.name || '').trim();
  return (company.nameAr || company.nameEn || company.name || '').trim();
}
