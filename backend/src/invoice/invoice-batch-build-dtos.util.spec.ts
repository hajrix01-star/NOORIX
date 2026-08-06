import type { TenantPrismaService } from '../prisma/tenant-prisma.service';
import type { CreateInvoiceBatchDto } from './dto/create-invoice-batch.dto';
import { buildOutflowDtosForInvoiceBatch } from './invoice-batch-build-dtos.util';

function prismaWithVariableExpenseLine(): TenantPrismaService {
  return {
    expenseLine: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'line-electricity',
        supplierId: 'supplier-electricity',
        categoryId: 'category-electricity',
        kind: 'expense',
        category: { accountId: 'account-electricity' },
      }),
    },
  } as unknown as TenantPrismaService;
}

function item(overrides: Partial<CreateInvoiceBatchDto['items'][number]> = {}): CreateInvoiceBatchDto['items'][number] {
  return {
    kind: 'fixed_expense',
    expenseLineId: 'line-electricity',
    totalAmount: 115,
    isTaxable: true,
    ...overrides,
  };
}

describe('buildOutflowDtosForInvoiceBatch', () => {
  it('rejects the whole batch when the resolved variable expense requires a supplier invoice number', async () => {
    await expect(buildOutflowDtosForInvoiceBatch(
      prismaWithVariableExpenseLine(),
      'company-1',
      [item()],
      '2026-08-06',
      'batch-1',
      'vault-1',
      '',
      15,
    )).rejects.toThrow('رقم فاتورة المورد مطلوب');
  });

  it('preserves order and resolves the authoritative line kind after validation succeeds', async () => {
    const dtos = await buildOutflowDtosForInvoiceBatch(
      prismaWithVariableExpenseLine(),
      'company-1',
      [item({ supplierInvoiceNumber: 'ELEC-2026-08' })],
      '2026-08-06',
      'batch-1',
      'vault-1',
      '',
      15,
    );

    expect(dtos).toHaveLength(1);
    expect(dtos[0]).toMatchObject({
      kind: 'expense',
      expenseLineId: 'line-electricity',
      supplierId: 'supplier-electricity',
      categoryId: 'category-electricity',
      debitAccountId: 'account-electricity',
      supplierInvoiceNumber: 'ELEC-2026-08',
      totalAmount: '115.0000',
      netAmount: '100.0000',
      taxAmount: '15.0000',
    });
  });
});
