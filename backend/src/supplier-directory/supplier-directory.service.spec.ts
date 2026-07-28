import { SupplierDirectoryService } from './supplier-directory.service';

describe('SupplierDirectoryService safe supplier linking', () => {
  const service = new SupplierDirectoryService({} as never);
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
    return (service as unknown as {
      rankMatches: (
        entry: typeof hrsdEntry,
        rows: typeof suppliers,
      ) => Array<{ supplier: { id: string }; score: number }>;
    }).rankMatches(hrsdEntry, suppliers);
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
});
