import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContext } from '../common/tenant-context';
import { LoansService } from './loans.service';

function inTenant<T>(callback: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => TenantContext.run('tenant-1', 'user-1', () => callback().then(resolve, reject)));
}

function harness() {
  const tx = {
    loan: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'loan-1' }),
      update: jest.fn().mockResolvedValue({ id: 'loan-1' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    loanPayment: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }) => ({ id: data.id, ...data })),
      update: jest.fn().mockResolvedValue({}),
    },
    expenseLine: { findFirst: jest.fn().mockResolvedValue({ id: 'legacy-line', isActive: true }), update: jest.fn().mockResolvedValue({}) },
    invoice: { findMany: jest.fn().mockResolvedValue([{ id: 'invoice-1', invoiceNumber: 'EXP-1', transactionDate: new Date('2026-07-25T00:00:00.000Z'), totalAmount: new Prisma.Decimal('15356') }]) },
    loanLegacyInvoice: { findMany: jest.fn().mockResolvedValue([]), createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    account: { findFirst: jest.fn().mockImplementation(({ where }) => Promise.resolve(where.code === 'LOAN-001' ? { id: 'loan-account' } : { id: 'opening-account' })) },
    vault: { findFirst: jest.fn().mockResolvedValue({ id: 'vault-1', accountId: 'vault-account' }) },
    ledgerEntry: { create: jest.fn().mockImplementation(({ data }) => ({ id: 'ledger-1', ...data })) },
    auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
  };
  const db = { withTenant: jest.fn().mockImplementation((callback) => callback(tx)) };
  const fiscal = { assertPeriodOpenForDate: jest.fn().mockResolvedValue(undefined) };
  return { service: new LoansService(db as never, fiscal as never), tx, db, fiscal };
}

const opening = { nameAr: 'تمويل الراجحي', creditorName: 'مصرف الراجحي', amount: 416435.58, openingDate: '2026-08-08', historicalPaymentsCount: 21, historicalPaidAmount: 323894.34, historicalPaidThroughDate: '2026-07-25', idempotencyKey: 'loan-open-1' };
const payment = { vaultId: 'vault-1', amount: 15423.54, transactionDate: '2026-08-25', idempotencyKey: 'loan-pay-1' };

describe('LoansService', () => {
  it('creates a unified opening balance without an invoice or vault movement', async () => {
    const { service, tx } = harness();
    await inTenant(() => service.create('company-1', opening, 'user-1'));
    expect(tx.ledgerEntry.create).toHaveBeenCalledWith({ data: expect.objectContaining({ debitAccountId: 'opening-account', creditAccountId: 'loan-account', amount: expect.objectContaining({}), referenceType: 'loan_opening' }) });
    expect(tx.loan.create).toHaveBeenCalledWith({ data: expect.objectContaining({ openingAmount: expect.objectContaining({}), outstandingAmount: expect.objectContaining({}), historicalPaymentsCount: 21 }) });
  });

  it('posts a full installment against the unified balance and the selected vault', async () => {
    const { service, tx } = harness();
    tx.loan.findFirst.mockResolvedValue({ id: 'loan-1' });
    await inTenant(() => service.pay('loan-1', 'company-1', payment, 'user-1'));
    expect(tx.loan.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ outstandingAmount: { gte: expect.objectContaining({}) } }) }));
    expect(tx.ledgerEntry.create).toHaveBeenCalledWith({ data: expect.objectContaining({ debitAccountId: 'loan-account', creditAccountId: 'vault-account', referenceType: 'loan_payment' }) });
  });

  it('rejects a replay key that carries different payment data', async () => {
    const { service, tx } = harness();
    tx.loanPayment.findFirst.mockResolvedValue({ requestHash: 'another-request' });
    await expect(inTenant(() => service.pay('loan-1', 'company-1', payment, 'user-1'))).rejects.toBeInstanceOf(ConflictException);
    expect(tx.ledgerEntry.create).not.toHaveBeenCalled();
  });

  it('reverses a payment with an immutable opposite ledger entry and restores the balance', async () => {
    const { service, tx } = harness();
    tx.loanPayment.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'payment-1', loanId: 'loan-1', companyId: 'company-1', status: 'posted', reversalOfId: null, reversal: null, amount: new Prisma.Decimal('15423.54'), transactionDate: new Date('2026-08-25T00:00:00.000Z'), vaultId: 'vault-1', vault: { accountId: 'vault-account' } });
    tx.loan.findFirst.mockResolvedValue({ id: 'loan-1' });
    await inTenant(() => service.reversePayment('loan-1', 'payment-1', 'company-1', { transactionDate: '2026-08-26', idempotencyKey: 'loan-reverse-1' }, 'user-1'));
    expect(tx.ledgerEntry.create).toHaveBeenCalledWith({ data: expect.objectContaining({ debitAccountId: 'vault-account', creditAccountId: 'loan-account', referenceType: 'loan_payment_reversal' }) });
    expect(tx.loan.update).toHaveBeenCalledWith({ where: { id: 'loan-1' }, data: { outstandingAmount: { increment: expect.objectContaining({}) } } });
    expect(tx.loanPayment.update).toHaveBeenCalledWith({ where: { id: 'payment-1' }, data: expect.objectContaining({ status: 'reversed' }) });
  });

  it('links old loan invoices as documentation without creating a ledger entry and archives the old expense line', async () => {
    const { service, tx } = harness();
    tx.loan.findFirst.mockResolvedValue({ id: 'loan-1', isActive: true });
    await inTenant(() => service.migrateLegacyInvoices('loan-1', 'company-1', { expenseLineId: 'legacy-line', archiveExpenseLine: true }, 'user-1'));
    expect(tx.loanLegacyInvoice.createMany).toHaveBeenCalledWith(expect.objectContaining({ data: [expect.objectContaining({ invoiceId: 'invoice-1', loanId: 'loan-1', sourceExpenseLineId: 'legacy-line' })] }));
    expect(tx.expenseLine.update).toHaveBeenCalledWith({ where: { id: 'legacy-line' }, data: { isActive: false } });
    expect(tx.ledgerEntry.create).not.toHaveBeenCalled();
  });
});
