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

  it('keeps the certificate number optional and requires an expiry date', () => {
    expect(requiresReferenceLabel('health_certificate')).toBe(false);
    expect(requiresExpiryDate('health_certificate')).toBe(true);
  });
});
