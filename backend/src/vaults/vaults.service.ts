/**
 * VaultsService — إدارة الخزائن
 * ✅ findAll: استعلام groupBy واحد بدلاً من N+1
 *    قبل: 10 خزائن = 21 استعلام | بعد: 10 خزائن = 3 استعلامات ثابتة
 */
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { TenantContext } from '../common/tenant-context';
import { nowSaudi } from '../common/utils/date-utils';
import { toYmd } from '../common/utils/to-ymd.util';
import { CreateVaultDto } from './dto/create-vault.dto';
import { FinancialCoreService } from '../financial-core/financial-core.service';
import type { TransferDto } from '../financial-core/dto/financial-operation.dto';
import type { VaultTransferBody } from './dto/vault-transfer.dto';
import { attachVaultLedgerBalances, debitCreditMapsFromGroupBy } from './vault-ledger-maps.util';
import { findOneWithTransactions as queryVaultWithTransactions } from './vaults-find-one-with-transactions.util';

@Injectable()
export class VaultsService {
  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly financialCore: FinancialCoreService,
  ) {}

  /**
   * جلب جميع الخزائن مع الداخل/الخارج/الرصيد.
   * ✅ بدلاً من N+1: استعلامان groupBy يجلبان أرصدة جميع الخزائن دفعة واحدة.
   * عند تمرير startDate/endDate يتم الفلترة على الفترة المحددة.
   */
  async findAll(
    companyId: string,
    includeArchived = false,
    startDate?: string,
    endDate?: string,
  ) {
    const where = { companyId, isActive: true, ...(includeArchived ? {} : { isArchived: false }) };

    // ── 1. جلب الخزائن ──────────────────────────────────────
    const vaults = await this.prisma.vault.findMany({
      where,
      orderBy: [{ isArchived: 'asc' }, { sortOrder: 'asc' }, { nameAr: 'asc' }],
      include: { account: { select: { id: true, code: true, nameAr: true } } },
    });

    if (vaults.length === 0) return [];

    // ── 2. جمع accountIds لجميع الخزائن ─────────────────────
    const accountIds = vaults.map((v) => v.accountId);

    /** مطابقة `buildInvoiceTransactionDateFilter`: يوم كامل UTC وليس `Date('YYYY-MM-DD')` كحد علوي (= منتصف ليل بداية اليوم فقط). */
    const dateFilter =
      startDate || endDate
        ? {
            transactionDate: {
              ...(startDate ? { gte: new Date(`${toYmd(startDate)}T00:00:00.000Z`) } : {}),
              ...(endDate ? { lte: new Date(`${toYmd(endDate)}T23:59:59.999Z`) } : {}),
            },
          }
        : {};

    const ledgerWhere = {
      companyId,
      status: 'active',
      ...dateFilter,
    };

    // ── 3. استعلام واحد: مجموع الداخل (مدين) لجميع الحسابات
    const debitRows = await this.prisma.ledgerEntry.groupBy({
      by:     ['debitAccountId'],
      where:  { ...ledgerWhere, debitAccountId: { in: accountIds } },
      _sum:   { amount: true },
    });

    // ── 4. استعلام واحد: مجموع الخارج (دائن) لجميع الحسابات
    const creditRows = await this.prisma.ledgerEntry.groupBy({
      by:     ['creditAccountId'],
      where:  { ...ledgerWhere, creditAccountId: { in: accountIds } },
      _sum:   { amount: true },
    });

    const { debitMap, creditMap } = debitCreditMapsFromGroupBy(debitRows, creditRows);
    return attachVaultLedgerBalances(vaults, debitMap, creditMap);
  }

  /**
   * تحويل نقد بين خزينتين — قيد محاسبي واحد (transfer) عبر FinancialCoreService.
   * لا يُنشئ فاتورة ولا يؤثر على P&L.
   */
  async transfer(dto: VaultTransferBody, userId?: string) {
    const payload: TransferDto = {
      companyId:       dto.companyId,
      fromVaultId:     dto.fromVaultId,
      toVaultId:       dto.toVaultId,
      amount:          dto.amount,
      transactionDate: dto.transactionDate,
      notes:           dto.notes ?? undefined,
      idempotencyKey:  dto.idempotencyKey ?? undefined,
    };
    return this.financialCore.processTransfer(payload, userId);
  }

  async findSalesChannels(companyId: string) {
    const vaults = await this.prisma.vault.findMany({
      where: {
        companyId,
        isActive: true,
        isArchived: false,
        isSalesChannel: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { nameAr: 'asc' }],
      include: { account: { select: { id: true, code: true, nameAr: true } } },
    });

    return vaults;
  }

  async findPaymentOptions(companyId: string) {
    const vaults = await this.prisma.vault.findMany({
      where: {
        companyId,
        isActive: true,
        isArchived: false,
        showAsPaymentMethod: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { nameAr: 'asc' }],
      include: { account: { select: { id: true, code: true, nameAr: true } } },
    });

    return vaults;
  }

  /**
   * أرصدة الخزائن حتى نهاية يوم محدد (شامل) — مجموع القيود الفعّالة حتى 23:59:59 UTC لذلك اليوم.
   * يُستخدم في تقرير نهاية اليوم لعرض «الرصيد في نهاية اليوم» وليس الرصيد اللحظي الحالي.
   */
  async getBalancesAsOf(companyId: string, endDate: string, includeArchived = false) {
    const d = toYmd(endDate);
    const end = new Date(`${d}T23:59:59.999Z`);
    const where = { companyId, isActive: true, ...(includeArchived ? {} : { isArchived: false }) };

    const vaults = await this.prisma.vault.findMany({
      where,
      orderBy: [{ isArchived: 'asc' }, { sortOrder: 'asc' }, { nameAr: 'asc' }],
      include: { account: { select: { id: true, code: true, nameAr: true } } },
    });
    if (vaults.length === 0) return [];

    const accountIds = vaults.map((v) => v.accountId);
    const ledgerWhere = {
      companyId,
      status: 'active' as const,
      transactionDate: { lte: end },
    };

    const [debitRows, creditRows] = await Promise.all([
      this.prisma.ledgerEntry.groupBy({
        by:    ['debitAccountId'],
        where: { ...ledgerWhere, debitAccountId: { in: accountIds } },
        _sum:  { amount: true },
      }),
      this.prisma.ledgerEntry.groupBy({
        by:    ['creditAccountId'],
        where: { ...ledgerWhere, creditAccountId: { in: accountIds } },
        _sum:  { amount: true },
      }),
    ]);

    const { debitMap, creditMap } = debitCreditMapsFromGroupBy(debitRows, creditRows);
    return attachVaultLedgerBalances(vaults, debitMap, creditMap);
  }

  /**
   * جلب خزنة واحدة مع حركاتها المفلترة بالتاريخ.
   */
  findOneWithTransactions(
    id: string,
    companyId: string,
    startDate?: string,
    endDate?: string,
    page = 1,
    pageSize = 50,
  ) {
    return queryVaultWithTransactions(this.prisma, id, companyId, startDate, endDate, page, pageSize);
  }

  /**
   * إنشاء خزنة + حساب أصول مرتبط تلقائياً (للقيد المزدوج) — في transaction واحدة.
   */
  async create(dto: CreateVaultDto, userId?: string) {
    const tenantId = TenantContext.getTenantId();
    const normalizedPaymentMethod = dto.showAsPaymentMethod === false ? null : (dto.paymentMethod ?? null);

    return this.prisma.$transaction(async (tx) => {
      // توليد كود حساب فريد V-001, V-002, ...
      const existingCodes = await tx.account.findMany({
        where:  { companyId: dto.companyId },
        select: { code: true },
      });
      const maxNum = existingCodes
        .map((a) => { const m = /^V-(\d+)$/.exec(a.code); return m ? parseInt(m[1], 10) : 0; })
        .reduce((a, b) => Math.max(a, b), 0);
      const code = `V-${String(maxNum + 1).padStart(3, '0')}`;

      const sortAgg = await tx.vault.aggregate({
        where: { companyId: dto.companyId, isActive: true, isArchived: false },
        _max:  { sortOrder: true },
      });
      const nextSortOrder = (sortAgg._max.sortOrder ?? -1) + 1;

      const account = await tx.account.create({
        data: {
          tenantId,
          companyId: dto.companyId,
          code,
          nameAr: dto.nameAr.trim(),
          nameEn: (dto.nameEn ?? '').trim() || null,
          type:   'asset',
        },
      });

      const vault = await tx.vault.create({
        data: {
          tenantId,
          companyId:      dto.companyId,
          accountId:      account.id,
          nameAr:         dto.nameAr.trim(),
          nameEn:         (dto.nameEn ?? '').trim() || null,
          type:           dto.type,
          isSalesChannel: dto.isSalesChannel ?? false,
          showAsPaymentMethod: dto.showAsPaymentMethod ?? true,
          paymentMethod:  normalizedPaymentMethod,
          notes:          (dto.notes ?? '').trim() || null,
          sortOrder:      nextSortOrder,
        },
        include: { account: { select: { id: true, code: true, nameAr: true } } },
      });

      // AuditLog — بصمة إنشاء الخزنة
      await tx.auditLog.create({
        data: {
          tenantId,
          companyId: dto.companyId,
          userId:    userId ?? null,
          action:    'create',
          entity:    'vault',
          entityId:  vault.id,
          newValue:  { nameAr: vault.nameAr, type: vault.type, isSalesChannel: vault.isSalesChannel } as Prisma.InputJsonValue,
          createdAt: nowSaudi(),
        },
      });

      return vault;
    });
  }

  /**
   * تعديل خزنة.
   */
  async update(id: string, companyId: string, data: {
    nameAr?:         string;
    nameEn?:         string | null;
    type?:           string;
    isSalesChannel?: boolean;
    showAsPaymentMethod?: boolean;
    paymentMethod?:  string | null;
    notes?:          string | null;
    sortOrder?:      number;
  }, userId?: string) {
    const tenantId = TenantContext.tryGetTenantId() ?? '';
    const vault    = await this.prisma.vault.findFirst({ where: { id, companyId } });
    if (!vault) throw new NotFoundException('الخزنة غير موجودة');
    const nextShowAsPaymentMethod =
      data.showAsPaymentMethod !== undefined ? data.showAsPaymentMethod : vault.showAsPaymentMethod;
    const normalizedPaymentMethod =
      nextShowAsPaymentMethod === false
        ? null
        : (data.paymentMethod !== undefined ? (data.paymentMethod || null) : undefined);

    const updated = await this.prisma.vault.update({
      where: { id },
      data:  {
        ...(data.nameAr         !== undefined ? { nameAr:         data.nameAr.trim()         } : {}),
        ...(data.nameEn         !== undefined ? { nameEn:         data.nameEn?.trim() || null } : {}),
        ...(data.type           !== undefined ? { type:           data.type                   } : {}),
        ...(data.isSalesChannel !== undefined ? { isSalesChannel: data.isSalesChannel         } : {}),
        ...(data.showAsPaymentMethod !== undefined ? { showAsPaymentMethod: data.showAsPaymentMethod } : {}),
        ...(normalizedPaymentMethod !== undefined ? { paymentMethod: normalizedPaymentMethod } : {}),
        ...(data.notes          !== undefined ? { notes:          data.notes?.trim() || null  } : {}),
        ...(data.sortOrder     !== undefined ? { sortOrder:      data.sortOrder } : {}),
      },
      include: { account: { select: { id: true, code: true, nameAr: true } } },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        companyId,
        userId: userId ?? null,
        action: 'update',
        entity: 'vault',
        entityId: id,
        oldValue: { nameAr: vault.nameAr, type: vault.type } as Prisma.InputJsonValue,
        newValue: { nameAr: updated.nameAr, type: updated.type } as Prisma.InputJsonValue,
        createdAt: nowSaudi(),
      },
    });

    return updated;
  }

  /**
   * ترتيب الخزائن النشطة غير المؤرشفة — يُحدّث sortOrder بحيث يطابق ترتيب المعرفات المرسلة.
   */
  async reorder(companyId: string, vaultIds: string[]) {
    const existing = await this.prisma.vault.findMany({
      where: { companyId, isActive: true, isArchived: false },
      select: { id: true },
    });
    if (existing.length === 0) {
      throw new BadRequestException('لا توجد خزائن للترتيب.');
    }
    const setIds = new Set(existing.map((v) => v.id));
    if (vaultIds.length !== setIds.size) {
      throw new BadRequestException('يجب أن يتضمّن الترتيب كل الخزائن النشطة غير المؤرشفة دون زيادة أو نقص.');
    }
    for (const id of vaultIds) {
      if (!setIds.has(id)) {
        throw new BadRequestException('معرف خزنة غير صالح أو لا ينتمي للخزائن النشطة.');
      }
    }
    await this.prisma.$transaction(
      vaultIds.map((id, i) =>
        this.prisma.vault.update({
          where: { id },
          data:  { sortOrder: i },
        }),
      ),
    );
    return { success: true };
  }

  /**
   * أرشفة/استعادة خزنة (تبديل isArchived).
   */
  async archive(id: string, companyId: string, userId?: string) {
    const tenantId = TenantContext.tryGetTenantId() ?? '';
    const vault    = await this.prisma.vault.findFirst({ where: { id, companyId } });
    if (!vault) throw new NotFoundException('الخزنة غير موجودة');

    const updated = await this.prisma.vault.update({
      where: { id },
      data:  { isArchived: !vault.isArchived },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        companyId,
        userId: userId ?? null,
        action: vault.isArchived ? 'update' : 'delete',
        entity: 'vault',
        entityId: id,
        oldValue: { isArchived: vault.isArchived } as Prisma.InputJsonValue,
        newValue: { isArchived: updated.isArchived } as Prisma.InputJsonValue,
        createdAt: nowSaudi(),
      },
    });

    return updated;
  }

  /**
   * حذف: يتحقق من عدم وجود قيود مرتبطة.
   * إن وُجدت قيود → يُوجَّه للأرشفة بدلاً من الحذف (حماية سلامة البيانات).
   */
  /**
   * إغلاق ناعم — لا حذف فيزيائي.
   * إذا كانت هناك حركات مالية → مرفوض (يجب الأرشفة بدلاً منه).
   */
  async remove(id: string, companyId: string, userId?: string) {
    const tenantId = TenantContext.tryGetTenantId() ?? '';
    const vault    = await this.prisma.vault.findFirst({ where: { id, companyId } });
    if (!vault) throw new NotFoundException('الخزنة غير موجودة');

    const ledgerCount = await this.prisma.ledgerEntry.count({
      where: {
        companyId,
        OR: [
          { vaultId: id },
          { debitAccountId: vault.accountId },
          { creditAccountId: vault.accountId },
        ],
      },
    });
    if (ledgerCount > 0) {
      throw new BadRequestException(
        'لا يمكن حذف خزنة تحتوي على حركات مالية. يمكنك أرشفتها بدلاً من ذلك.',
      );
    }

    await this.prisma.vault.update({ where: { id }, data: { isActive: false } });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        companyId,
        userId: userId ?? null,
        action: 'delete',
        entity: 'vault',
        entityId: id,
        oldValue: { nameAr: vault.nameAr, isActive: true } as Prisma.InputJsonValue,
        newValue: { isActive: false, reason: 'soft_delete' }  as Prisma.InputJsonValue,
        createdAt: nowSaudi(),
      },
    });

    return { success: true };
  }
}
