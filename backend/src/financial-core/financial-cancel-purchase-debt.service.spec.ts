import { FinancialCancelService } from './financial-cancel.service';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { FinancialCoreSupportService } from './financial-core-support.service';

describe('FinancialCancelService purchase debt reopening', () => {
  it('reopens the staged debt atomically when its promoted invoice is cancelled', async () => {
    const tx = {
      invoice: {
        findFirst: jest.fn().mockResolvedValue({ id: 'invoice-1', companyId: 'company-1', status: 'active' }),
        update: jest.fn().mockResolvedValue({}),
      },
      purchaseDebtRecord: {
        findFirst: jest.fn().mockResolvedValue({ id: 'debt-1' }),
        update: jest.fn().mockResolvedValue({}),
      },
      ledgerEntry: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const db = {
      withTenant: jest.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const support = {
      resolveUserId: jest.fn().mockReturnValue('user-1'),
      resolveTenantId: jest.fn().mockReturnValue('tenant-1'),
      invoiceSnapshot: jest.fn().mockReturnValue({ id: 'invoice-1' }),
    };
    const service = new FinancialCancelService(
      db as unknown as TenantPrismaService,
      support as unknown as FinancialCoreSupportService,
    );

    await expect(service.cancelOperation({
      companyId: 'company-1', referenceType: 'invoice', referenceId: 'invoice-1',
    }, 'user-1')).resolves.toMatchObject({ purchaseDebtReopened: true });

    expect(tx.purchaseDebtRecord.update).toHaveBeenCalledWith({
      where: { id: 'debt-1' },
      data: {
        status: 'pending', promotedAt: null, promotedByUserId: null,
        promotedInvoiceId: null, promotionBatchId: null, promotionIdempotencyKey: null,
        promotionInvoiceIds: [],
      },
    });
  });
});
