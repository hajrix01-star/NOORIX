import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { TenantContext } from '../common/tenant-context';
import {
  isShamiTaxWorkspace,
  matchesDirectorySearch,
  normalizeDirectoryText,
  directoryIdentitySimilarity,
} from './supplier-directory-search.util';
import { SUPPLIER_DIRECTORY_SEEDS } from './supplier-directory.seed';
import {
  HR_DEFAULT_DIRECTORY_CODES,
  HR_SERVICE_CATEGORY_CODES,
  HR_SERVICE_DIRECTORY_CODES,
} from './supplier-directory-hr.util';

type DirectoryEntryRow = {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string | null;
  aliases: Prisma.JsonValue;
  searchText: string;
  entityType: string;
  defaultCategoryCode: string;
  isTaxRegistered: boolean;
  taxNumber: string | null;
  supplierInvoiceNumberRequired: boolean;
  isActive: boolean;
  sortOrder: number;
};

type SupplierMatchRow = {
  id: string;
  nameAr: string;
  nameEn: string | null;
  directoryEntryId: string | null;
  supplierCategoryId: string | null;
};

const CANONICAL_CATEGORY_FALLBACKS: Record<string, {
  parentCode: string;
  nameAr: string;
  nameEn: string;
  sortOrder: number;
}> = {
  'E2-8': {
    parentCode: 'EXP-002',
    nameAr: 'GOSI',
    nameEn: 'GOSI',
    sortOrder: 7,
  },
  'E2-10': {
    parentCode: 'EXP-002',
    nameAr: 'رسوم منصات حكومية',
    nameEn: 'Government Platform Fees',
    sortOrder: 9,
  },
  'E2-11': {
    parentCode: 'EXP-002',
    nameAr: 'شهادات صحية وتصاريح موظفين',
    nameEn: 'Health Certificates & Employee Permits',
    sortOrder: 10,
  },
  'E4-1': {
    parentCode: 'EXP-004',
    nameAr: 'تذاكر سفر الموظفين',
    nameEn: 'Employee Travel Tickets',
    sortOrder: 0,
  },
  'E4-2': {
    parentCode: 'EXP-004',
    nameAr: 'التأمين الطبي للموظفين',
    nameEn: 'Employee Medical Insurance',
    sortOrder: 1,
  },
};

function aliasesFromJson(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function entrySearchValues(entry: DirectoryEntryRow): string[] {
  return [entry.nameAr, entry.nameEn ?? '', ...aliasesFromJson(entry.aliases)];
}

function supplierSearchValues(supplier: SupplierMatchRow): string[] {
  return [supplier.nameAr, supplier.nameEn ?? ''];
}

function supplierMatchScore(entry: DirectoryEntryRow, supplier: SupplierMatchRow): number {
  if (supplier.directoryEntryId && supplier.directoryEntryId !== entry.id) return 0;
  const entryValues = entrySearchValues(entry).map(normalizeDirectoryText).filter(Boolean);
  const supplierValues = supplierSearchValues(supplier).map(normalizeDirectoryText).filter(Boolean);
  if (supplier.directoryEntryId === entry.id) return 1;
  if (supplierValues.some((value) => entryValues.includes(value))) return 0.99;

  let best = 0;
  for (const supplierValue of supplierValues) {
    for (const entryValue of entryValues) {
      best = Math.max(best, directoryIdentitySimilarity(supplierValue, entryValue));
    }
  }
  return best;
}

@Injectable()
export class SupplierDirectoryService implements OnModuleInit {
  private readonly logger = new Logger(SupplierDirectoryService.name);

  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly adminPrisma: PrismaService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedDirectory();
    await this.syncHrSuppliersForOperatingCompanies();
  }

  async seedDirectory(): Promise<void> {
    for (const row of SUPPLIER_DIRECTORY_SEEDS) {
      await this.prisma.supplierDirectoryEntry.upsert({
        where: { code: row.code },
        create: {
          id: row.code,
          code: row.code,
          nameAr: row.nameAr,
          nameEn: row.nameEn,
          aliases: row.aliases,
          searchText: row.searchText,
          entityType: row.entityType,
          defaultCategoryCode: row.defaultCategoryCode,
          isTaxRegistered: row.isTaxRegistered,
          taxNumber: row.taxNumber ?? null,
          supplierInvoiceNumberRequired: row.supplierInvoiceNumberRequired,
          sortOrder: row.sortOrder,
          isActive: true,
        },
        update: {
          nameAr: row.nameAr,
          nameEn: row.nameEn,
          aliases: row.aliases,
          searchText: row.searchText,
          entityType: row.entityType,
          defaultCategoryCode: row.defaultCategoryCode,
          isTaxRegistered: row.isTaxRegistered,
          taxNumber: row.taxNumber ?? null,
          supplierInvoiceNumberRequired: row.supplierInvoiceNumberRequired,
          sortOrder: row.sortOrder,
          isActive: true,
        },
      });
    }
    this.logger.log(`Ready supplier directory synchronized (${SUPPLIER_DIRECTORY_SEEDS.length} entries)`);
  }

  private runInTenant<T>(tenantId: string, task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      TenantContext.run(tenantId, null, () => {
        task().then(resolve, reject);
      });
    });
  }

  async syncHrSuppliersForOperatingCompanies(): Promise<void> {
    const [companies, existingLinks] = await Promise.all([
      this.adminPrisma.company.findMany({
        select: { id: true, tenantId: true, nameAr: true, nameEn: true },
      }),
      this.adminPrisma.supplier.findMany({
        where: {
          directoryEntryId: { in: HR_DEFAULT_DIRECTORY_CODES },
          isDeleted: false,
        },
        select: { companyId: true, directoryEntryId: true },
      }),
    ]);
    const existingLinkKeys = new Set(
      existingLinks.map((row) => `${row.companyId}:${row.directoryEntryId}`),
    );
    let linked = 0;
    let alreadyLinked = 0;
    let skipped = 0;

    for (const company of companies) {
      if (isShamiTaxWorkspace(company)) {
        skipped++;
        continue;
      }
      for (const code of HR_DEFAULT_DIRECTORY_CODES) {
        if (existingLinkKeys.has(`${company.id}:${code}`)) {
          alreadyLinked++;
          continue;
        }
        try {
          await this.runInTenant(company.tenantId, () => this.addToCompany(company.id, code));
          linked++;
        } catch (error) {
          this.logger.error(
            `تعذر ربط ${code} بالشركة ${company.id}; تُركت البيانات القائمة دون تغيير`,
            error instanceof Error ? error.stack : String(error),
          );
        }
      }
    }

    this.logger.log(
      `HR supplier links synchronized (${linked} added or linked, ${alreadyLinked} already linked, ${skipped} protected workspaces skipped)`,
    );
  }

  private async requireOperatingCompany(companyId: string) {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId },
      select: { id: true, tenantId: true, nameAr: true, nameEn: true },
    });
    if (!company) throw new NotFoundException('الشركة غير موجودة');
    if (isShamiTaxWorkspace(company)) {
      throw new BadRequestException('SHAMI TAX مستثناة من دليل الجهات الجاهزة حسب سياسة الشركة');
    }
    return company;
  }

  private rankMatches(entry: DirectoryEntryRow, suppliers: SupplierMatchRow[]) {
    return suppliers
      .map((supplier) => ({ supplier, score: supplierMatchScore(entry, supplier) }))
      .filter((match) => match.score >= 0.68)
      .sort((left, right) => right.score - left.score);
  }

  async list(companyId: string, query?: string) {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId },
      select: { id: true, nameAr: true, nameEn: true },
    });
    if (!company) throw new NotFoundException('الشركة غير موجودة');
    if (isShamiTaxWorkspace(company)) {
      return {
        available: false,
        reason: 'protected_tax_workspace',
        items: [],
      };
    }

    const [entries, suppliers, categories] = await Promise.all([
      this.prisma.supplierDirectoryEntry.findMany({
        where: { isActive: true },
        orderBy: [{ entityType: 'asc' }, { sortOrder: 'asc' }],
      }),
      this.prisma.supplier.findMany({
        where: { companyId, isDeleted: false },
        select: {
          id: true,
          nameAr: true,
          nameEn: true,
          directoryEntryId: true,
          supplierCategoryId: true,
        },
      }),
      this.prisma.category.findMany({
        where: { companyId, isActive: true },
        select: { id: true, code: true, nameAr: true, nameEn: true },
      }),
    ]);
    const categoryByCode = new Map(categories.map((category) => [category.code, category]));

    const items = (entries as DirectoryEntryRow[])
      .filter((entry) => matchesDirectorySearch(query, entrySearchValues(entry)))
      .map((entry) => {
        const matches = this.rankMatches(entry, suppliers);
        const linked = matches.find((match) => match.supplier.directoryEntryId === entry.id);
        const best = linked ?? matches[0];
        const ambiguous = !linked
          && matches.length > 1
          && Math.abs(matches[0].score - matches[1].score) < 0.08;
        const category = categoryByCode.get(entry.defaultCategoryCode) ?? null;
        return {
          code: entry.code,
          nameAr: entry.nameAr,
          nameEn: entry.nameEn,
          aliases: aliasesFromJson(entry.aliases),
          entityType: entry.entityType,
          defaultCategoryCode: entry.defaultCategoryCode,
          isTaxRegistered: entry.isTaxRegistered,
          supplierInvoiceNumberRequired: entry.supplierInvoiceNumberRequired,
          category,
          status: linked
            ? 'linked'
            : ambiguous
              ? 'ambiguous'
              : best
                ? 'existing'
                : 'available',
          existingSupplier: best?.supplier ?? null,
          matchScore: best ? Number(best.score.toFixed(3)) : null,
        };
      });

    return { available: true, reason: null, items };
  }

  private async ensureCategory(
    tx: Parameters<Parameters<TenantPrismaService['withTenant']>[0]>[0],
    company: { id: string; tenantId: string },
    categoryCode: string,
  ) {
    const existing = await tx.category.findFirst({
      where: { companyId: company.id, code: categoryCode },
    });
    if (existing) return existing;

    const fallback = CANONICAL_CATEGORY_FALLBACKS[categoryCode];
    if (!fallback) {
      throw new BadRequestException(`التصنيف ${categoryCode} غير موجود في الشركة`);
    }
    const parent = await tx.category.findFirst({
      where: { companyId: company.id, code: fallback.parentCode },
    });
    if (!parent) {
      throw new BadRequestException(`التصنيف الأب ${fallback.parentCode} غير موجود في الشركة`);
    }
    return tx.category.create({
      data: {
        tenantId: company.tenantId,
        companyId: company.id,
        accountId: parent.accountId,
        parentId: parent.id,
        code: categoryCode,
        nameAr: fallback.nameAr,
        nameEn: fallback.nameEn,
        type: parent.type,
        isActive: true,
        sortOrder: fallback.sortOrder,
      },
    });
  }

  async addToCompany(companyId: string, code: string) {
    const company = await this.requireOperatingCompany(companyId);
    const entry = await this.prisma.supplierDirectoryEntry.findFirst({
      where: { code, isActive: true },
    }) as DirectoryEntryRow | null;
    if (!entry) throw new NotFoundException('الجهة الجاهزة غير موجودة');

    return this.prisma.withTenant(async (tx) => {
      const category = await this.ensureCategory(tx, company, entry.defaultCategoryCode);
      const suppliers = await tx.supplier.findMany({
        where: { companyId, isDeleted: false },
        select: {
          id: true,
          nameAr: true,
          nameEn: true,
          directoryEntryId: true,
          supplierCategoryId: true,
        },
      });
      const linked = suppliers.find((supplier) => supplier.directoryEntryId === entry.id);
      if (linked) {
        return {
          action: 'already_linked',
          supplier: linked,
          category,
        };
      }

      const matches = this.rankMatches(entry, suppliers);
      if (
        matches.length > 1
        && Math.abs(matches[0].score - matches[1].score) < 0.08
      ) {
        throw new BadRequestException(
          `وجد أكثر من مورد مشابه للجهة: ${matches.slice(0, 3).map((row) => row.supplier.nameAr).join('، ')}`,
        );
      }

      const match = matches[0]?.supplier;
      if (match) {
        const supplier = await tx.supplier.update({
          where: { id: match.id },
          data: {
            directoryEntryId: entry.id,
            supplierCategoryId: match.supplierCategoryId || category.id,
          },
          include: { supplierCategory: { include: { account: true } }, directoryEntry: true },
        });
        return { action: 'linked', supplier, category };
      }

      const supplier = await tx.supplier.create({
        data: {
          tenantId: company.tenantId,
          companyId,
          directoryEntryId: entry.id,
          directoryManaged: true,
          nameAr: entry.nameAr,
          nameEn: entry.nameEn,
          taxNumber: entry.taxNumber,
          categoryId: 'expenses',
          supplierCategoryId: category.id,
          isTaxRegistered: entry.isTaxRegistered,
        },
        include: { supplierCategory: { include: { account: true } }, directoryEntry: true },
      });
      return { action: 'created', supplier, category };
    });
  }

  async ensureForHrService(companyId: string, serviceCategory: string) {
    const categoryCode = HR_SERVICE_CATEGORY_CODES[serviceCategory];
    if (!categoryCode) return null;
    const company = await this.prisma.company.findFirst({
      where: { id: companyId },
      select: { id: true, tenantId: true, nameAr: true, nameEn: true },
    });
    if (!company || isShamiTaxWorkspace(company)) return null;
    const category = await this.prisma.withTenant((tx) =>
      this.ensureCategory(tx, company, categoryCode),
    );
    const code = HR_SERVICE_DIRECTORY_CODES[serviceCategory];
    if (!code) {
      return {
        action: 'category_only' as const,
        supplier: null,
        category,
      };
    }
    const link = await this.addToCompany(companyId, code);
    return {
      ...link,
      category,
    };
  }
}
