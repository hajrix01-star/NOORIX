import { describe, expect, it } from 'vitest';
import {
  HR_SERVICE_CATEGORIES,
  HR_SERVICE_QUICK_ADD,
  HR_SERVICE_CATEGORY_LABEL_KEYS,
  formatHrServiceDetail,
  isHealthCertificate,
  referenceLabelKey,
  requiresExpiryDate,
  requiresReferenceLabel,
  showsIssueDate,
  showsReferenceLabel,
} from './employeeHrServiceCategories';

describe('health certificate employee service contract', () => {
  it('registers the category in selectors and quick add', () => {
    expect(HR_SERVICE_CATEGORIES).toContain('health_certificate');
    expect(HR_SERVICE_QUICK_ADD).toContain('health_certificate');
    expect(HR_SERVICE_CATEGORY_LABEL_KEYS.health_certificate).toBe('hrServiceHealthCertificate');
  });

  it('requires its official lifecycle fields', () => {
    expect(isHealthCertificate('health_certificate')).toBe(true);
    expect(showsReferenceLabel('health_certificate')).toBe(true);
    expect(requiresReferenceLabel('health_certificate')).toBe(true);
    expect(referenceLabelKey('health_certificate')).toBe('hrServiceCertificateNumber');
    expect(showsIssueDate('health_certificate')).toBe(true);
    expect(requiresExpiryDate('health_certificate')).toBe(true);
  });

  it('shows the official issuer with the certificate number', () => {
    const t = (key: string) => key === 'hrServiceMunicipalitiesMinistry' ? 'وزارة البلديات والإسكان' : key;
    expect(formatHrServiceDetail({
      serviceCategory: 'health_certificate',
      referenceLabel: 'HC-2026-001',
    }, t)).toBe('HC-2026-001 — وزارة البلديات والإسكان');
  });
});
