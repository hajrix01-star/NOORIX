import { Prisma } from '@prisma/client';
import { replaceOutflowInvoiceLedgerAndAllocations, scaleVaultAllocationsToTotal } from './financial-outflow-ledger.util';

describe('scaleVaultAllocationsToTotal', () => {
  it('يحافظ على مجموع يساوي newTotal لثلاث خزائن', () => {
    const rows = [
      { vaultId: 'a', amount: new Prisma.Decimal('30') },
      { vaultId: 'b', amount: new Prisma.Decimal('50') },
      { vaultId: 'c', amount: new Prisma.Decimal('20') },
    ];
    const newTotal = new Prisma.Decimal('100');
    const out = scaleVaultAllocationsToTotal(rows, newTotal);
    const sum = out.reduce((s, r) => s.plus(r.amount), new Prisma.Decimal(0));
    expect(sum.equals(newTotal)).toBe(true);
    expect(out).toHaveLength(3);
  });

  it('writes the reporting category snapshot on every rebuilt ledger split', async () => {
    const ledgerCreate = jest.fn().mockResolvedValue({ id: 'le-1' });
    const tx = {
      invoiceVaultAllocation: { deleteMany: jest.fn(), create: jest.fn() },
      ledgerEntry: { deleteMany: jest.fn(), create: ledgerCreate },
    } as never;
    await replaceOutflowInvoiceLedgerAndAllocations(
      tx,
      'company-1',
      {
        id: 'invoice-1', tenantId: 'tenant-1', transactionDate: new Date('2026-07-31T00:00:00.000Z'),
        employeeId: null, totalAmount: new Prisma.Decimal('100'),
      },
      'invoice-1',
      [{ vaultId: 'vault-1', amount: new Prisma.Decimal('100') }],
      'expense-account',
      new Date('2026-07-31T01:00:00.000Z'),
      'invoice',
      'operating_other_expense',
      { id: 'maintenance', nameAr: 'صيانة', nameEn: 'Maintenance' },
      'user-1',
      async () => 'vault-account',
    );

    expect(ledgerCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reportingClass: 'operating_other_expense',
        reportingCategoryId: 'maintenance',
        reportingCategoryNameAr: 'صيانة',
        reportingCategoryNameEn: 'Maintenance',
      }),
    });
  });
});
