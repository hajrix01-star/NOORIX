import {
  EMPLOYEE_HR_SERVICE_CATEGORIES,
  isRecurringHrServiceCategory,
  requiresExpiryDate,
  requiresReferenceLabel,
  serviceCategoryLabelAr,
} from './employee-hr-service-categories';

describe('health certificate employee service contract', () => {
  it('is accepted by the backend category contract', () => {
    expect(EMPLOYEE_HR_SERVICE_CATEGORIES).toContain('health_certificate');
    expect(serviceCategoryLabelAr('health_certificate')).toBe('شهادة صحية');
  });

  it('classifies only recurring employee services as fixed in reporting', () => {
    expect(isRecurringHrServiceCategory('iqama_renewal')).toBe(true);
    expect(isRecurringHrServiceCategory('medical_insurance')).toBe(true);
    expect(isRecurringHrServiceCategory('health_certificate')).toBe(true);
    expect(isRecurringHrServiceCategory('flight_ticket')).toBe(false);
    expect(isRecurringHrServiceCategory('sponsorship_transfer')).toBe(false);
    expect(EMPLOYEE_HR_SERVICE_CATEGORIES).not.toContain('iqama_new');
  });

  it('keeps the certificate number optional and requires an expiry date', () => {
    expect(requiresReferenceLabel('health_certificate')).toBe(false);
    expect(requiresExpiryDate('health_certificate')).toBe(true);
  });
});
