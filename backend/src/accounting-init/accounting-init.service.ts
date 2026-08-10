import { BadRequestException, Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { DEFAULT_BANK_TREE_CATEGORY_SEEDS } from '../bank-statements/default-bank-tree-categories.seed';
import { isShamiTaxWorkspace } from '../supplier-directory/supplier-directory-search.util';
import { reportingClassForCategorySeed } from '../categories/category-reporting-classification.util';
import {
  MASTER_ACCOUNTS,
  MASTER_VAULTS,
  MASTER_CATEGORIES,
  MASTER_SUBCATEGORIES,
  MASTER_SUPPLIERS,
} from './accounting-init-master-seeds.util';
export type {
  MasterAccountSeed,
  MasterVaultSeed,
  MasterCategorySeed,
  SubCategorySeed,
  MasterSupplierSeed,
} from './accounting-init-master-seeds.util';
export {
  MASTER_ACCOUNTS,
  MASTER_VAULTS,
  MASTER_CATEGORIES,
  MASTER_SUBCATEGORIES,
  MASTER_SUPPLIERS,
} from './accounting-init-master-seeds.util';

@Injectable()
export class AccountingInitService {
  constructor(private readonly prisma: TenantPrismaService) {}

  async initializeCompanyAccounting(tenantId: string, companyId: string): Promise<{ accounts: number; vaults: number; categories: number; suppliers: number }> {
    const codeToAccountId: Record<string, string> = {};

    for (const acc of MASTER_ACCOUNTS) {
      const created = await this.prisma.account.create({
        data: {
          tenantId,
          companyId,
          code: acc.code,
          nameAr: acc.nameAr,
          nameEn: acc.nameEn,
          type: acc.type,
          icon: acc.icon,
          taxExempt: acc.taxExempt,
          isActive: true,
        },
      });
      codeToAccountId[acc.code] = created.id;
    }

    for (const v of MASTER_VAULTS) {
      const accountId = codeToAccountId[v.accountCode];
      if (!accountId) continue;
      await this.prisma.vault.create({
        data: {
          tenantId,
          companyId,
          accountId,
          nameAr: v.nameAr,
          nameEn: v.nameEn,
          type: v.type,
          isActive: true,
          isSalesChannel: v.type === 'cash',
          paymentMethod: v.type === 'cash' ? 'cash' : 'bank',
          bankReconciliationEnabled: v.type === 'bank',
        },
      });
    }

    const now = new Date();
    const year = now.getFullYear();
    await this.prisma.fiscalPeriod.create({
      data: {
        tenantId,
        companyId,
        nameAr: `السنة المالية ${year}`,
        nameEn: `Fiscal Year ${year}`,
        startDate: new Date(year, 0, 1),
        endDate: new Date(year, 11, 31),
        status: 'open',
      },
    });

    const accountCodeToCategoryId: Record<string, string> = {};
    for (let i = 0; i < MASTER_CATEGORIES.length; i++) {
      const cat = MASTER_CATEGORIES[i];
      const accountId = codeToAccountId[cat.accountCode];
      const acc = MASTER_ACCOUNTS.find((a) => a.code === cat.accountCode);
      const created = await this.prisma.category.create({
        data: {
          tenantId,
          companyId,
          accountId: accountId ?? null,
          code:      cat.accountCode,
          reportingClass: reportingClassForCategorySeed(cat.accountCode, cat.type),
          nameAr: cat.nameAr,
          nameEn: acc?.nameEn ?? null,
          type: cat.type,
          icon: acc?.icon ?? null,
          sortOrder: i,
          isActive: true,
        },
      });
      accountCodeToCategoryId[cat.accountCode] = created.id;
    }

    const subCategoryKeyToId: Record<string, string> = {};
    let subCount = 0;
    for (const sub of MASTER_SUBCATEGORIES) {
      const parentId = accountCodeToCategoryId[sub.parentAccountCode];
      const parentCat = MASTER_CATEGORIES.find((c) => c.accountCode === sub.parentAccountCode);
      if (!parentId || !parentCat) continue;
      const parentAccountId = codeToAccountId[sub.parentAccountCode] ?? null;
      const created = await this.prisma.category.create({
        data: {
          tenantId,
          companyId,
          parentId,
          accountId: parentAccountId,
          code:      sub.code,
          reportingClass: reportingClassForCategorySeed(sub.code, parentCat.type),
          nameAr: sub.nameAr,
          nameEn: sub.nameAr,
          type: parentCat.type,
          sortOrder: sub.sortOrder ?? 0,
          isActive: true,
        },
      });
      subCategoryKeyToId[`${sub.parentAccountCode}:${sub.nameAr}`] = created.id;
      subCount++;
    }

    let supplierCount = 0;
    for (const sup of MASTER_SUPPLIERS) {
      const categoryId = subCategoryKeyToId[`${sup.parentAccountCode}:${sup.subCategoryNameAr}`];
      if (!categoryId) continue;
      await this.prisma.supplier.create({
        data: {
          tenantId,
          companyId,
          directoryEntryId: sup.directoryCode,
          directoryManaged: true,
          nameAr: sup.nameAr,
          nameEn: sup.nameEn,
          taxNumber: sup.taxNumber,
          supplierCategoryId: categoryId,
          categoryId: 'expenses',
          isTaxRegistered: sup.isTaxRegistered,
          isDeleted: false,
        },
      });
      supplierCount++;
    }

    await this.seedDefaultBankTreeCategories(tenantId, companyId);

    return {
      accounts: MASTER_ACCOUNTS.length,
      vaults: MASTER_VAULTS.length,
      categories: MASTER_CATEGORIES.length + subCount,
      suppliers: supplierCount,
    };
  }

  async resetAndReinitializeCategories(tenantId: string, companyId: string): Promise<{
    deleted: { categories: number; oldAccounts: number };
    created: { categories: number };
  }> {
    const protectedCompany = await this.prisma.company.findFirst({
      where: { id: companyId, tenantId },
      select: { nameAr: true, nameEn: true },
    });
    if (protectedCompany && isShamiTaxWorkspace(protectedCompany)) {
      throw new BadRequestException('SHAMI TAX محمية من إعادة بناء التصنيفات');
    }

    const masterCodes = new Set(MASTER_ACCOUNTS.map((a) => a.code));

    await this.prisma.supplier.updateMany({
      where: { companyId },
      data:  { supplierCategoryId: null },
    });

    await this.prisma.expenseLine.deleteMany({ where: { companyId } });

    await this.prisma.category.deleteMany({ where: { companyId, parentId: { not: null } } });
    const delCats = await this.prisma.category.deleteMany({ where: { companyId } });

    const oldAccounts = await this.prisma.account.findMany({
      where: { companyId, code: { notIn: [...masterCodes] } },
    });
    let delAccounts = 0;
    for (const acc of oldAccounts) {
      const ledgerCount = await this.prisma.ledgerEntry.count({
        where: { companyId, OR: [{ debitAccountId: acc.id }, { creditAccountId: acc.id }] },
      });
      if (ledgerCount === 0) {
        await this.prisma.account.delete({ where: { id: acc.id } });
        delAccounts++;
      }
    }

    const codeToAccountId: Record<string, string> = {};
    for (const acc of MASTER_ACCOUNTS) {
      const existing = await this.prisma.account.findFirst({ where: { companyId, code: acc.code } });
      if (existing) {
        await this.prisma.account.update({
          where: { id: existing.id },
          data: { nameAr: acc.nameAr, nameEn: acc.nameEn, icon: acc.icon, isActive: true },
        });
        codeToAccountId[acc.code] = existing.id;
      } else {
        const created = await this.prisma.account.create({
          data: {
            tenantId,
            companyId,
            code: acc.code,
            nameAr: acc.nameAr,
            nameEn: acc.nameEn,
            type: acc.type,
            icon: acc.icon,
            taxExempt: acc.taxExempt,
            isActive: true,
          },
        });
        codeToAccountId[acc.code] = created.id;
      }
    }

    const accountCodeToCategoryId: Record<string, string> = {};
    for (let i = 0; i < MASTER_CATEGORIES.length; i++) {
      const cat = MASTER_CATEGORIES[i];
      const accountId = codeToAccountId[cat.accountCode];
      const acc = MASTER_ACCOUNTS.find((a) => a.code === cat.accountCode);
      const created = await this.prisma.category.create({
        data: {
          tenantId,
          companyId,
          accountId: accountId ?? null,
          code:      cat.accountCode,
          reportingClass: reportingClassForCategorySeed(cat.accountCode, cat.type),
          nameAr:    cat.nameAr,
          nameEn:    acc?.nameEn ?? null,
          type:      cat.type,
          icon:      acc?.icon ?? null,
          sortOrder: i,
          isActive:  true,
        },
      });
      accountCodeToCategoryId[cat.accountCode] = created.id;
    }

    let createdSubs = 0;
    for (const sub of MASTER_SUBCATEGORIES) {
      const parentId = accountCodeToCategoryId[sub.parentAccountCode];
      const parentCat = MASTER_CATEGORIES.find((c) => c.accountCode === sub.parentAccountCode);
      if (!parentId || !parentCat) continue;
      await this.prisma.category.create({
        data: {
          tenantId,
          companyId,
          parentId,
          accountId: codeToAccountId[sub.parentAccountCode] ?? null,
          code:      sub.code,
          reportingClass: reportingClassForCategorySeed(sub.code, parentCat.type),
          nameAr:    sub.nameAr,
          nameEn:    sub.nameAr,
          type:      parentCat.type,
          sortOrder: sub.sortOrder ?? 0,
          isActive:  true,
        },
      });
      createdSubs++;
    }

    return {
      deleted: { categories: delCats.count, oldAccounts: delAccounts },
      created: { categories: MASTER_CATEGORIES.length + createdSubs },
    };
  }

  async patchMissingSubcategories(tenantId: string, companyId: string): Promise<{ added: number; updated: number; skipped: number }> {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, tenantId },
      select: { nameAr: true, nameEn: true },
    });
    if (!company || isShamiTaxWorkspace(company)) {
      return { added: 0, updated: 0, skipped: MASTER_SUBCATEGORIES.length };
    }

    let added = 0;
    let updated = 0;
    let skipped = 0;

    for (const sub of MASTER_SUBCATEGORIES) {
      const exists = await this.prisma.category.findFirst({
        where: { companyId, code: sub.code },
      });

      if (exists) {
        if (!exists.nameEn || exists.nameEn === exists.nameAr) {
          await this.prisma.category.update({
            where: { id: exists.id },
            data: { nameEn: sub.nameEn, reportingClass: reportingClassForCategorySeed(sub.code, exists.type) },
          });
          updated++;
        } else {
          skipped++;
        }
        continue;
      }

      const parent = await this.prisma.category.findFirst({
        where: { companyId, code: sub.parentAccountCode },
      });
      if (!parent) { skipped++; continue; }

      await this.prisma.category.create({
        data: {
          tenantId,
          companyId,
          parentId:  parent.id,
          accountId: parent.accountId,
          code:      sub.code,
          reportingClass: reportingClassForCategorySeed(sub.code, parent.type),
          nameAr:    sub.nameAr,
          nameEn:    sub.nameEn,
          type:      parent.type,
          sortOrder: sub.sortOrder ?? 0,
          isActive:  true,
        },
      });
      added++;
    }

    return { added, updated, skipped };
  }

  async patchAllCompaniesSubcategories(tenantId: string): Promise<{
    companies: number;
    totalAdded: number;
    totalUpdated: number;
    details: Array<{ companyId: string; added: number; updated: number; skipped: number }>;
  }> {
    const companies = await this.prisma.company.findMany({ where: { tenantId } });
    let totalAdded = 0;
    let totalUpdated = 0;
    const details: Array<{ companyId: string; added: number; updated: number; skipped: number }> = [];
    for (const company of companies) {
      const result = await this.patchMissingSubcategories(tenantId, company.id);
      totalAdded   += result.added;
      totalUpdated += result.updated;
      details.push({ companyId: company.id, ...result });
    }
    return { companies: companies.length, totalAdded, totalUpdated, details };
  }

  async resetAllCompaniesCategories(tenantId: string): Promise<{
    companies: number;
    details: Array<{ companyId: string; result: Awaited<ReturnType<typeof this.resetAndReinitializeCategories>> }>;
  }> {
    const companies = await this.prisma.company.findMany({ where: { tenantId } });
    const details: Array<{ companyId: string; result: Awaited<ReturnType<typeof this.resetAndReinitializeCategories>> }> = [];
    for (const company of companies) {
      if (isShamiTaxWorkspace(company)) continue;
      const result = await this.resetAndReinitializeCategories(tenantId, company.id);
      details.push({ companyId: company.id, result });
    }
    return { companies: companies.length, details };
  }

  private async seedDefaultBankTreeCategories(tenantId: string, companyId: string): Promise<void> {
    const n = await this.prisma.bankTreeCategory.count({ where: { companyId } });
    if (n > 0) return;
    for (const row of DEFAULT_BANK_TREE_CATEGORY_SEEDS) {
      await this.prisma.bankTreeCategory.create({
        data: {
          tenantId,
          companyId,
          name: row.name,
          sortOrder: row.sortOrder,
          isActive: row.isActive,
          transactionSide: row.transactionSide,
          transactionType: row.transactionType,
          parentKeywords: row.parentKeywords as object,
          classifications: row.classifications as object,
        },
      });
    }
  }
}
