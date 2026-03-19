/**
 * VaultsService — إدارة الخزائن
 * ✅ findAll: استعلام groupBy واحد بدلاً من N+1
 *    قبل: 10 خزائن = 21 استعلام | بعد: 10 خزائن = 3 استعلامات ثابتة
 */
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma }          from '@prisma/client';
import Decimal             from 'decimal.js';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { TenantContext }   from '../common/tenant-context';
import { nowSaudi }        from '../common/utils/date-utils';
import { CreateVaultDto }  from './dto/create-vault.dto';

@Injectable()
export class VaultsService {
  constructor(private readonly prisma: TenantPrismaService) {}

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
    const where = { companyId, ...(includeArchived ? {} : { isArchived: false }) };

    // ── 1. جلب الخزائن ──────────────────────────────────────
    const vaults = await this.prisma.vault.findMany({
      where,
      orderBy: [{ isArchived: 'asc' }, { nameAr: 'asc' }],
      include: { account: { select: { id: true, code: true, nameAr: true } } },
    });

    if (vaults.length === 0) return [];

    // ── 2. جمع accountIds لجميع الخزائن ─────────────────────
    const accountIds = vaults.map((v) => v.accountId);

    const dateFilter =
      startDate || endDate
        ? {
            transactionDate: {
              ...(startDate ? { gte: new Date(startDate) } : {}),
              ...(endDate ? { lte: new Date(endDate) } : {}),
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

    // ── 5. بناء خرائط سريعة O(1) — Decimal للدقة المالية ─────
    const debitMap  = new Map<string, Decimal>(
      debitRows.map((r) => [r.debitAccountId,  new Decimal(r._sum.amount ?? 0)]),
    );
    const creditMap = new Map<string, Decimal>(
      creditRows.map((r) => [r.creditAccountId, new Decimal(r._sum.amount ?? 0)]),
    );

    // ── 6. دمج الأرصدة مع الخزائن (Decimal) ──────────────────
    return vaults.map((v) => {
      const totalIn  = debitMap.get(v.accountId)  ?? new Decimal(0);
      const totalOut = creditMap.get(v.accountId) ?? new Decimal(0);
      const balance  = totalIn.minus(totalOut);
      return {
        ...v,
        totalIn:  totalIn.toNumber(),
        totalOut: totalOut.toNumber(),
        balance:   balance.toNumber(),
      };
    });
  }

  /**
   * جلب خزنة واحدة مع حركاتها المفلترة بالتاريخ.
   */
  async findOneWithTransactions(
    id:        string,
    companyId: string,
    startDate?: string,
    endDate?:   string,
    page       = 1,
    pageSize   = 50,
  ) {
    const vault = await this.prisma.vault.findFirst({
      where:   { id, companyId },
      include: { account: { select: { id: true, code: true, nameAr: true } } },
    });
    if (!vault) throw new NotFoundException('الخزنة غير موجودة');

    const dateFilter =
      startDate || endDate
        ? {
            transactionDate: {
              ...(startDate ? { gte: new Date(startDate) } : {}),
              ...(endDate   ? { lte: new Date(endDate)   } : {}),
            },
          }
        : {};

    const where = { companyId, vaultId: id, status: 'active', ...dateFilter };

    const [items, total, debitAgg, creditAgg] = await Promise.all([
      this.prisma.ledgerEntry.findMany({
        where,
        orderBy: { transactionDate: 'desc' },
        skip:    (page - 1) * pageSize,
        take:    pageSize,
      }),
      this.prisma.ledgerEntry.count({ where }),
      this.prisma.ledgerEntry.aggregate({
        _sum:  { amount: true },
        where: { companyId, debitAccountId: vault.accountId, status: 'active' },
      }),
      this.prisma.ledgerEntry.aggregate({
        _sum:  { amount: true },
        where: { companyId, creditAccountId: vault.accountId, status: 'active' },
      }),
    ]);

    const totalIn  = new Decimal(debitAgg._sum.amount  ?? 0);
    const totalOut = new Decimal(creditAgg._sum.amount ?? 0);
    const balance  = totalIn.minus(totalOut);

    // ── إثراء رقم السند (documentNumber) من المرجع ─────────────────
    const docNumMap = new Map<string, string>();
    const refs = [...new Set(items.map((e) => `${e.referenceType}:${e.referenceId}`))];
    const invoiceIds: string[] = [];
    const saleIds: string[] = [];
    for (const ref of refs) {
      const colonIdx = ref.indexOf(':');
      if (colonIdx < 0) continue;
      const refType = ref.slice(0, colonIdx);
      const refId = ref.slice(colonIdx + 1);
      if (!refId) continue;
      if (refType === 'invoice' || refType === 'salary' || refType === 'advance') {
        invoiceIds.push(refId);
      } else if (refType === 'sale') {
        saleIds.push(refId);
      }
    }
    try {
      if (invoiceIds.length > 0) {
        const invs = await this.prisma.invoice.findMany({
          where: { id: { in: invoiceIds }, companyId },
          select: { id: true, invoiceNumber: true },
        });
        const invMap = new Map(invs.map((i) => [i.id, i.invoiceNumber]));
        for (const ref of refs) {
          const refId = ref.slice(ref.indexOf(':') + 1);
          if (invMap.has(refId)) docNumMap.set(ref, invMap.get(refId)!);
        }
      }
      if (saleIds.length > 0) {
        const sales = await this.prisma.dailySalesSummary.findMany({
          where: { id: { in: saleIds }, companyId },
          select: { id: true, summaryNumber: true },
        });
        const saleMap = new Map(sales.map((s) => [s.id, s.summaryNumber]));
        for (const ref of refs) {
          const refId = ref.slice(ref.indexOf(':') + 1);
          if (saleMap.has(refId)) docNumMap.set(ref, saleMap.get(refId)!);
        }
      }
      for (const ref of refs) {
        if (!docNumMap.has(ref)) {
          const refId = ref.slice(ref.indexOf(':') + 1);
          docNumMap.set(ref, refId);
        }
      }
    } catch {
      for (const ref of refs) {
        if (!docNumMap.has(ref)) {
          const refId = ref.slice(ref.indexOf(':') + 1);
          docNumMap.set(ref, refId);
        }
      }
    }
    const enrichedItems = items.map((e) => {
      const key = `${e.referenceType}:${e.referenceId}`;
      const docNum = docNumMap.get(key) ?? e.referenceId ?? null;
      return { ...e, documentNumber: docNum };
    });

    return {
      vault:        {
        ...vault,
        totalIn:  totalIn.toNumber(),
        totalOut: totalOut.toNumber(),
        balance:   balance.toNumber(),
      },
      transactions: { items: enrichedItems, total, page, pageSize },
    };
  }

  /**
   * إنشاء خزنة + حساب أصول مرتبط تلقائياً (للقيد المزدوج) — في transaction واحدة.
   */
  async create(dto: CreateVaultDto, userId?: string) {
    const tenantId = TenantContext.getTenantId();

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
          paymentMethod:  dto.paymentMethod  ?? null,
          notes:          (dto.notes ?? '').trim() || null,
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
    paymentMethod?:  string | null;
    notes?:          string | null;
  }, userId?: string) {
    const tenantId = TenantContext.tryGetTenantId() ?? '';
    const vault    = await this.prisma.vault.findFirst({ where: { id, companyId } });
    if (!vault) throw new NotFoundException('الخزنة غير موجودة');

    const updated = await this.prisma.vault.update({
      where: { id },
      data:  {
        ...(data.nameAr         !== undefined ? { nameAr:         data.nameAr.trim()         } : {}),
        ...(data.nameEn         !== undefined ? { nameEn:         data.nameEn?.trim() || null } : {}),
        ...(data.type           !== undefined ? { type:           data.type                   } : {}),
        ...(data.isSalesChannel !== undefined ? { isSalesChannel: data.isSalesChannel         } : {}),
        ...(data.paymentMethod  !== undefined ? { paymentMethod:  data.paymentMethod || null  } : {}),
        ...(data.notes          !== undefined ? { notes:          data.notes?.trim() || null  } : {}),
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
      where: { companyId, vaultId: id },
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
