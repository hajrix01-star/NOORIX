import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { buildCompanyLogicalSnapshot } from './backup-company-export';
import { importBackupLogicalCoreEntities } from './backup-logical-import-core-entities.util';
import type { BackupLogicalImportTxParams } from './backup-logical-import-transaction.types';

type Row = Record<string, unknown>;
const date = new Date('2026-09-12T00:00:00.000Z');

function exportPrisma(data: Record<string, Row[]>): PrismaService {
  const delegates = new Map<PropertyKey, object>();
  return new Proxy({} as object, {
    get(_target, property) {
      if (property === 'company') {
        return { findUnique: jest.fn().mockResolvedValue({ id: 'source-company', tenantId: 'tenant-1', nameAr: 'Source' }) };
      }
      if (!delegates.has(property)) {
        delegates.set(property, { findMany: jest.fn().mockResolvedValue(data[String(property)] ?? []) });
      }
      return delegates.get(property);
    },
  }) as PrismaService;
}

function importTx() {
  const writes: Record<string, Row[]> = {};
  const create = (name: string) => jest.fn(async ({ data }: { data: Row }) => {
    (writes[name] ??= []).push(data);
    return data;
  });
  return {
    writes,
    tx: {
      company: { aggregate: jest.fn().mockResolvedValue({ _max: { sortOrder: 0 } }), create: create('company') },
      account: { create: create('account') },
      category: { create: create('category') },
      supplierDirectoryEntry: { findMany: jest.fn().mockResolvedValue([]) },
      supplier: { create: create('supplier') },
      vault: { create: create('vault') },
      expenseLine: { create: create('expenseLine') },
      employee: { create: create('employee') },
      fiscalPeriod: { create: create('fiscalPeriod') },
    } as unknown as Prisma.TransactionClient,
  };
}

function params(data: Record<string, unknown>): BackupLogicalImportTxParams {
  let sequence = 0;
  return {
    tenantId: 'tenant-1', newCompanyId: 'restored-company', data, counts: {},
    nameAr: 'Restored', resolvedNameEn: null, importingUserId: 'import-user', co: {}, strictAlloc: false,
    logger: new Logger('BackupSupplierTaxCategoryRoundtrip'), nid: () => `new-${++sequence}`,
  };
}

describe('supplier tax and category logical backup round-trip', () => {
  it('preserves tax registration and remaps the supplier category during restore', async () => {
    const snapshot = await buildCompanyLogicalSnapshot(exportPrisma({
      category: [{ id: 'category-old', nameAr: 'مواد غذائية', type: 'purchase', createdAt: date, updatedAt: date }],
      supplier: [{
        id: 'supplier-old', nameAr: 'مورد', taxNumber: '300123456789012', isTaxRegistered: false,
        supplierCategoryId: 'category-old', createdAt: date, updatedAt: date,
      }],
    }), 'source-company');

    expect(snapshot.data.suppliers).toEqual([expect.objectContaining({
      taxNumber: '300123456789012', isTaxRegistered: false, supplierCategoryId: 'category-old',
    })]);
    expect(snapshot.data.categories).toEqual([expect.objectContaining({ id: 'category-old' })]);

    const { tx, writes } = importTx();
    const maps = await importBackupLogicalCoreEntities(tx, params(snapshot.data));

    expect(writes.supplier[0]).toEqual(expect.objectContaining({
      taxNumber: '300123456789012',
      isTaxRegistered: false,
      supplierCategoryId: maps.categoryMap.get('category-old'),
    }));
  });
});
