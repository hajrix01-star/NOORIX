import {
  EMPLOYEE_HR_SERVICE_CATEGORIES,
  requiresExpiryDate,
  requiresReferenceLabel,
  serviceCategoryLabelAr,
} from './employee-hr-service-categories';

describe('health certificate employee service contract', () => {
  it('is accepted by the backend category contract', () => {
    expect(EMPLOYEE_HR_SERVICE_CATEGORIES).toContain('health_certificate');
    expect(serviceCategoryLabelAr('health_certificate')).toBe('شهادة صحية');
  });

  it('requires a certificate number and expiry date', () => {
    expect(requiresReferenceLabel('health_certificate')).toBe(true);
    expect(requiresExpiryDate('health_certificate')).toBe(true);
  });
});
