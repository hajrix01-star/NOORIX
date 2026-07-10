import { BadRequestException } from '@nestjs/common';
import { VaultsService } from './vaults.service';

describe('VaultsService', () => {
  it('blocks deleting a vault when its account appears in ledger entries', async () => {
    const count = jest.fn().mockResolvedValue(1);
    const prisma = Object.assign(Object.create(null), {
      vault: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'vault-1',
          companyId: 'company-1',
          accountId: 'account-1',
          nameAr: 'Vault',
        }),
        update: jest.fn(),
      },
      ledgerEntry: { count },
      auditLog: { create: jest.fn() },
    });
    const service = new VaultsService(
      prisma,
      Object.create(null),
    );

    await expect(service.remove('vault-1', 'company-1', 'user-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(count).toHaveBeenCalledWith({
      where: {
        companyId: 'company-1',
        OR: [
          { vaultId: 'vault-1' },
          { debitAccountId: 'account-1' },
          { creditAccountId: 'account-1' },
        ],
      },
    });
  });
});
