/**
 * AccountingInitService — محرك البذر التلقائي لدليل الحسابات (COA)
 *
 * يُنفذ عند إنشاء أي شركة جديدة عبر initializeCompanyAccounting.
 * يزرع: 15 حساباً افتراضياً + خزينتين + فئات وتصنيفات فرعية + موردين افتراضيين.
 *
 * موردين افتراضيين: الشركة السعودية للكهرباء، الاتصالات السعودية (STC)
 * — مرتبطين بفئات (كهرباء، اتصالات) تحت إيجار ومرافق، مع الرقم الضريبي.
 *
 * القاعدة الذهبية: tenantId مُحقون في كل سجل لضمان الأمان (RLS).
 */
import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { DEFAULT_BANK_TREE_CATEGORY_SEEDS } from '../bank-statements/default-bank-tree-categories.seed';

export interface MasterAccountSeed {
  code: string;
  nameAr: string;
  nameEn: string;
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  icon: string;
  taxExempt: boolean;
}

export interface MasterVaultSeed {
  accountCode: string;
  nameAr: string;
  nameEn: string;
  type: 'cash' | 'bank';
}

export interface MasterCategorySeed {
  accountCode: string;
  nameAr: string;
  type: 'purchase' | 'expense' | 'sale';
}

/** قالب الحسابات الافتراضي — يُزرع لكل شركة جديدة */
const MASTER_ACCOUNTS: MasterAccountSeed[] = [
  // أ- الأصول
  { code: 'V-001', nameAr: 'الخزينة الرئيسية (كاش)', nameEn: 'Main Cash Vault', type: 'asset', icon: '💵', taxExempt: false },
  { code: 'V-002', nameAr: 'البنك (مدى/تحويلات)', nameEn: 'Bank (Mada/Transfer)', type: 'asset', icon: '💳', taxExempt: false },
  { code: 'EXP-001', nameAr: 'سلفيات الموظفين', nameEn: 'Employee Advances', type: 'asset', icon: '👤', taxExempt: false },
  // ب- المصاريف
  { code: 'PUR-001', nameAr: 'بضاعة ومواد (مشتريات)', nameEn: 'Goods & Materials (Purchases)', type: 'expense', icon: '📦', taxExempt: false },
  { code: 'EXP-004', nameAr: 'رواتب وأجور', nameEn: 'Salaries & Wages', type: 'expense', icon: '💸', taxExempt: true },
  { code: 'EXP-002', nameAr: 'رسوم حكومية وإقامات', nameEn: 'Gov Fees & Iqama', type: 'expense', icon: '🏛️', taxExempt: true },
  { code: 'EXP-003', nameAr: 'إيجار ومرافق (كهرباء/ماء)', nameEn: 'Rent & Utilities', type: 'expense', icon: '🏠', taxExempt: false },
  { code: 'EXP-005', nameAr: 'صيانة وتشغيل', nameEn: 'Maintenance & Operations', type: 'expense', icon: '🛠️', taxExempt: false },
  { code: 'EXP-006', nameAr: 'تسويق وهدايا', nameEn: 'Marketing & Gifts', type: 'expense', icon: '📣', taxExempt: false },
  { code: 'EXP-007', nameAr: 'مصروفات مالية', nameEn: 'Financial Expenses', type: 'expense', icon: '🏦', taxExempt: false },
  { code: 'EXP-008', nameAr: 'أصول ومعدات', nameEn: 'Assets & Equipment', type: 'expense', icon: '🖥️', taxExempt: false },
  // ج- الإيرادات والملكية والضرائب
  { code: 'REV-001', nameAr: 'المبيعات', nameEn: 'Sales', type: 'revenue', icon: '💰', taxExempt: false },
  { code: 'EQU-001', nameAr: 'رأس المال', nameEn: 'Capital', type: 'equity', icon: '💎', taxExempt: false },
  { code: 'TAX-001', nameAr: 'ضريبة القيمة المضافة', nameEn: 'VAT', type: 'liability', icon: '📝', taxExempt: false },
];

const MASTER_VAULTS: MasterVaultSeed[] = [
  { accountCode: 'V-001', nameAr: 'الخزينة الرئيسية (كاش)', nameEn: 'Main Cash', type: 'cash' },
  { accountCode: 'V-002', nameAr: 'البنك (مدى/تحويلات)', nameEn: 'Bank (Mada/Transfer)', type: 'bank' },
];

/** فئات مرتبطة بحسابات — للعرض في واجهة الفئات وتقارير P&L */
const MASTER_CATEGORIES: MasterCategorySeed[] = [
  { accountCode: 'PUR-001', nameAr: 'بضاعة ومواد (مشتريات)', type: 'purchase' },
  { accountCode: 'EXP-004', nameAr: 'رواتب وأجور', type: 'expense' },
  { accountCode: 'EXP-002', nameAr: 'رسوم حكومية وإقامات', type: 'expense' },
  { accountCode: 'EXP-003', nameAr: 'إيجار ومرافق (كهرباء/ماء)', type: 'expense' },
  { accountCode: 'EXP-005', nameAr: 'صيانة وتشغيل', type: 'expense' },
  { accountCode: 'EXP-006', nameAr: 'تسويق وهدايا', type: 'expense' },
  { accountCode: 'EXP-007', nameAr: 'مصروفات مالية', type: 'expense' },
  { accountCode: 'EXP-008', nameAr: 'أصول ومعدات', type: 'expense' },
  { accountCode: 'REV-001', nameAr: 'المبيعات', type: 'sale' },
];

/** فئات فرعية مقترحة — تحت كل فرع رئيسي (مقترحة ومتداولة) */
interface SubCategorySeed {
  parentAccountCode: string;
  nameAr: string;
  sortOrder?: number;
}
const MASTER_SUBCATEGORIES: SubCategorySeed[] = [
  // تحت المشتريات (بضاعة ومواد)
  { parentAccountCode: 'PUR-001', nameAr: 'مواد تشغيلية', sortOrder: 0 },
  { parentAccountCode: 'PUR-001', nameAr: 'غاز', sortOrder: 1 },
  { parentAccountCode: 'PUR-001', nameAr: 'فحم', sortOrder: 2 },
  { parentAccountCode: 'PUR-001', nameAr: 'بضاعة تموينية', sortOrder: 3 },
  { parentAccountCode: 'PUR-001', nameAr: 'خامات', sortOrder: 4 },
  // تحت إيجار ومرافق
  { parentAccountCode: 'EXP-003', nameAr: 'إيجارات', sortOrder: 0 },
  { parentAccountCode: 'EXP-003', nameAr: 'كهرباء', sortOrder: 1 },
  { parentAccountCode: 'EXP-003', nameAr: 'اتصالات', sortOrder: 2 },
  { parentAccountCode: 'EXP-003', nameAr: 'ماء', sortOrder: 3 },
  { parentAccountCode: 'EXP-003', nameAr: 'غاز', sortOrder: 4 },
  // تحت صيانة وتشغيل
  { parentAccountCode: 'EXP-005', nameAr: 'صيانة آلات', sortOrder: 0 },
  { parentAccountCode: 'EXP-005', nameAr: 'قطع غيار', sortOrder: 1 },
  // تحت رسوم حكومية وإقامات
  { parentAccountCode: 'EXP-002', nameAr: 'رخصة تجارية', sortOrder: 0 },
  { parentAccountCode: 'EXP-002', nameAr: 'رخصة بلدية', sortOrder: 1 },
  { parentAccountCode: 'EXP-002', nameAr: 'دفاع مدني', sortOrder: 2 },
  { parentAccountCode: 'EXP-002', nameAr: 'إقامات وجوازات', sortOrder: 3 },
  { parentAccountCode: 'EXP-002', nameAr: 'زيارات', sortOrder: 4 },
  { parentAccountCode: 'EXP-002', nameAr: 'غرامات', sortOrder: 5 },
  { parentAccountCode: 'EXP-002', nameAr: 'ضرائب ورسوم أخرى', sortOrder: 6 },
  // تحت مصروفات مالية
  { parentAccountCode: 'EXP-007', nameAr: 'رسوم تحويل', sortOrder: 0 },
  { parentAccountCode: 'EXP-007', nameAr: 'رسوم سحب', sortOrder: 1 },
  { parentAccountCode: 'EXP-007', nameAr: 'رسوم إدارة حساب', sortOrder: 2 },
  { parentAccountCode: 'EXP-007', nameAr: 'فوائد ورسوم قروض', sortOrder: 3 },
  { parentAccountCode: 'EXP-007', nameAr: 'رسوم أخرى', sortOrder: 4 },
  // تحت أصول ومعدات
  { parentAccountCode: 'EXP-008', nameAr: 'أثاث', sortOrder: 0 },
  { parentAccountCode: 'EXP-008', nameAr: 'معدات مكتبية', sortOrder: 1 },
  { parentAccountCode: 'EXP-008', nameAr: 'أجهزة وإلكترونيات', sortOrder: 2 },
  { parentAccountCode: 'EXP-008', nameAr: 'مركبات', sortOrder: 3 },
  { parentAccountCode: 'EXP-008', nameAr: 'آلات ومعدات', sortOrder: 4 },
  { parentAccountCode: 'EXP-008', nameAr: 'أصول أخرى', sortOrder: 5 },
];

/** موردين خدمات افتراضيين — يُنشَؤون مع كل شركة جديدة */
interface MasterSupplierSeed {
  parentAccountCode: string;
  subCategoryNameAr: string;
  nameAr: string;
  nameEn: string;
  taxNumber: string | null;
}
const MASTER_SUPPLIERS: MasterSupplierSeed[] = [
  {
    parentAccountCode: 'EXP-003',
    subCategoryNameAr: 'كهرباء',
    nameAr: 'الشركة السعودية للكهرباء',
    nameEn: 'Saudi Electricity Company (SEC)',
    taxNumber: '300002471100003',
  },
  {
    parentAccountCode: 'EXP-003',
    subCategoryNameAr: 'اتصالات',
    nameAr: 'الاتصالات السعودية (STC)',
    nameEn: 'Saudi Telecom Company (STC)',
    taxNumber: '300000157210003',
  },
];

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

    // 1. إنشاء الحسابات الـ 13
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
