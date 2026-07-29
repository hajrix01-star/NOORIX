import type { TenantPrismaService } from '../prisma/tenant-prisma.service';

const DEFAULT_PREFIX = 'EMP';

export async function generateEmployeeSerial(
  prisma: TenantPrismaService,
  companyId: string,
): Promise<string> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { nameAr: true, nameEn: true },
  });
  const raw = (company?.nameEn || company?.nameAr || '').replace(/\s+/g, '');
  const prefix = raw.length >= 2
    ? raw.slice(0, 2).toUpperCase().replace(/[^A-Z0-9]/g, '')
    : '';
  const safePrefix = prefix.length >= 2 ? prefix : DEFAULT_PREFIX;

  const last = await prisma.employee.findFirst({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
    select: { employeeSerial: true },
  });

  let seq = 1;
  if (last?.employeeSerial) {
    const match = last.employeeSerial.match(/-(\d+)$/);
    if (match) seq = parseInt(match[1], 10) + 1;
  }
  return `${safePrefix}-ST-${String(seq).padStart(3, '0')}`;
}
