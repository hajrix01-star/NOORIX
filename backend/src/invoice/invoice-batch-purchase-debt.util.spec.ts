import type { TxClient } from '../financial-core/financial-core-helpers.util';
import {
  completePurchaseDebtPromotion,
  loadPurchaseDebtPromotionReplay,
  reserveAndHydratePurchaseDebtItems,
} from './invoice-batch-purchase-debt.util';

function txMock() {
  return {
    purchaseDebtRecord: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findFirstOrThrow: jest.fn().mockResolvedValue({
        id: 'debt-1',
        supplierId: 'supplier-trusted',
        supplierInvoiceNumber: 'OLD-77',
        invoiceDate: new Date('2025-01-02T00:00:00.000Z'),
        totalAmount: { toString: () => '1150', valueOf: () => 1150 },
        isTaxable: true,
        notes: 'trusted note',
        supplier: {
          supplierCategoryId: 'category-trusted',
          supplierCategory: { accountId: 'account-trusted' },
        },
      }),
    },
    invoice: { findMany: jest.fn() },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
}

describe('purchase debt batch promotion', () => {
  it('hydrates every protected invoice field from the reserved server record', async () => {
    const tx = txMock();
    const result = await reserveAndHydratePurchaseDebtItems(
      tx as unknown as TxClient,
      'company-1',
      [{
        legacyDebtId: 'debt-1',
        supplierId: 'supplier-hostile',
        supplierInvoiceNumber: 'HOSTILE',
        expenseLineId: 'line-hostile',
        categoryId: 'category-hostile',
        debitAccountId: 'account-hostile',
        kind: 'expense',
        totalAmount: 1,
        invoiceDate: '2026-08-06',
        isTaxable: false,
        notes: 'hostile note',
        warrantyFollowUp: true,
      }],
    );

    expect(result.debts).toEqual([{ id: 'debt-1', itemIndex: 0 }]);
    expect(result.items[0]).toMatchObject({
      legacyDebtId: 'debt-1',
      supplierId: 'supplier-trusted',
      supplierInvoiceNumber: 'OLD-77',
      expenseLineId: undefined,
      categoryId: 'category-trusted',
      debitAccountId: 'account-trusted',
      kind: 'purchase',
      totalAmount: 1150,
      invoiceDate: '2025-01-02',
      isTaxable: true,
      notes: 'trusted note',
      warrantyFollowUp: false,
    });
  });

  it('rejects the same debt twice before creating invoices', async () => {
    const tx = txMock();
    await expect(reserveAndHydratePurchaseDebtItems(
      tx as unknown as TxClient,
      'company-1',
      [
        { legacyDebtId: 'debt-1', kind: 'purchase', totalAmount: 100 },
        { legacyDebtId: 'debt-1', kind: 'purchase', totalAmount: 100 },
      ],
    )).rejects.toThrow('أكثر من مرة');
  });

  it('links the debt to the invoice and audit record in the same transaction', async () => {
    const tx = txMock();
    await completePurchaseDebtPromotion(
      tx as unknown as TxClient,
      'company-1',
      [{ id: 'debt-1', itemIndex: 1 }],
      [{ invoice: { id: 'invoice-other' } }, { invoice: { id: 'invoice-1' } }],
      'batch-1',
      'user-1',
      'tenant-1',
    );

    expect(tx.purchaseDebtRecord.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'debt-1', companyId: 'company-1', status: 'promoting' },
      data: expect.objectContaining({
        status: 'promoted', promotedInvoiceId: 'invoice-1', promotionBatchId: 'batch-1',
        promotionInvoiceIds: ['invoice-other', 'invoice-1'],
      }),
    }));
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it('replays the original batch after a lost response with the same idempotency key', async () => {
    const tx = txMock();
    tx.purchaseDebtRecord.findMany.mockResolvedValue([
      {
        status: 'promoted', promotionBatchId: 'batch-1', promotionIdempotencyKey: 'idem-1',
        promotionInvoiceIds: ['invoice-purchase', 'invoice-expense'],
      },
    ]);
    tx.invoice.findMany.mockResolvedValue([
      { id: 'invoice-expense', batchId: 'batch-1' },
      { id: 'invoice-purchase', batchId: 'batch-1' },
    ]);

    await expect(loadPurchaseDebtPromotionReplay(
      tx as unknown as TxClient,
      'company-1',
      ['debt-1'],
      'idem-1',
    )).resolves.toEqual({
      batchId: 'batch-1',
      invoices: [
        { id: 'invoice-purchase', batchId: 'batch-1' },
        { id: 'invoice-expense', batchId: 'batch-1' },
      ],
    });
  });
});
