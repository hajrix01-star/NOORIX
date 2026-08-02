import { TenantPrismaService } from '../prisma/tenant-prisma.service';

export type OrdersV4UserIdentity = {
  id: string;
  nameAr: string | null;
  nameEn: string | null;
  username: string | null;
};

export function ordersV4UsernameFromEmail(email?: string | null): string | null {
  const normalized = String(email || '').trim();
  if (!normalized) return null;
  const separatorIndex = normalized.indexOf('@');
  return separatorIndex > 0 ? normalized.slice(0, separatorIndex) : normalized;
}

export async function loadOrdersV4UserIdentities(
  prisma: TenantPrismaService,
  userIds: Array<string | null | undefined>,
): Promise<Map<string, OrdersV4UserIdentity>> {
  const ids = [...new Set(userIds.filter((id): id is string => !!id))];
  if (!ids.length) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, nameAr: true, nameEn: true, email: true },
  });
  return new Map(users.map((user) => [user.id, {
    id: user.id,
    nameAr: user.nameAr,
    nameEn: user.nameEn,
    username: ordersV4UsernameFromEmail(user.email),
  }]));
}

export function ordersV4UserIdentity(
  identities: Map<string, OrdersV4UserIdentity>,
  userId?: string | null,
): OrdersV4UserIdentity | null {
  return userId ? identities.get(userId) ?? null : null;
}
