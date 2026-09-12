import { describe, expect, it } from 'vitest';
import {
  buildSupplierCsv,
  buildSupplierExportRows,
  importSupplierRows,
  parseSupplierCsv,
  SUPPLIER_EXPORT_COLUMNS,
} from './supplierImportExportModel';

describe('supplier import/export model', () => {
  it('escapes CSV cells and builds Excel rows with tax and supplier category', () => {
    expect(buildSupplierCsv([['A,B', 'Q"R']])).toBe('"A,B","Q""R"');
    expect(SUPPLIER_EXPORT_COLUMNS.map((column) => column.label)).toEqual(expect.arrayContaining([
      'الرقم الضريبي',
      'فئة المورد',
    ]));
    expect(buildSupplierExportRows([
      {
        id: 's1',
        nameAr: 'مورد',
        nameEn: 'Supplier',
        taxNumber: '300123456789012',
        supplierCategoryId: 'cat-1',
        isTaxRegistered: false,
        supplierType: 'expenses',
      },
    ], [{ id: 'cat-1', nameAr: 'مواد غذائية' }])).toEqual([{
      nameAr: 'مورد',
      nameEn: 'Supplier',
      taxNumber: '300123456789012',
      isTaxRegistered: 'غير مسجل',
      supplierCategory: 'مواد غذائية',
      phone: '',
      supplierType: 'expenses',
    }]);
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
