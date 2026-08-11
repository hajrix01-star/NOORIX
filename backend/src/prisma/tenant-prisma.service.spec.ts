import { Prisma } from '@prisma/client';
import { TenantContext } from '../common/tenant-context';
import { TenantPrismaService } from './tenant-prisma.service';

describe('TenantPrismaService.withTenant', () => {
  it('sets the local tenant before the callback and preserves Serializable isolation', async () => {
    const events: string[] = [];
    const tx = {
      $executeRaw: jest.fn().mockImplementation((_query: TemplateStringsArray, tenantId: string) => {
        events.push(`set_config:${tenantId}`);
        return Promise.resolve(1);
      }),
    };
    const prisma = Object.create(TenantPrismaService.prototype) as TenantPrismaService;
    Object.defineProperty(prisma, '$transaction', {
      value: jest.fn().mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx)),
    });

    let resultPromise: Promise<string> | undefined;
    TenantContext.run('tenant-1', 'owner-1', () => {
      resultPromise = prisma.withTenant(async () => {
        events.push('lock-and-reads');
        return 'ok';
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    });

    await expect(resultPromise).resolves.toBe('ok');
    expect(events).toEqual(['set_config:tenant-1', 'lock-and-reads']);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect((prisma.$transaction as jest.Mock).mock.calls[0][1]).toMatchObject({
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });
});
