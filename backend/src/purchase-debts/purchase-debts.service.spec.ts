import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { TenantContext } from '../common/tenant-context';
import { isFuturePurchaseDebtDate, PurchaseDebtsService } from './purchase-debts.service';

function pendingRecord() {
  return {
    id: 'debt-1', tenantId: 'tenant-1', companyId: 'company-1', supplierId: 'supplier-1',
    supplierInvoiceNumber: 'INV-1', normalizedInvoiceKey: 'inv-1',
    invoiceDate: new Date('2025-01-01'), totalAmount: new Prisma.Decimal(100),
    isTaxable: true, notes: null, status: 'pending',
    createdByUserId: 'user-1', promotedByUserId: null, promotedAt: null,
    promotedInvoiceId: null, promotionBatchId: null, promotionIdempotencyKey: null,
    promotionInvoiceIds: [],
    createdAt: new Date('2025-01-01'), updatedAt: new Date('2025-01-01'),
  };
}

function serviceHarness(updateCount: number) {
  const tx = {
    purchaseDebtRecord: {
      findFirst: jest.fn().mockResolvedValue(pendingRecord()),
      findFirstOrThrow: jest.fn().mockResolvedValue({ ...pendingRecord(), status: 'cancelled' }),
      updateMany: jest.fn().mockResolvedValue({ count: updateCount }),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    withTenant: jest.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
  };
  return {
    tx,
    service: new PurchaseDebtsService(prisma as unknown as TenantPrismaService),
  };
}

describe('PurchaseDebtsService concurrency guardrails', () => {
  it('cancels only through a conditional pending-state write', async () => {
    const { service, tx } = serviceHarness(1);
    await service.cancel('debt-1', 'company-1', 'user-1');
    expect(tx.purchaseDebtRecord.updateMany).toHaveBeenCalledWith({
      where: { id: 'debt-1', companyId: 'company-1', status: 'pending' },
      data: { status: 'cancelled' },
    });
  });

  it('fails closed if promotion wins the race before cancellation writes', async () => {
    const { service } = serviceHarness(0);
    await expect(service.cancel('debt-1', 'company-1', 'user-1'))
      .rejects.toThrow('تغيرت حالة السجل');
  });

  it('rejects a future supplier invoice date on the server', async () => {
    const { service } = serviceHarness(1);
    const future = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
    await expect(service.create('company-1', {
      supplierId: 'supplier-1', supplierInvoiceNumber: 'INV-2',
      invoiceDate: future, totalAmount: 100,
    }, 'user-1')).rejects.toThrow('المستقبل');
  });

  it('accepts the Riyadh calendar day while UTC is still on the previous day', () => {
    const riyadhJustAfterMidnight = new Date('2026-08-05T21:30:00.000Z');
    expect(isFuturePurchaseDebtDate('2026-08-06', riyadhJustAfterMidnight)).toBe(false);
    expect(isFuturePurchaseDebtDate('2026-08-07', riyadhJustAfterMidnight)).toBe(true);
  });
});

function runWithTenant<T>(work: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    TenantContext.run('tenant-1', 'user-1', () => work().then(resolve, reject));
  });
}

function batchHarness(options?: { stagedDuplicate?: boolean; activeInvoiceDuplicate?: boolean }) {
  let createSequence = 0;
  const tx = {
    supplier: {
      findMany: jest.fn().mockResolvedValue([{ id: 'supplier-1' }, { id: 'supplier-2' }]),
    },
    invoice: {
      findFirst: jest.fn().mockImplementation(() => Promise.resolve(
        options?.activeInvoiceDuplicate ? { invoiceNumber: 'P-100' } : null,
      )),
    },
    purchaseDebtRecord: {
      findMany: jest.fn().mockResolvedValue(options?.stagedDuplicate
        ? [{ supplierId: 'supplier-2', normalizedInvoiceKey: 'inv-2' }]
        : []),
      create: jest.fn().mockImplementation(({ data }) => {
        createSequence += 1;
        return Promise.resolve({
          ...pendingRecord(),
          ...data,
          id: `debt-${createSequence}`,
          totalAmount: new Prisma.Decimal(data.totalAmount),
        });
      }),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    withTenant: jest.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
  };
  return { tx, prisma, service: new PurchaseDebtsService(prisma as unknown as TenantPrismaService) };
}

const validBatch = {
  items: [
    { supplierId: 'supplier-1', supplierInvoiceNumber: 'INV-1', invoiceDate: '2025-01-01', totalAmount: 100 },
    { supplierId: 'supplier-2', supplierInvoiceNumber: 'INV-2', invoiceDate: '2025-01-02', totalAmount: 200, isTaxable: false },
  ],
};

describe('PurchaseDebtsService batch creation', () => {
  it('creates all rows and their audit entries inside one tenant transaction', async () => {
    const { service, tx, prisma } = batchHarness();
    const result = await runWithTenant(() => service.createBatch('company-1', validBatch, 'user-1'));
    expect(prisma.withTenant).toHaveBeenCalledTimes(1);
    expect(tx.purchaseDebtRecord.create).toHaveBeenCalledTimes(2);
    expect(tx.auditLog.create).toHaveBeenCalledTimes(2);
    expect(result.count).toBe(2);
    expect(result.items).toHaveLength(2);
  });

  it('rejects normalized duplicates inside the batch before opening a transaction', async () => {
    const { service, prisma } = batchHarness();
    await expect(runWithTenant(() => service.createBatch('company-1', {
      items: [
        { supplierId: 'supplier-1', supplierInvoiceNumber: ' INV ١ ', invoiceDate: '2025-01-01', totalAmount: 100 },
        { supplierId: 'supplier-1', supplierInvoiceNumber: 'inv1', invoiceDate: '2025-01-02', totalAmount: 200 },
      ],
    }, 'user-1'))).rejects.toThrow('تكرار داخل الدفعة');
    expect(prisma.withTenant).not.toHaveBeenCalled();
  });

  it('preflights existing staged invoices before creating any batch row', async () => {
    const { service, tx } = batchHarness({ stagedDuplicate: true });
    await expect(runWithTenant(() => service.createBatch('company-1', validBatch, 'user-1')))
      .rejects.toThrow('السطر 2 مسجلة مسبقًا');
    expect(tx.purchaseDebtRecord.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('preflights active purchase invoices before creating any batch row', async () => {
    const { service, tx } = batchHarness({ activeInvoiceDuplicate: true });
    await expect(runWithTenant(() => service.createBatch('company-1', validBatch, 'user-1')))
      .rejects.toThrow('فاتورة نشطة');
    expect(tx.purchaseDebtRecord.create).not.toHaveBeenCalled();
  });
});
