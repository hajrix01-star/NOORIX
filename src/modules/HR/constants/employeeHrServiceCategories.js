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
];

/** ترتيب أزرار الإضافة السريعة (الأكثر استخداماً أولاً) */
export const HR_SERVICE_QUICK_ADD = [
  'iqama_renewal',
  'sponsorship_transfer',
  'exit_reentry_visa',
  'flight_ticket',
  'medical_insurance',
  'iqama_new',
];

export const HR_SERVICE_CATEGORY_LABEL_KEYS = {
  iqama_new: 'hrServiceIqamaNew',
  iqama_renewal: 'hrServiceIqamaRenewal',
  sponsorship_transfer: 'hrServiceSponsorshipTransfer',
  exit_reentry_visa: 'hrServiceExitReentry',
  flight_ticket: 'hrServiceFlightTicket',
  medical_insurance: 'hrServiceMedicalInsurance',
};

export function requiresIqamaNumber(category) {
  return ['iqama_new', 'iqama_renewal', 'sponsorship_transfer'].includes(category);
}

export function requiresExpiryDate(category) {
  return [
    'iqama_new',
    'iqama_renewal',
    'sponsorship_transfer',
    'exit_reentry_visa',
    'medical_insurance',
  ].includes(category);
}

export function showsReferenceLabel(category) {
  return ['exit_reentry_visa', 'flight_ticket', 'medical_insurance'].includes(category);
}

export function isSponsorshipTransfer(category) {
  return category === 'sponsorship_transfer';
}

/** نقل الكفالة — الكفيل الجديد دائماً الشركة النشطة (لا إدخال يدوي) */
export function usesCompanyAsSponsor(category) {
  return isSponsorshipTransfer(category);
}

export function referenceLabelKey(category) {
  if (category === 'flight_ticket') return 'hrServiceRouteLabel';
  if (category === 'medical_insurance') return 'hrServiceProviderLabel';
  if (category === 'sponsorship_transfer') return 'hrServiceTransferSponsorCompany';
  if (category === 'exit_reentry_visa') return 'hrServiceVisaDurationLabel';
  return 'referenceLabel';
}

export function companyDisplayName(company, lang = 'ar') {
  if (!company) return '';
  if (lang === 'en') return (company.nameEn || company.nameAr || company.name || '').trim();
  return (company.nameAr || company.nameEn || company.name || '').trim();
}
