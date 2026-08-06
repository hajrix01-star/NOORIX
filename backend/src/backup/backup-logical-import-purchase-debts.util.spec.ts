import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { importBackupLogicalPurchaseDebts } from './backup-logical-import-purchase-debts.util';
import type { BackupLogicalImportTxParams } from './backup-logical-import-transaction.types';

describe('logical backup purchase debt round-trip', () => {
  it('restores supplier/invoice references and safe audit users', async () => {
    const create = jest.fn().mockResolvedValue({});
    const tx = { purchaseDebtRecord: { create } };
    const p: BackupLogicalImportTxParams = {
      tenantId: 'tenant-new', newCompanyId: 'company-new', importingUserId: 'import-user',
      nameAr: 'Restored', resolvedNameEn: null, co: {}, strictAlloc: false,
      logger: new Logger('PurchaseDebtBackup'),
      nid: () => 'debt-new',
      data: {
        purchaseDebtRecords: [{
          id: 'debt-old', supplierId: 'supplier-old', supplierInvoiceNumber: 'OLD-1',
          invoiceDate: '2025-01-01', totalAmount: '100', status: 'promoted',
          promotedInvoiceId: 'invoice-old', promotedAt: '2026-01-01',
          promotionBatchId: 'batch-1', promotionIdempotencyKey: 'idem-1',
          promotionInvoiceIds: ['invoice-old', 'invoice-other-old'],
          createdAt: '2025-01-01', updatedAt: '2026-01-01',
        }],
      },
    };

    await importBackupLogicalPurchaseDebts(tx as unknown as Prisma.TransactionClient, p, {
      supplierMap: new Map([['supplier-old', 'supplier-new']]),
      invoiceMap: new Map([
        ['invoice-old', 'invoice-new'],
        ['invoice-other-old', 'invoice-other-new'],
      ]),
    });

    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({
      id: 'debt-new', companyId: 'company-new', supplierId: 'supplier-new',
      promotedInvoiceId: 'invoice-new', createdByUserId: 'import-user',
      promotedByUserId: 'import-user', status: 'promoted',
      promotionInvoiceIds: ['invoice-new', 'invoice-other-new'],
    }) });
  });
});
