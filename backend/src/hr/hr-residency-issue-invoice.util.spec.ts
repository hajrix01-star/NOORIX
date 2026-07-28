import { TenantContext } from '../common/tenant-context';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { AccountingCoreService } from '../accounting-core/accounting-core.service';
import { SupplierDirectoryService } from '../supplier-directory/supplier-directory.service';
import { issueResidencyServiceInvoiceCore } from './hr-residency-issue-invoice.util';

function inTenant<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    TenantContext.run('tenant-1', 'user-1', () => {
      fn().then(resolve, reject);
    });
  });
}

describe('issueResidencyServiceInvoiceCore', () => {
  it('posts a health certificate against the government supplier and E2-11 category', async () => {
    const prisma = Object.assign(Object.create(TenantPrismaService.prototype), {
      vault: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'vault-1',
          nameAr: 'البنك',
          isActive: true,
          showAsPaymentMethod: true,
          isArchived: false,
        }]),
      },
      employeeResidency: { update: jest.fn().mockResolvedValue({}) },
      employeeMovement: { create: jest.fn().mockResolvedValue({}) },
    }) as TenantPrismaService;
    const accountingCore = Object.assign(Object.create(AccountingCoreService.prototype), {
      postHrServiceExpense: jest.fn().mockResolvedValue({
        invoice: { id: 'invoice-1', invoiceNumber: 'HR-001' },
      }),
    }) as AccountingCoreService & {
      postHrServiceExpense: jest.Mock;
    };
    const supplierDirectory = Object.assign(Object.create(SupplierDirectoryService.prototype), {
      ensureForHrService: jest.fn().mockResolvedValue({
        supplier: { id: 'municipality-supplier' },
        category: { id: 'e2-11-category', code: 'E2-11' },
      }),
    }) as SupplierDirectoryService & {
      ensureForHrService: jest.Mock;
    };

    await inTenant(() => issueResidencyServiceInvoiceCore(
      {
        prisma,
        accountingCore,
        supplierDirectory,
      },
      {
        id: 'residency-1',
        companyId: 'company-1',
        employeeId: 'employee-1',
        serviceCategory: 'health_certificate',
        iqamaNumber: null,
        referenceLabel: null,
        invoiceId: null,
        employee: { name: 'مكرم', nameEn: null },
      },
      'user-1',
      { amount: 300, vaultId: 'vault-1', transactionDate: '2026-07-28' },
    ));

    expect(supplierDirectory.ensureForHrService).toHaveBeenCalledWith(
      'company-1',
      'health_certificate',
    );
    expect(accountingCore.postHrServiceExpense).toHaveBeenCalledWith(
      expect.objectContaining({
        supplierId: 'municipality-supplier',
        categoryId: 'e2-11-category',
        taxAmount: '0',
      }),
      'user-1',
    );
    expect(accountingCore.postHrServiceExpense.mock.calls[0][0])
      .not.toHaveProperty('supplierInvoiceNumber');
  });
});
