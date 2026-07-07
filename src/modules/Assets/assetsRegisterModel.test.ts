import { describe, expect, it } from 'vitest';
import {
  buildAssetCompletePayload,
  buildAssetCreatePayload,
  createWarrantyLineRow,
  initAssetFormFromInvoice,
  nextWarrantyLineKey,
  normalizeAssetRegisterPage,
  parseAssetWarrantyFilter,
} from './assetsRegisterModel';
import type { PendingWarrantyInvoiceRow } from '../../types/api';

describe('assetsRegisterModel', () => {
  it('builds typed asset create payload from form state', () => {
    const payload = buildAssetCreatePayload({
      nameAr: 'فرن رئيسي',
      nameEn: 'Main oven',
      serialNumber: 'SN-1',
      location: 'Branch A',
      purchaseDate: '2026-07-01',
      acquisitionCost: '1200.50',
      supplierId: 'supplier-1',
      warrantyDescription: 'ضمان الوكيل',
      warrantyMonths: '12',
      warrantyStartDate: '',
      warrantyEndDate: '',
      notes: 'note',
    }, 'company-1');

    expect(payload).toEqual({
      companyId: 'company-1',
      nameAr: 'فرن رئيسي',
      nameEn: 'Main oven',
      serialNumber: 'SN-1',
      location: 'Branch A',
      purchaseDate: '2026-07-01',
      acquisitionCost: 1200.5,
      supplierId: 'supplier-1',
      warrantyDescription: 'ضمان الوكيل',
      warrantyMonths: 12,
      notes: 'note',
    });
  });

  it('uses invoice total for draft acquisition cost and stable warranty line keys', () => {
    const invoice: PendingWarrantyInvoiceRow = {
      id: 'invoice-1',
      invoiceNumber: 'INV-1',
      kind: 'purchase',
      supplierInvoiceNumber: 'SUP-1',
      supplier: { id: 'supplier-1', nameAr: 'مورد' },
      transactionDate: '2026-07-02',
      totalAmount: '2300',
      notes: 'from invoice',
    };

    const form = initAssetFormFromInvoice(invoice, 'ar');
    const firstLine = createWarrantyLineRow('invoice-1-0');
    const secondKey = nextWarrantyLineKey(invoice.id, [firstLine]);
    const payload = buildAssetCompletePayload({
      ...form,
      warrantyMonths: '24',
    }, 'company-1', invoice.id, [
      { ...firstLine, nameAr: 'محرك', quantity: '2' },
    ]);

    expect(form.acquisitionCost).toBe('2300');
    expect(secondKey).toBe('invoice-1-1');
    expect(payload).toMatchObject({
      companyId: 'company-1',
      invoiceId: 'invoice-1',
      acquisitionCost: 2300,
      warrantyMonths: 24,
      warrantyLines: [{ nameAr: 'محرك', quantity: 2 }],
    });
  });

  it('normalizes filters and register pages without unsafe casts', () => {
    expect(parseAssetWarrantyFilter('expired')).toBe('expired');
    expect(parseAssetWarrantyFilter('bad-value')).toBe('all');
    expect(normalizeAssetRegisterPage(undefined)).toMatchObject({
      items: [],
      total: 0,
      sumAcquisitionCostFiltered: '0',
    });
  });
});
