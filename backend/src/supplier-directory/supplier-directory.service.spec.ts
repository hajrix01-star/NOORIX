import { SupplierDirectoryService } from './supplier-directory.service';
import { rankSupplierDirectoryMatches } from './supplier-directory-match.util';
import {
  HR_DEFAULT_DIRECTORY_CODES,
  HR_SERVICE_CATEGORY_CODES,
  HR_SERVICE_DIRECTORY_CODES,
  hrServiceRequiresSupplier,
} from './supplier-directory-hr.util';

describe('SupplierDirectoryService safe supplier linking', () => {
  const hrsdEntry = {
    id: 'GOV-HRSD',
    code: 'GOV-HRSD',
    nameAr: 'وزارة الموارد البشرية والتنمية الاجتماعية',
    nameEn: 'Ministry of Human Resources and Social Development',
    aliases: ['وزارة العمل', 'الموارد البشرية', 'HRSD'],
    searchText: '',
    entityType: 'government',
    defaultCategoryCode: 'E2-10',
    isTaxRegistered: false,
    taxNumber: null,
    supplierInvoiceNumberRequired: false,
    isActive: true,
    sortOrder: 60,
  };

  function rank(suppliers: Array<{
    id: string;
    nameAr: string;
    nameEn: string | null;
    directoryEntryId: string | null;
    supplierCategoryId: string | null;
  }>) {
    return rankSupplierDirectoryMatches(hrsdEntry, suppliers);
  }

  it('does not propose Ministry of Justice for HRSD', () => {
    expect(rank([{
      id: 'justice',
      nameAr: 'وزارة العدل',
      nameEn: 'Ministry of Justice',
      directoryEntryId: null,
      supplierCategoryId: null,
    }])).toEqual([]);
  });

  it('still recognizes the former Ministry of Labor name', () => {
    const matches = rank([{
      id: 'labor',
      nameAr: 'وزارة العمل',
      nameEn: null,
      directoryEntryId: null,
      supplierCategoryId: null,
    }]);
    expect(matches).toHaveLength(1);
    expect(matches[0].supplier.id).toBe('labor');
    expect(matches[0].score).toBe(0.99);
  });

  it('never reuses a supplier already linked to another directory entity', () => {
    expect(rank([{
      id: 'already-linked',
      nameAr: 'وزارة العمل',
      nameEn: null,
      directoryEntryId: 'GOV-MOJ',
      supplierCategoryId: null,
    }])).toEqual([]);
  });

  it('maps renewal to HRSD, never to Justice, while keeping passports services separate', () => {
    expect(HR_SERVICE_DIRECTORY_CODES.iqama_renewal).toBe('GOV-HRSD');
    expect(HR_SERVICE_DIRECTORY_CODES.sponsorship_transfer).toBe('GOV-HRSD');
    expect(HR_SERVICE_DIRECTORY_CODES.exit_reentry_visa).toBe('GOV-PASSPORTS');
    expect(Object.values(HR_SERVICE_DIRECTORY_CODES)).not.toContain('GOV-MOJ');
  });

  it('gives every HR service a dedicated category and keeps variable suppliers out of defaults', () => {
    expect(HR_SERVICE_CATEGORY_CODES).toMatchObject({
      iqama_renewal: 'E2-4',
      sponsorship_transfer: 'E2-10',
      exit_reentry_visa: 'E2-4',
      flight_ticket: 'E9-1',
      medical_insurance: 'E9-2',
      health_certificate: 'E2-11',
    });
    expect(HR_DEFAULT_DIRECTORY_CODES).toEqual(
      expect.arrayContaining(['GOV-PASSPORTS', 'GOV-HRSD', 'GOV-MOMAH']),
    );
    expect(HR_DEFAULT_DIRECTORY_CODES).toHaveLength(3);
    expect(hrServiceRequiresSupplier('iqama_renewal')).toBe(true);
    expect(hrServiceRequiresSupplier('flight_ticket')).toBe(true);
    expect(hrServiceRequiresSupplier('medical_insurance')).toBe(false);
  });

  it('synchronizes missing HR entities for operating companies and protects SHAMI TAX', async () => {
    const adminPrisma = {
      company: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'company-operating',
            tenantId: 'tenant-1',
            nameAr: 'شركة تشغيلية',
            nameEn: 'Operating Company',
          },
          {
            id: 'company-tax',
            tenantId: 'tenant-1',
            nameAr: 'SHAMI TAX',
            nameEn: 'SHAMI TAX',
          },
        ]),
      },
      supplier: {
        findMany: jest.fn().mockResolvedValue([{
          companyId: 'company-operating',
          directoryEntryId: 'GOV-HRSD',
        }]),
      },
    };
    const syncService = new SupplierDirectoryService({} as never, adminPrisma as never);
    const addSpy = jest.spyOn(syncService, 'addToCompany')
      .mockResolvedValue({} as never);
    const backfillSpy = jest.spyOn(syncService, 'backfillHrServiceSupplierLinksForCompany')
      .mockResolvedValue(3);

    await syncService.syncHrSuppliersForOperatingCompanies();

    expect(addSpy).toHaveBeenCalledTimes(2);
    expect(addSpy).toHaveBeenCalledWith('company-operating', 'GOV-PASSPORTS');
    expect(addSpy).toHaveBeenCalledWith('company-operating', 'GOV-MOMAH');
    expect(addSpy).not.toHaveBeenCalledWith('company-operating', 'GOV-HRSD');
    expect(addSpy).not.toHaveBeenCalledWith('company-tax', expect.any(String));
    expect(backfillSpy).toHaveBeenCalledTimes(1);
    expect(backfillSpy).toHaveBeenCalledWith('company-operating');
  });

  it('backfills only empty canonical service links and leaves variable entities unchanged', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const tenantPrisma = {
      supplier: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'passports', directoryEntryId: 'GOV-PASSPORTS' },
          { id: 'hrsd', directoryEntryId: 'GOV-HRSD' },
          { id: 'municipality', directoryEntryId: 'GOV-MOMAH' },
        ]),
      },
      employeeResidency: { updateMany },
    };
    const backfillService = new SupplierDirectoryService(
      tenantPrisma as never,
      {} as never,
    );

    const count = await backfillService.backfillHrServiceSupplierLinksForCompany('company-1');

    expect(count).toBe(4);
    expect(updateMany).toHaveBeenCalledTimes(4);
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        companyId: 'company-1',
        serviceCategory: 'iqama_renewal',
        supplierId: null,
      },
      data: { supplierId: 'hrsd' },
    });
    expect(updateMany.mock.calls.map((call) => call[0].where.serviceCategory))
      .not.toEqual(expect.arrayContaining(['flight_ticket', 'medical_insurance']));
  });
});
