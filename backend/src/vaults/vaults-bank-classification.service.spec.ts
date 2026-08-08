import { BadRequestException } from '@nestjs/common';
import { VaultsService } from './vaults.service';

function harness() {
  const vault = {
    id: 'vault-1', companyId: 'company-1', accountId: 'account-1',
    nameAr: 'Vault', nameEn: null, type: 'cash', isSalesChannel: false,
    showAsPaymentMethod: true, paymentMethod: 'cash', notes: null,
  };
  const prisma = Object.assign(Object.create(null), {
    vault: {
      findFirst: jest.fn().mockResolvedValue(vault),
      update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...vault, ...data })),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  });
  return { service: new VaultsService(prisma, Object.create(null)), prisma };
}

describe('VaultsService durable bank classification', () => {
  it('blocks changing the accounting type even before the first movement', async () => {
    const { service, prisma } = harness();
    await expect(service.update('vault-1', 'company-1', { type: 'bank' }, 'user-1'))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.vault.update).not.toHaveBeenCalled();
  });

  it('allows non-accounting edits without rewriting the frozen classification', async () => {
    const { service, prisma } = harness();
    await service.update('vault-1', 'company-1', { nameAr: 'Updated' }, 'user-1');
    expect(prisma.vault.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.not.objectContaining({ bankReconciliationEnabled: expect.anything() }),
    }));
  });
});
