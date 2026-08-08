export const HR_SERVICE_DIRECTORY_CODES: Readonly<Record<string, string>> = {
  iqama_renewal: 'GOV-HRSD',
  sponsorship_transfer: 'GOV-HRSD',
  exit_reentry_visa: 'GOV-PASSPORTS',
  health_certificate: 'GOV-MOMAH',
};

export const HR_SERVICE_CATEGORY_CODES: Readonly<Record<string, string>> = {
  iqama_renewal: 'E2-4',
  sponsorship_transfer: 'E2-10',
  exit_reentry_visa: 'E2-4',
  flight_ticket: 'E4-1',
  medical_insurance: 'E4-2',
  health_certificate: 'E2-11',
};

export const HR_DEFAULT_DIRECTORY_CODES = [
  ...new Set(Object.values(HR_SERVICE_DIRECTORY_CODES)),
];

export function hrServiceRequiresSupplier(serviceCategory: string): boolean {
  return serviceCategory !== 'medical_insurance'
    && Object.prototype.hasOwnProperty.call(HR_SERVICE_CATEGORY_CODES, serviceCategory);
}
