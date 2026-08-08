import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FinancialCoreSupportService } from './financial-core-support.service';

describe('FinancialCoreSupportService vault transfer endpoints', () => {
  const service = new FinancialCoreSupportService();

  it('accepts two active non-archived vaults of the requested company', async () => {
    const tx = { vault: { findMany: jest.fn().mockResolvedValue([
      { id: 'a', nameAr: 'A', isActive: true, isArchived: false },
      { id: 'b', nameAr: 'B', isActive: true, isArchived: false },
    ]) } };
    await expect(service.assertVaultTransferEndpoints(tx as never, 'company-1', 'a', 'b'))
      .resolves.toBeUndefined();
    expect(tx.vault.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { in: ['a', 'b'] }, companyId: 'company-1' },
    }));
  });

  it('rejects a vault outside the company boundary', async () => {
    const tx = { vault: { findMany: jest.fn().mockResolvedValue([
      { id: 'a', nameAr: 'A', isActive: true, isArchived: false },
    ]) } };
    await expect(service.assertVaultTransferEndpoints(tx as never, 'company-1', 'a', 'other-company-vault'))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it.each([
    [{ id: 'a', nameAr: 'A', isActive: true, isArchived: true }],
    [{ id: 'a', nameAr: 'A', isActive: false, isArchived: false }],
  ])('rejects an inactive or archived endpoint', async (invalid) => {
    const tx = { vault: { findMany: jest.fn().mockResolvedValue([
      invalid,
      { id: 'b', nameAr: 'B', isActive: true, isArchived: false },
    ]) } };
    await expect(service.assertVaultTransferEndpoints(tx as never, 'company-1', 'a', 'b'))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows an accounting reversal through archived or inactive historical vaults', async () => {
    const tx = { vault: { findMany: jest.fn().mockResolvedValue([
      { id: 'a' },
      { id: 'b' },
    ]) } };
    await expect(service.assertVaultTransferReversalEndpoints(tx as never, 'company-1', 'a', 'b'))
      .resolves.toBeUndefined();
    expect(tx.vault.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['a', 'b'] }, companyId: 'company-1' },
      select: { id: true },
    });
  });
});
