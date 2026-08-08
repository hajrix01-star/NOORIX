import { describe, expect, it } from 'vitest';
import {
  HR_SERVICE_CATEGORIES,
  HR_SERVICE_QUICK_ADD,
  HR_SERVICE_CATEGORY_LABEL_KEYS,
  addOneCalendarYearYmd,
  defaultHrServiceSupplierId,
  formatHrServiceDetail,
  isHealthCertificate,
  referenceLabelKey,
  requiresExpiryDate,
  requiresInvoiceSupplierSelection,
  requiresHrServiceSupplier,
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
    expect(requiresReferenceLabel('health_certificate')).toBe(false);
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

  it('defaults health-certificate expiry to one editable calendar year', () => {
    expect(addOneCalendarYearYmd('2026-07-28')).toBe('2027-07-28');
    expect(addOneCalendarYearYmd('2028-02-29')).toBe('2029-02-28');
    expect(addOneCalendarYearYmd('invalid')).toBe('');
  });

  it('requires a supplier only for flight tickets', () => {
    expect(requiresInvoiceSupplierSelection('flight_ticket')).toBe(true);
    expect(requiresInvoiceSupplierSelection('medical_insurance')).toBe(false);
    expect(requiresInvoiceSupplierSelection('iqama_renewal')).toBe(false);
  });

  it('shows a required, changeable entity for every service except medical insurance', () => {
    expect(requiresHrServiceSupplier('iqama_renewal')).toBe(true);
    expect(requiresHrServiceSupplier('health_certificate')).toBe(true);
    expect(requiresHrServiceSupplier('flight_ticket')).toBe(true);
    expect(requiresHrServiceSupplier('medical_insurance')).toBe(false);
  });

  it('selects the canonical entity from the company supplier list', () => {
    const suppliers = [
      { id: 'passports', directoryEntryId: 'GOV-PASSPORTS' },
      { id: 'hrsd', directoryEntryId: 'GOV-HRSD' },
      { id: 'municipality', directoryEntryId: 'GOV-MOMAH' },
    ];
    expect(defaultHrServiceSupplierId('iqama_renewal', suppliers)).toBe('hrsd');
    expect(defaultHrServiceSupplierId('health_certificate', suppliers)).toBe('municipality');
    expect(defaultHrServiceSupplierId('medical_insurance', suppliers)).toBe('');
  });

  it('does not expose a separate new-residency service', () => {
    expect(HR_SERVICE_CATEGORIES).not.toContain('iqama_new');
    expect(HR_SERVICE_QUICK_ADD).not.toContain('iqama_new');
  });
});
