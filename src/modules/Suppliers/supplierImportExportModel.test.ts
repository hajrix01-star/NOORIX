import { describe, expect, it } from 'vitest';
import {
  buildSupplierCsv,
  buildSupplierExportCsv,
  importSupplierRows,
  parseSupplierCsv,
} from './supplierImportExportModel';

describe('supplier import/export model', () => {
  it('escapes CSV cells and exports supplier rows', () => {
    expect(buildSupplierCsv([['A,B', 'Q"R']])).toBe('"A,B","Q""R"');
    expect(buildSupplierExportCsv([
      { id: 's1', nameAr: 'مورد', nameEn: 'Supplier', supplierType: 'expenses' },
    ])).toContain('expenses');
  });

  it('parses Arabic or English CSV headers into supplier import rows', () => {
    expect(parseSupplierCsv('nameAr,nameEn,taxNumber,phone,supplierType\nمورد,,300,05,expenses')).toEqual([
      {
        nameAr: 'مورد',
        nameEn: undefined,
        taxNumber: '300',
        phone: '05',
        supplierType: 'expenses',
      },
    ]);
  });

  it('imports rows with company and default tax registration', async () => {
    const imported: unknown[] = [];
    const result = await importSupplierRows(
      [{ nameAr: 'مورد', supplierType: 'purchases' }],
      'c1',
      async (body) => {
        imported.push(body);
      },
    );

    expect(result).toEqual({ success: 1, failed: 0, errors: [] });
    expect(imported).toEqual([{ nameAr: 'مورد', supplierType: 'purchases', companyId: 'c1', isTaxRegistered: true }]);
  });
});
