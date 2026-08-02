import { Prisma, PrismaClient } from '@prisma/client';

function argument(name) {
  const direct = process.argv.find((value) => value.startsWith(`--${name}=`));
  if (direct) return direct.slice(name.length + 3).trim();
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? String(process.argv[index + 1] || '').trim() : '';
}

const companyId = argument('company-id');
if (!companyId) {
  console.error('Usage: npm run audit:orders-v3-cutover -- --company-id <company-id>');
  process.exit(2);
}

const prisma = new PrismaClient();
const sourceCounters = {
  OrderCatalogUnit: () => prisma.orderCatalogUnit.count({ where: { companyId } }),
  OrderCategory: () => prisma.orderCategory.count({ where: { companyId } }),
  OrderSection: () => prisma.orderSection.count({ where: { companyId } }),
  OrderProduct: () => prisma.orderProduct.count({ where: { companyId } }),
  Order: () => prisma.order.count({ where: { companyId } }),
  StaffOrder: () => prisma.staffOrder.count({ where: { companyId } }),
};

try {
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true, name: true } });
  if (!company) throw new Error(`Company not found: ${companyId}`);

  const [sourceEntries, maps, unverifiedMappings, inventorySnapshot, targets, legacyPurchase, v3Purchase] = await Promise.all([
    Promise.all(Object.entries(sourceCounters).map(async ([entity, count]) => [entity, await count()])),
    prisma.ordersV3MigrationMap.groupBy({
      by: ['sourceEntity'],
      where: { companyId, status: 'verified' },
      _count: { _all: true },
    }),
    prisma.ordersV3MigrationMap.count({ where: { companyId, status: { not: 'verified' } } }),
    prisma.ordersV3MigrationMap.count({ where: { companyId, sourceEntity: 'InventoryCutoverSnapshot', status: 'verified' } }),
    Promise.all([
      prisma.ordersV3Unit.count({ where: { companyId } }),
      prisma.ordersV3Category.count({ where: { companyId } }),
      prisma.ordersV3Section.count({ where: { companyId } }),
      prisma.ordersV3Item.count({ where: { companyId } }),
      prisma.ordersV3Document.count({ where: { companyId } }),
      prisma.ordersV3LedgerEntry.count({ where: { companyId } }),
    ]),
    prisma.order.aggregate({ where: { companyId, status: 'active' }, _sum: { totalAmount: true } }),
    prisma.ordersV3Document.aggregate({ where: { companyId, documentType: 'purchase', status: 'posted' }, _sum: { totalAmount: true } }),
  ]);

  const sourceCounts = Object.fromEntries(sourceEntries);
  const verifiedBySource = Object.fromEntries(maps.map((row) => [row.sourceEntity, row._count._all]));
  const coverage = Object.fromEntries(Object.entries(sourceCounts).map(([entity, sourceCount]) => {
    const verifiedCount = verifiedBySource[entity] || 0;
    return [entity, { sourceCount, verifiedCount, missingCount: Math.max(0, sourceCount - verifiedCount) }];
  }));
  const legacyPurchaseTotal = legacyPurchase._sum.totalAmount ?? new Prisma.Decimal(0);
  const v3PurchaseTotal = v3Purchase._sum.totalAmount ?? new Prisma.Decimal(0);
  const purchaseDifference = new Prisma.Decimal(v3PurchaseTotal).minus(legacyPurchaseTotal);
  const missingMappings = Object.values(coverage).reduce((sum, row) => sum + row.missingCount, 0);
  const ready = missingMappings === 0 && unverifiedMappings === 0 && inventorySnapshot === 1 && purchaseDifference.isZero();

  const report = {
    audit: 'orders-v3-cutover',
    readOnly: true,
    company,
    ready,
    gates: {
      mappingCoverage: { passed: missingMappings === 0, missingMappings, coverage },
      mappingVerification: { passed: unverifiedMappings === 0, unverifiedMappings },
      purchaseTotals: {
        passed: purchaseDifference.isZero(),
        legacyActiveTotal: legacyPurchaseTotal.toString(),
        v3PostedTotal: v3PurchaseTotal.toString(),
        difference: purchaseDifference.toString(),
      },
      inventoryCutoverSnapshot: { passed: inventorySnapshot === 1, verifiedSnapshots: inventorySnapshot },
    },
    targetCounts: {
      units: targets[0], categories: targets[1], sections: targets[2], items: targets[3], documents: targets[4], ledgerEntries: targets[5],
    },
    note: ready
      ? 'Data gates passed. Backup restore test and zero legacy API traffic remain operational gates before deletion.'
      : 'Do not delete legacy Orders. Resolve every failed gate first.',
  };
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = ready ? 0 : 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 2;
} finally {
  await prisma.$disconnect();
}
