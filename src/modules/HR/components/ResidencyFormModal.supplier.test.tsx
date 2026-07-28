import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ResidencyFormModal } from './ResidencyFormModal';

const cachedSuppliers = [
  {
    id: 'supplier-hrsd',
    directoryEntryId: 'GOV-HRSD',
    nameAr: 'وزارة الموارد البشرية والتنمية الاجتماعية',
    nameEn: 'Ministry of Human Resources and Social Development',
    isDeleted: false,
  },
  {
    id: 'supplier-other',
    directoryEntryId: null,
    nameAr: 'مورد آخر',
    nameEn: 'Another supplier',
    isDeleted: false,
  },
];

vi.mock('../../../i18n/useTranslation', () => ({
  useTranslation: () => ({
    lang: 'ar',
    t: (key: string) => ({
      hrServiceEntitySupplier: 'الجهة / المورد',
      selectSupplierPlaceholder: 'اختر المورد',
      supplierSelectSearchPlaceholder: 'ابحث عن مورد',
    }[key] || key),
  }),
}));

vi.mock('../../../context/AppContext', () => ({
  useApp: () => ({
    activeCompanyId: 'company-1',
    companies: [{ id: 'company-1', nameAr: 'شركة الاختبار' }],
  }),
}));

vi.mock('../../../hooks/useVaults', () => ({
  useVaults: () => ({ paymentVaults: [] }),
}));

vi.mock('../../../hooks/useSuppliers', () => ({
  useSuppliers: () => ({ suppliers: cachedSuppliers }),
}));

vi.mock('../../../hooks/useApiQuery', () => ({
  useApiListQuery: () => ({ data: [] }),
}));

vi.mock('../../../services/api', () => ({
  createResidency: vi.fn(),
  updateResidency: vi.fn(),
  getEmployees: vi.fn(),
  throwIfApiFailed: vi.fn(),
}));

vi.mock('./HrServiceFormFields', () => ({
  HrServiceFormFields: () => null,
}));

describe('ResidencyFormModal supplier selection', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('keeps the HRSD default when reopening with suppliers already cached and supports search', async () => {
    render(
      <ResidencyFormModal
        companyId="company-1"
        defaultCategory="iqama_renewal"
        onClose={() => undefined}
      />,
    );

    const supplierInput = screen.getByLabelText('الجهة / المورد *') as HTMLInputElement;

    await waitFor(() => {
      expect(supplierInput.value).toBe('وزارة الموارد البشرية والتنمية الاجتماعية');
    });

    fireEvent.focus(supplierInput);
    fireEvent.change(supplierInput, { target: { value: 'البشرية' } });

    expect(screen.getByRole('option', { name: /وزارة الموارد البشرية/ })).toBeTruthy();
    expect(screen.queryByRole('option', { name: /مورد آخر/ })).toBeNull();
  });
});
