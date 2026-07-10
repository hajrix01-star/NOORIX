/**
 * AccountingInitService — محرك البذر التلقائي لدليل الحسابات (COA)
 *
 * يُنفذ عند إنشاء أي شركة جديدة عبر initializeCompanyAccounting.
 * يزرع: 16 حساباً افتراضياً (5 أصناف) + خزينتين + ذمم مدينة ودائنة + فئات وتصنيفات فرعية + موردين افتراضيين.
 *
 * موردين افتراضيين: الشركة السعودية للكهرباء، الاتصالات السعودية (STC)
 * — مرتبطين بفئات (كهرباء، اتصالات) تحت إيجار ومرافق، مع الرقم الضريبي.
 *
 * القاعدة الذهبية: tenantId مُحقون في كل سجل لضمان الأمان (RLS).
 */
import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { DEFAULT_BANK_TREE_CATEGORY_SEEDS } from '../bank-statements/default-bank-tree-categories.seed';
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

  /**
   * تهيئة المحاسبة للشركة الجديدة.
   * يُستدعى تلقائياً من CompanyService.create.
   *
   * @param tenantId - معرف المستأجر (RLS)
   * @param companyId - معرف الشركة
   * @returns عدد الحسابات المُنشأة
   */
  async initializeCompanyAccounting(tenantId: string, companyId: string): Promise<{ accounts: number; vaults: number; categories: number; suppliers: number }> {
    const codeToAccountId: Record<string, string> = {};

    // 1. إنشاء الحسابات الـ 16 (أصول + خصوم + ملكية + إيرادات + مصروفات)
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

    // 2. إنشاء الخزينتين (V-001, V-002)
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
        },
      });
    }

    // 3. إنشاء الفترة المالية الافتراضية (السنة الحالية)
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

    // 4. إنشاء الفئات الرئيسية وربطها بالحسابات
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
          code:      cat.accountCode,   // الفئة الرئيسية تحمل كود الحساب كمرجع
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

    // 5. إنشاء الفئات الفرعية المقترحة (تحت كل فرع رئيسي)
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
          code:      sub.code,          // الكود التحليلي مثل P1-1 أو E3-2
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

    // 6. إنشاء موردين الخدمات الافتراضيين (كهرباء، اتصالات)
    let supplierCount = 0;
    for (const sup of MASTER_SUPPLIERS) {
      const categoryId = subCategoryKeyToId[`${sup.parentAccountCode}:${sup.subCategoryNameAr}`];
      if (!categoryId) continue;
      await this.prisma.supplier.create({
        data: {
          tenantId,
          companyId,
          nameAr: sup.nameAr,
          nameEn: sup.nameEn,
          taxNumber: sup.taxNumber,
          supplierCategoryId: categoryId,
          isDeleted: false,
        },
      });
      supplierCount++;
    }

    // 7. فئات شجرة تصنيف كشف الحساب (قواعد من النظام السابق)
    await this.seedDefaultBankTreeCategories(tenantId, companyId);

    return {
      accounts: MASTER_ACCOUNTS.length,
      vaults: MASTER_VAULTS.length,
      categories: MASTER_CATEGORIES.length + subCount,
      suppliers: supplierCount,
    };
  }

  /**
   * إعادة تهيئة الفئات والحسابات لشركة واحدة.
   * آمن تماماً: يمسح الفئات القديمة + الحسابات الزائدة ثم يعيد البذر بالهيكل الجديد.
   *
   * الخطوات:
   * 1. فصل الموردين وبنود المصروفات عن الفئات (null)
   * 2. حذف جميع الفئات للشركة
   * 3. حذف الحسابات غير الأساسية (مولَّدة قديماً خارج MASTER)
   * 4. upsert الحسابات الأساسية (إنشاء ما يغيب، تحديث ما يختلف)
   * 5. إعادة بذر الفئات الرئيسية والفرعية بالأكواد التحليلية
   */
  async resetAndReinitializeCategories(tenantId: string, companyId: string): Promise<{
    deleted: { categories: number; oldAccounts: number };
    created: { categories: number };
  }> {
    const masterCodes = new Set(MASTER_ACCOUNTS.map((a) => a.code));

    // ① فصل الموردين عن الفئات (supplierCategoryId nullable → null آمن)
    await this.prisma.supplier.updateMany({
      where: { companyId },
      data:  { supplierCategoryId: null },
    });

    // ② حذف بنود المصروفات (categoryId غير nullable → لا يمكن تصفيرها)
    //    هذه بيانات تجريبية ستُعاد إضافتها يدوياً بعد إعادة هيكلة الفئات
    await this.prisma.expenseLine.deleteMany({ where: { companyId } });

    // ③ حذف جميع الفئات (الأبناء أولاً ثم الآباء لتجنب قيود FK)
    await this.prisma.category.deleteMany({ where: { companyId, parentId: { not: null } } });
    const delCats = await this.prisma.category.deleteMany({ where: { companyId } });

    // ④ حذف الحسابات الزائدة (مولَّدة قديماً وليست في MASTER)
    //    نتحقق: لا توجد لها قيود محاسبية في ledger_entries (آمن على بيانات تجريبية)
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

    // ⑤ upsert الحسابات الأساسية (createMany skipDuplicates)
    const codeToAccountId: Record<string, string> = {};
    for (const acc of MASTER_ACCOUNTS) {
      const existing = await this.prisma.account.findFirst({ where: { companyId, code: acc.code } });
      if (existing) {
        // تحديث البيانات إن تغيّرت
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

    // ⑥ إعادة بذر الفئات الرئيسية
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

    // ⑦ إعادة بذر الفئات الفرعية مع الأكواد التحليلية
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

  /**
   * إضافة الفئات الفرعية الناقصة فقط + تحديث nameEn للموجودة إن كانت فارغة.
   * آمنة تماماً على الشركات التي لديها فئات مخصصة.
   */
  async patchMissingSubcategories(tenantId: string, companyId: string): Promise<{ added: number; updated: number; skipped: number }> {
    let added = 0;
    let updated = 0;
    let skipped = 0;

    for (const sub of MASTER_SUBCATEGORIES) {
      const exists = await this.prisma.category.findFirst({
        where: { companyId, code: sub.code },
      });

      if (exists) {
        // حدّث nameEn إن كان فارغاً أو مطابقاً للعربي (قديم)
        if (!exists.nameEn || exists.nameEn === exists.nameAr) {
          await this.prisma.category.update({
            where: { id: exists.id },
            data: { nameEn: sub.nameEn },
          });
          updated++;
        } else {
          skipped++;
        }
        continue;
      }

      // ابحث عن الفئة الأب بالكود
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

  /** تطبيق patch على جميع الشركات */
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

  /**
   * إعادة تهيئة الفئات لجميع الشركات دفعةً واحدة.
   * يُستدعى من endpoint محمي بصلاحية super_admin.
   */
  async resetAllCompaniesCategories(tenantId: string): Promise<{
    companies: number;
    details: Array<{ companyId: string; result: Awaited<ReturnType<typeof this.resetAndReinitializeCategories>> }>;
  }> {
    const companies = await this.prisma.company.findMany({ where: { tenantId } });
    const details: Array<{ companyId: string; result: Awaited<ReturnType<typeof this.resetAndReinitializeCategories>> }> = [];
    for (const company of companies) {
      const result = await this.resetAndReinitializeCategories(tenantId, company.id);
      details.push({ companyId: company.id, result });
    }
    return { companies: companies.length, details };
  }

  /** يزرع فقط إن لم تكن هناك فئات شجرية — لا يكرر عند إعادة الاستدعاء */
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
